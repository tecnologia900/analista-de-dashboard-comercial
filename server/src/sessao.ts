import { randomUUID } from 'node:crypto';
import type { Relatorio, TipoRelatorio } from '@dash/shared';

const TTL_MS = 2 * 60 * 60 * 1000;

export interface Sessao {
  id: string;
  touchedAt: number;
  relatorios: Record<TipoRelatorio, Relatorio | null>;
}

const sessoes = new Map<string, Sessao>();

function vazios(): Sessao['relatorios'] {
  return { vendas: null, carteira: null, ranking: null, estoque: null, produtos: null };
}

export function criarSessao(): Sessao {
  const sessao: Sessao = { id: randomUUID(), touchedAt: Date.now(), relatorios: vazios() };
  sessoes.set(sessao.id, sessao);
  return sessao;
}

export function obterSessao(id: string | undefined): Sessao | null {
  if (!id) return null;
  const sessao = sessoes.get(id);
  if (!sessao) return null;
  if (Date.now() - sessao.touchedAt > TTL_MS) {
    sessoes.delete(id);
    return null;
  }
  sessao.touchedAt = Date.now();
  return sessao;
}

export function guardarRelatorio(sessao: Sessao, relatorio: Relatorio): void {
  sessao.relatorios[relatorio.tipo] = relatorio;
  sessao.touchedAt = Date.now();
}

export function removerRelatorio(sessao: Sessao, tipo: TipoRelatorio): void {
  sessao.relatorios[tipo] = null;
  sessao.touchedAt = Date.now();
}

export function limparSessao(sessao: Sessao): void {
  sessao.relatorios = vazios();
  sessao.touchedAt = Date.now();
}

export function substituirRelatorios(sessao: Sessao, relatorios: Sessao['relatorios']): void {
  const proximo = vazios();
  proximo.vendas = relatorios.vendas;
  proximo.carteira = relatorios.carteira;
  proximo.ranking = relatorios.ranking;
  proximo.estoque = relatorios.estoque;
  proximo.produtos = relatorios.produtos;
  sessao.relatorios = proximo;
  sessao.touchedAt = Date.now();
}

export function esquecerTudo(): void {
  sessoes.clear();
}

setInterval(() => {
  const agora = Date.now();
  for (const [id, sessao] of sessoes) {
    if (agora - sessao.touchedAt > TTL_MS) sessoes.delete(id);
  }
}, 60_000).unref();
