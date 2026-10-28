import type { Filtros, Venda } from './tipos.js';
import { normChave } from './texto.js';

export function filtrarVendas(linhas: Venda[], filtros: Pick<Filtros, 'vendedor' | 'cliente' | 'condicao'>): Venda[] {
  return linhas.filter((venda) => {
    if (filtros.vendedor && normChave(venda.vendedor) !== normChave(filtros.vendedor)) return false;
    if (filtros.cliente && normChave(venda.razaoSocial) !== normChave(filtros.cliente)) return false;
    if (filtros.condicao && venda.condicao !== filtros.condicao) return false;
    return true;
  });
}
