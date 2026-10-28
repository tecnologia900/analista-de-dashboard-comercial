import type { TipoRelatorio } from '@dash/shared';

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
  await fetch('/api/sessao', { method: 'DELETE' });
}

export async function removerRemoto(tipo: TipoRelatorio) {
  await fetch(`/api/sessao/relatorios/${tipo}`, { method: 'DELETE' });
}
