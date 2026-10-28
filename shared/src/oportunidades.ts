import { montarCarteira } from './carteira.js';
import { montarGiro } from './giro.js';
import type { ContextoAnalise, Oportunidade } from './tipos.js';
import { montarVendas } from './vendas.js';
import { montarVendedores } from './vendedores.js';

export function listarOportunidades(ctx: ContextoAnalise): Oportunidade[] {
  const itens = [
    ...montarGiro(ctx.produtos, ctx.estoque, ctx.filtros, { coberturaMaxDias: ctx.coberturaMaxDias }).oportunidades,
    ...montarCarteira(ctx.carteira, ctx.vendas, ctx.filtros).oportunidades,
    ...montarVendedores(ctx.ranking, ctx.vendas, ctx.filtros).oportunidades,
    ...montarVendas(ctx.vendas, ctx.filtros).oportunidades,
  ];
  return dedupar(itens).sort((a, b) => b.impacto - a.impacto || peso(b.severidade) - peso(a.severidade));
}

export function principaisDoDia(oportunidades: Oportunidade[], limite = 8): Oportunidade[] {
  const comValor = oportunidades.filter((op) => op.impacto > 0);
  const extras = oportunidades.filter((op) => op.impacto <= 0 && op.severidade === 'alta');
  const saida: Oportunidade[] = [];
  const ids = new Set<string>();
  for (const op of [...comValor, ...extras]) {
    if (ids.has(op.id)) continue;
    ids.add(op.id);
    saida.push(op);
    if (saida.length >= limite) break;
  }
  return saida;
}

export function avisosDePeriodo(ctx: Pick<ContextoAnalise, 'vendas' | 'produtos' | 'ranking' | 'carteira'>): string[] {
  const mensagens: string[] = [];
  const { vendas, produtos, ranking } = ctx;
  if (vendas?.meta.periodoInicio && vendas.meta.periodoFim && produtos?.periodo1.inicio && produtos.periodo1.fim) {
    if (vendas.meta.periodoInicio !== produtos.periodo1.inicio || vendas.meta.periodoFim !== produtos.periodo1.fim) {
      mensagens.push(
        `Vendas detalhadas (${vendas.meta.origem}) não usam a mesma janela do período atual de produtos (${produtos.periodo1.rotulo}).`,
      );
    }
  }
  if (ranking?.meta.periodoInicio && ranking.meta.periodoFim && vendas?.meta.periodoInicio && vendas.meta.periodoFim) {
    const dentro =
      vendas.meta.periodoInicio >= ranking.meta.periodoInicio && vendas.meta.periodoFim <= ranking.meta.periodoFim;
    if (!dentro) {
      mensagens.push(`O ranking cobre ${ranking.meta.origem} e as vendas detalhadas cobrem ${vendas.meta.origem}.`);
    }
  }
  const referencia = ctx.carteira?.meta.referencia;
  if (referencia && vendas?.meta.periodoInicio && vendas.meta.periodoFim) {
    if (referencia < vendas.meta.periodoInicio || referencia > vendas.meta.periodoFim) {
      mensagens.push(`A carteira usa ${ctx.carteira?.meta.origem} e as vendas detalhadas cobrem ${vendas.meta.origem}.`);
    }
  }
  return mensagens;
}

function dedupar(itens: Oportunidade[]): Oportunidade[] {
  const mapa = new Map<string, Oportunidade>();
  for (const item of itens) {
    const anterior = mapa.get(item.id);
    if (!anterior || item.impacto > anterior.impacto) mapa.set(item.id, item);
  }
  return [...mapa.values()];
}

function peso(severidade: Oportunidade['severidade']): number {
  if (severidade === 'alta') return 3;
  if (severidade === 'media') return 2;
  return 1;
}
