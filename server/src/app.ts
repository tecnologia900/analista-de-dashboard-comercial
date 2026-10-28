import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OBJETIVOS, objetivoPorId } from '@dash/shared';
import type { TipoRelatorio } from '@dash/shared';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { gerarPlanilha } from './amostra.js';
import { PlanilhaErro, analisarArquivo } from './parser.js';
import {
  criarSessao,
  guardarRelatorio,
  limparSessao,
  obterSessao,
  removerRelatorio,
  type Sessao,
} from './sessao.js';

const slotSchema = z.enum(['vendas', 'carteira', 'ranking', 'estoque', 'produtos', 'auto']);
const objetivoSchema = z.object({
  objetivo: z.enum(['giro', 'carteira', 'vendedores', 'vendas', 'executivo', 'todos']),
});

declare module 'fastify' {
  interface FastifyRequest {
    sessao: Sessao;
  }
}

export async function criarServidor() {
  const nivel = process.env.LOG_LEVEL ?? 'info';
  const app = Fastify({
    logger: nivel === 'silent' ? false : { level: nivel },
    bodyLimit: 30 * 1024 * 1024,
  });

  await app.register(cookie);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 3 } });

  app.addHook('onRequest', async (req, reply) => {
    const atual = obterSessao(req.cookies.dash_session);
    req.sessao = atual ?? criarSessao();
    reply.setCookie('dash_session', req.sessao.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 2,
    });
  });

  app.get('/api/saude', async () => ({ ok: true }));

  app.get('/api/sessao', async (req) => ({
    ok: true,
    relatorios: (Object.keys(req.sessao.relatorios) as TipoRelatorio[]).map((tipo) => {
      const relatorio = req.sessao.relatorios[tipo];
      return relatorio
        ? { tipo, origem: relatorio.meta.origem, linhas: relatorio.meta.linhasDados, avisos: relatorio.meta.avisos }
        : { tipo, origem: null, linhas: 0, avisos: [] };
    }),
  }));

  app.get('/api/sessao/dados', async (req) => ({ ok: true, relatorios: req.sessao.relatorios }));

  app.delete('/api/sessao', async (req) => {
    limparSessao(req.sessao);
    return { ok: true };
  });

  app.delete('/api/sessao/relatorios/:tipo', async (req, reply) => {
    const tipo = slotSchema.exclude(['auto']).safeParse((req.params as { tipo: string }).tipo);
    if (!tipo.success) return reply.code(400).send({ ok: false, mensagem: 'Tipo de relatório inválido.' });
    removerRelatorio(req.sessao, tipo.data);
    return { ok: true };
  });

  app.post('/api/arquivos', async (req, reply) => {
    const lido = await lerEnvio(req);
    if (!lido.buffer) return reply.code(400).send({ ok: false, mensagem: 'Nenhum arquivo foi enviado.' });
    const slot = slotSchema.safeParse(lido.slot);
    if (!slot.success) return reply.code(400).send({ ok: false, mensagem: 'Slot de relatório inválido.' });
    try {
      const resultado = analisarArquivo(lido.buffer, slot.data, lido.confirmar);
      if (!resultado.ok) return reply.code(409).send(resultado);
      guardarRelatorio(req.sessao, resultado.relatorio);
      return { ok: true, relatorio: resultado.relatorio };
    } catch (erro) {
      if (erro instanceof PlanilhaErro) {
        return reply.code(400).send({ ok: false, codigo: erro.codigo, mensagem: erro.message });
      }
      req.log.error({ msg: erro instanceof Error ? erro.message : 'falha' }, 'leitura');
      return reply.code(500).send({ ok: false, mensagem: 'Erro interno ao processar o arquivo.' });
    }
  });

  app.get('/api/exemplos/:tipo', async (req, reply) => {
    const tipo = slotSchema.exclude(['auto']).safeParse((req.params as { tipo: string }).tipo);
    if (!tipo.success) return reply.code(400).send({ ok: false, mensagem: 'Tipo de relatório inválido.' });
    const buffer = gerarPlanilha(tipo.data);
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${tipo.data}-exemplo.xlsx"`);
    return reply.send(buffer);
  });

  app.post('/api/exemplos', async (req, reply) => {
    const corpo = objetivoSchema.safeParse(req.body);
    if (!corpo.success) return reply.code(400).send({ ok: false, mensagem: 'Objetivo inválido.' });
    const tipos = tiposDoObjetivo(corpo.data.objetivo);
    for (const tipo of tipos) {
      const resultado = analisarArquivo(gerarPlanilha(tipo), tipo, false);
      if (resultado.ok) guardarRelatorio(req.sessao, resultado.relatorio);
    }
    return { ok: true, relatorios: req.sessao.relatorios };
  });

  const webDist = process.env.DASH_WEB_DIST
    ? path.resolve(process.env.DASH_WEB_DIST)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) return reply.code(404).send({ ok: false, mensagem: 'Não encontrado.' });
      return reply.sendFile('index.html');
    });
  }

  return app;
}

function tiposDoObjetivo(objetivo: string): TipoRelatorio[] {
  if (objetivo === 'todos' || objetivo === 'executivo') {
    return OBJETIVOS.find((item) => item.id === 'executivo')?.relatorios.slice() ?? [];
  }
  return objetivoPorId(objetivo)?.relatorios.slice() ?? [];
}

async function lerEnvio(req: FastifyRequest): Promise<{ buffer: Buffer | null; slot: string; confirmar: boolean }> {
  let slot = 'auto';
  let confirmar = false;
  let buffer: Buffer | null = null;
  const partes = req.parts();
  for await (const parte of partes) {
    if (parte.type === 'file') {
      if (parte.fieldname === 'arquivo') buffer = await parte.toBuffer();
      else await parte.toBuffer();
    } else if (parte.fieldname === 'slot') slot = String(parte.value);
    else if (parte.fieldname === 'confirmar') confirmar = parte.value === '1' || parte.value === 'true';
  }
  return { buffer, slot, confirmar };
}
