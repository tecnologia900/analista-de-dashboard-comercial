/** Comparação de cabeçalho: sem acento, sem caixa, espaços colapsados. */
export function normCabecalho(valor: string): string {
  return semAcento(valor).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Chave de cruzamento (vendedor, razão social): maiúsculas, sem acento. */
export function normChave(valor: string): string {
  return semAcento(valor).toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Descrição de produto: trim, espaços colapsados, sem acento e sem caixa. */
export function normDesc(valor: string): string {
  return semAcento(valor).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function tituloSituacao(valor: string): string {
  const n = normCabecalho(valor);
  if (n === 'ativo') return 'Ativo';
  if (n === 'inativo recente') return 'Inativo recente';
  if (n === 'inativo antigo') return 'Inativo antigo';
  const limpo = valor.trim();
  return limpo || 'Sem situação';
}

export interface VarianteItem {
  base: string;
  variante: 'DIR' | 'IND';
  codigo: string;
  par: string;
}

const RX_VARIANTE = /^(.*?)\s+IMP\s+(DIR|IND)\s*-\s*(\d+)\s*\/\s*(\d+)\s*$/i;

/** `NOME IMP DIR - 868 / 462` → código próprio e código do par. */
export function parseVariante(descricao: string): VarianteItem | null {
  const m = descricao.trim().match(RX_VARIANTE);
  if (!m) return null;
  const variante = m[2].toUpperCase() === 'IND' ? 'IND' : 'DIR';
  return {
    base: m[1].trim(),
    variante,
    codigo: m[3],
    par: m[4],
  };
}

export function chavePar(variante: VarianteItem): string {
  const [a, b] = [variante.codigo, variante.par].sort();
  return `${normDesc(variante.base)}|${a}-${b}`;
}
