import { access, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { RELATORIOS } from '@dash/shared';
import type { Relatorio, TipoRelatorio } from '@dash/shared';

const TIPOS: TipoRelatorio[] = ['vendas', 'carteira', 'ranking', 'estoque', 'produtos'];

export type PacoteRelatorios = Record<TipoRelatorio, Relatorio | null>;

export interface ItemHistorico {
  dia: string;
  atualizadoEm: string;
  resumo: string;
  arquivos: TipoRelatorio[];
}

interface Gravado {
  versao: 1;
  dia: string;
  atualizadoEm: string;
  resumo: string;
  relatorios: PacoteRelatorios;
}

export class HistoricoErro extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoricoErro';
  }
}

export function pastaHistorico(): string {
  if (process.env.DASH_HISTORICO) return path.resolve(process.env.DASH_HISTORICO);
  const base =
    process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Painel do Gerente')
      : path.join(os.homedir(), 'Painel do Gerente');
  return path.join(base, 'historico');
}

function diaValido(dia: string): boolean {
  const m = dia.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const diaMes = Number(m[3]);
  if (ano < 2000 || ano > 2100) return false;
  const data = new Date(ano, mes - 1, diaMes);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === diaMes;
}

function arquivoDoDia(dia: string): string {
  if (!diaValido(dia)) throw new HistoricoErro('Informe um dia válido para a análise.');
  const pasta = pastaHistorico();
  const destino = path.resolve(pasta, `${dia}.json`);
  if (path.dirname(destino) !== path.resolve(pasta)) throw new HistoricoErro('Dia inválido.');
  return destino;
}

function pacoteVazio(): PacoteRelatorios {
  return { vendas: null, carteira: null, ranking: null, estoque: null, produtos: null };
}

export function comoPacote(valor: unknown): PacoteRelatorios | null {
  if (!valor || typeof valor !== 'object') return null;
  const obj = valor as Record<string, unknown>;
  const pacote = pacoteVazio();
  for (const tipo of TIPOS) {
    const item = obj[tipo];
    if (item == null) continue;
    if (typeof item !== 'object') return null;
    const rel = item as { tipo?: string; itens?: unknown; linhas?: unknown };
    if (rel.tipo !== tipo) return null;
    if (tipo === 'produtos') {
      if (!Array.isArray(rel.itens)) return null;
    } else if (!Array.isArray(rel.linhas)) return null;
    pacote[tipo] = item as Relatorio;
  }
  return pacote;
}

function resumoDe(relatorios: PacoteRelatorios): string {
  return TIPOS.flatMap((tipo) => {
    const relatorio = relatorios[tipo];
    if (!relatorio) return [];
    return [`${RELATORIOS[tipo].titulo}: ${relatorio.meta.origem}`];
  }).join(' · ');
}

function arquivosDe(relatorios: PacoteRelatorios): TipoRelatorio[] {
  return TIPOS.filter((tipo) => relatorios[tipo]);
}

export async function listarHistorico(): Promise<{ pasta: string; itens: ItemHistorico[] }> {
  const pasta = pastaHistorico();
  await mkdir(pasta, { recursive: true });
  const nomes = await readdir(pasta);
  const itens: ItemHistorico[] = [];
  for (const nome of nomes) {
    if (!nome.endsWith('.json')) continue;
    const dia = nome.slice(0, -'.json'.length);
    if (!diaValido(dia)) continue;
    try {
      const bruto = JSON.parse(await readFile(path.join(pasta, nome), 'utf8')) as Partial<Gravado>;
      const relatorios = comoPacote(bruto.relatorios);
      if (!relatorios) continue;
      itens.push({
        dia,
        atualizadoEm: typeof bruto.atualizadoEm === 'string' ? bruto.atualizadoEm : dia,
        resumo: typeof bruto.resumo === 'string' && bruto.resumo ? bruto.resumo : resumoDe(relatorios),
        arquivos: arquivosDe(relatorios),
      });
    } catch {
      /* arquivo ilegível fica de fora da lista */
    }
  }
  itens.sort((a, b) => b.dia.localeCompare(a.dia));
  return { pasta, itens };
}

export async function salvarHistorico(dia: string, relatorios: PacoteRelatorios): Promise<{ item: ItemHistorico; substituiu: boolean; pasta: string }> {
  const destino = arquivoDoDia(dia);
  if (!arquivosDe(relatorios).length) {
    throw new HistoricoErro('Envie ao menos uma planilha antes de salvar.');
  }
  const pasta = pastaHistorico();
  await mkdir(pasta, { recursive: true });
  let substituiu = false;
  try {
    await access(destino);
    substituiu = true;
  } catch {
    substituiu = false;
  }
  const atualizadoEm = new Date().toISOString();
  const resumo = resumoDe(relatorios);
  const corpo: Gravado = { versao: 1, dia, atualizadoEm, resumo, relatorios };
  const tmp = path.join(pasta, `.${dia}.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(corpo));
  const antigo = `${destino}.bak`;
  await rm(antigo, { force: true });
  if (substituiu) {
    try {
      await rename(destino, antigo);
    } catch {
      /* o arquivo sumiu entre a checagem e a troca */
    }
  }
  try {
    await rename(tmp, destino);
  } catch (erro) {
    await rm(tmp, { force: true });
    try {
      await access(destino);
    } catch {
      try {
        await rename(antigo, destino);
      } catch {
        /* sem cópia anterior para restaurar */
      }
    }
    throw erro;
  }
  await rm(antigo, { force: true });
  return {
    pasta,
    substituiu,
    item: { dia, atualizadoEm, resumo, arquivos: arquivosDe(relatorios) },
  };
}

export async function lerHistorico(dia: string): Promise<Gravado> {
  const destino = arquivoDoDia(dia);
  let bruto: Partial<Gravado>;
  try {
    bruto = JSON.parse(await readFile(destino, 'utf8')) as Partial<Gravado>;
  } catch {
    throw new HistoricoErro('Não encontrei essa análise neste computador.');
  }
  const relatorios = comoPacote(bruto.relatorios);
  if (!relatorios) throw new HistoricoErro('O arquivo dessa análise está incompleto.');
  return {
    versao: 1,
    dia,
    atualizadoEm: typeof bruto.atualizadoEm === 'string' ? bruto.atualizadoEm : dia,
    resumo: typeof bruto.resumo === 'string' ? bruto.resumo : resumoDe(relatorios),
    relatorios,
  };
}

export async function apagarHistorico(dia: string): Promise<void> {
  const destino = arquivoDoDia(dia);
  await rm(destino, { force: true });
  await rm(`${destino}.bak`, { force: true });
}

export async function abrirPastaHistorico(): Promise<string> {
  const pasta = pastaHistorico();
  await mkdir(pasta, { recursive: true });
  if (process.platform === 'win32') spawn('explorer', [pasta], { windowsHide: true });
  else if (process.platform === 'darwin') spawn('open', [pasta]);
  else spawn('xdg-open', [pasta]);
  return pasta;
}
