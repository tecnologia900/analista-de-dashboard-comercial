import type { TipoRelatorio } from '@dash/shared';
import type { Pacote } from './store';

export interface RespostaUpload {
  ok: boolean;
  codigo?: string;
  mensagem?: string;
  detectado?: TipoRelatorio;
  relatorio?: import('@dash/shared').Relatorio;
}

export async function enviarArquivo(arquivo: File, slot: TipoRelatorio | 'auto', confirmar = false): Promise<RespostaUpload> {
  const corpo = new FormData();
  corpo.set('slot', slot);
  corpo.set('confirmar', confirmar ? '1' : '0');
  corpo.set('arquivo', arquivo);
  const resposta = await fetch('/api/arquivos', { method: 'POST', body: corpo });
  return resposta.json() as Promise<RespostaUpload>;
}

export async function limparSessaoRemota() {
  const resposta = await fetch('/api/sessao', { method: 'DELETE' });
  if (!resposta.ok) throw new Error('Não consegui limpar a sessão.');
}

export async function removerRemoto(tipo: TipoRelatorio) {
  await fetch(`/api/sessao/relatorios/${tipo}`, { method: 'DELETE' });
}

export interface ItemHistorico {
  dia: string;
  atualizadoEm: string;
  resumo: string;
  arquivos: TipoRelatorio[];
}

export interface RespostaHistorico {
  ok: boolean;
  mensagem?: string;
  pasta?: string;
  substituiu?: boolean;
  item?: ItemHistorico;
  itens?: ItemHistorico[];
  relatorios?: Pacote;
}

export async function listarHistorico(): Promise<RespostaHistorico> {
  const resposta = await fetch('/api/historico');
  return resposta.json() as Promise<RespostaHistorico>;
}

export async function salvarHistorico(dia: string, relatorios: Pacote): Promise<RespostaHistorico> {
  const resposta = await fetch('/api/historico', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dia, relatorios }),
  });
  if (resposta.status === 413) {
    return { ok: false, mensagem: 'A análise está grande demais para gravar de uma vez.' };
  }
  return resposta.json() as Promise<RespostaHistorico>;
}

export async function abrirHistorico(dia: string): Promise<RespostaHistorico> {
  const resposta = await fetch(`/api/historico/${dia}/abrir`, { method: 'POST' });
  return resposta.json() as Promise<RespostaHistorico>;
}

export async function apagarHistorico(dia: string): Promise<RespostaHistorico> {
  const resposta = await fetch(`/api/historico/${dia}`, { method: 'DELETE' });
  return resposta.json() as Promise<RespostaHistorico>;
}

export async function abrirPastaHistorico(): Promise<RespostaHistorico> {
  const resposta = await fetch('/api/historico/pasta', { method: 'POST' });
  return resposta.json() as Promise<RespostaHistorico>;
}
