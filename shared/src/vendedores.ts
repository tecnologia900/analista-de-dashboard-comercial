import { filtrarVendas } from './filtros.js';
import {
  diasInclusivos,
  diasNoMes,
  fimDoMes,
  formatBRL,
  formatNum,
  formatPct,
  inicioDoMes,
  mediana,
  soma,
} from './numeros.js';
import { normChave } from './texto.js';
import type {
  Filtros,
  MetaRelatorio,
  Oportunidade,
  RelatorioRanking,
  RelatorioVendas,
  Venda,
  VendedorRanking,
} from './tipos.js';

export interface VendedorVisao {
  vendedor: string;
  atingimento: number | null;
  valorVendido: number;
  ticketMedio: number | null;
  clientesPositivados: number | null;
  meta: number | null;
  previsaoVendas: number | null;
  previsaoAtingimento: number | null;
  qtdOrcamentos: number | null;
  orcamentosAbertos: number | null;
  semMeta: boolean;
  falta: number | null;
  projetadoAbaixo: boolean;
  pedidos: number;
}

export interface VendedoresView {
  temRanking: boolean;
  temVendas: boolean;
  kpis: {
    valorVendido: number;
    atingimentoPonderado: number | null;
    ticketMedio: number | null;
    clientesPositivados: number;
    orcamentosAbertos: number;
    previsao: number | null;
    faltaEquipe: number;
  };
  equipe: VendedorVisao[];
  foco: VendedorVisao[];
  semMeta: VendedorVisao[];
  abaixo: VendedorVisao[];
  evolucao: { data: string; vendedor: string; valor: number }[];
  condicoes: { condicao: string; valor: number; pedidos: number; prazo: number }[];
  prazoMedio: number | null;
  prazoPorVendedor: { vendedor: string; prazo: number; valor: number }[];
  dispersao: { vendedor: string; ticket: number; clientes: number; valor: number }[];
  casamento: { taxa: number; soRanking: string[]; soVendas: string[] } | null;
  insights: { meta: string; orcamentos: string; dispersao: string; prazo: string };
  avisos: string[];
  oportunidades: Oportunidade[];
}

export function montarVendedores(
  ranking: RelatorioRanking | null,
  vendas: RelatorioVendas | null,
  filtros: Filtros,
): VendedoresView {
  const oficiais = ranking?.linhas ?? [];
  const pedidosComparacao = filtrarVendas(vendas?.linhas ?? [], {
    vendedor: null,
    cliente: filtros.cliente,
    condicao: null,
  });
  const pedidosVisao = filtrarVendas(vendas?.linhas ?? [], {
    vendedor: filtros.vendedor,
    cliente: filtros.cliente,
    condicao: filtros.condicao,
  });
  const pedidosCondicao = filtrarVendas(vendas?.linhas ?? [], {
    vendedor: filtros.vendedor,
    cliente: filtros.cliente,
    condicao: null,
  });

  const equipe = enriquecer(oficiais, vendas?.linhas ?? [], vendas?.meta ?? null);
  const foco = filtros.vendedor
    ? equipe.filter((v) => normChave(v.vendedor) === normChave(filtros.vendedor!))
    : equipe;
  const comMeta = foco.filter((v) => !v.semMeta && v.meta != null && v.meta > 0);
  const metaTotal = soma(comMeta.map((v) => v.meta));
  const vendidoMeta = soma(comMeta.map((v) => v.valorVendido));
  const atingimentoPonderado = metaTotal > 0 ? (vendidoMeta / metaTotal) * 100 : null;
  const previsoes = comMeta.map((v) => v.previsaoVendas).filter((n): n is number => n != null);
  const faltas = foco.map((v) => (v.projetadoAbaixo && v.falta != null && v.falta > 0 ? v.falta : 0));

  const ticketBase = pedidosVisao.length
    ? soma(pedidosVisao.map((p) => p.total)) / pedidosVisao.length
    : mediaSimples(foco.map((v) => v.ticketMedio));
  const positivos = soma(foco.map((v) => v.clientesPositivados));

  const semMeta = equipe.filter((v) => v.semMeta);
  const abaixo = foco.filter((v) => v.projetadoAbaixo).sort((a, b) => (b.falta ?? 0) - (a.falta ?? 0));

  const evolucao = pedidosVisao
    .filter((p) => p.data)
    .map((p) => ({ data: p.data as string, vendedor: p.vendedor, valor: p.total }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const condicoes = agruparCondicao(pedidosCondicao);
  const prazoMedio = pedidosCondicao.length ? soma(pedidosCondicao.map((p) => p.prazoMedio)) / pedidosCondicao.length : null;
  const prazoPorVendedor = agruparPrazo(pedidosComparacao);
  const dispersao = equipe
    .filter((v) => v.ticketMedio != null && v.clientesPositivados != null)
    .map((v) => ({
      vendedor: v.vendedor,
      ticket: v.ticketMedio as number,
      clientes: v.clientesPositivados as number,
      valor: v.valorVendido,
    }));

  const casamento = ranking && vendas ? casarNomes(oficiais, vendas.linhas) : null;
  const avisos = [...(ranking?.meta.avisos ?? []), ...(vendas?.meta.avisos ?? [])];
  if (casamento && casamento.soRanking.length) {
    avisos.push(
      `${casamento.soRanking.join(', ')} ${casamento.soRanking.length === 1 ? 'está no ranking e não tem pedido' : 'estão no ranking e não têm pedido'} nas vendas carregadas.`,
    );
  }
  if (casamento && casamento.soVendas.length) {
    avisos.push(`${casamento.soVendas.join(', ')} venderam e não aparecem no ranking.`);
  }

  const oportunidades = oportunidadesVendedores(foco, equipe);
  const piorPrazo = [...prazoPorVendedor].sort((a, b) => b.prazo - a.prazo)[0];

  return {
    temRanking: !!ranking,
    temVendas: !!vendas,
    kpis: {
      valorVendido: soma(foco.map((v) => v.valorVendido)),
      atingimentoPonderado,
      ticketMedio: ticketBase,
      clientesPositivados: positivos,
      orcamentosAbertos: soma(foco.map((v) => v.orcamentosAbertos)),
      previsao: previsoes.length ? soma(previsoes) : null,
      faltaEquipe: soma(faltas),
    },
    equipe,
    foco,
    semMeta,
    abaixo,
    evolucao,
    condicoes,
    prazoMedio,
    prazoPorVendedor,
    dispersao,
    casamento,
    insights: {
      meta:
        atingimentoPonderado == null
          ? 'Não há meta preenchida neste recorte para calcular atingimento.'
          : `A equipe selecionada está em ${formatPct(atingimentoPonderado, 0)} da meta, ponderado pelo valor da meta.`,
      orcamentos: soma(foco.map((v) => v.orcamentosAbertos)) > 0
        ? `${formatBRL(soma(foco.map((v) => v.orcamentosAbertos)))} ainda estão em orçamento aberto.`
        : 'Não há valor em orçamento aberto neste recorte.',
      dispersao: insightDispersao(dispersao),
      prazo: piorPrazo
        ? `${piorPrazo.vendedor} concede o maior prazo médio (${formatNum(piorPrazo.prazo, 0)} dias).`
        : 'Sem pedidos para calcular prazo por vendedor.',
    },
    avisos: [...new Set(avisos)],
    oportunidades,
  };
}

function enriquecer(oficiais: VendedorRanking[], pedidos: Venda[], meta: MetaRelatorio | null): VendedorVisao[] {
  const porChave = new Map<string, Venda[]>();
  for (const pedido of pedidos) {
    const chave = normChave(pedido.vendedor);
    porChave.set(chave, [...(porChave.get(chave) ?? []), pedido]);
  }
  const nomes = new Map<string, string>();
  for (const linha of oficiais) nomes.set(normChave(linha.vendedor), linha.vendedor);
  for (const [chave, lista] of porChave) if (!nomes.has(chave) && lista[0]) nomes.set(chave, lista[0].vendedor);

  const ritmo = ritmoDoPeriodo(meta);
  return [...nomes.entries()]
    .map(([chave, nome]) => {
      const oficial = oficiais.find((l) => normChave(l.vendedor) === chave);
      const meus = porChave.get(chave) ?? [];
      const semMeta = oficial ? oficial.semMeta || oficial.meta == null || oficial.meta <= 0 : true;
      const metaValor = semMeta ? null : oficial?.meta ?? null;
      let previsao = oficial?.previsaoVendas ?? null;
      if (previsao == null && ritmo && oficial && !semMeta) {
        previsao = (oficial.valorVendido / ritmo.decorridos) * ritmo.diasMes;
      }
      const previsaoAting =
        semMeta || metaValor == null || previsao == null
          ? null
          : (oficial?.previsaoAtingimento ?? (previsao / metaValor) * 100);
      const falta = metaValor != null && previsao != null ? metaValor - previsao : null;
      const projetadoAbaixo = !semMeta && ((previsaoAting != null && previsaoAting < 100) || (falta != null && falta > 0 && previsaoAting == null));
      const valorPedidos = soma(meus.map((p) => p.total));
      return {
        vendedor: oficial?.vendedor ?? nome,
        atingimento: semMeta ? null : (oficial?.atingimento ?? (metaValor ? ((oficial?.valorVendido ?? valorPedidos) / metaValor) * 100 : null)),
        valorVendido: oficial?.valorVendido ?? valorPedidos,
        ticketMedio: oficial?.ticketMedio ?? (meus.length ? valorPedidos / meus.length : null),
        clientesPositivados: oficial?.clientesPositivados ?? (meus.length ? new Set(meus.map((p) => normChave(p.razaoSocial))).size : null),
        meta: metaValor,
        previsaoVendas: previsao,
        previsaoAtingimento: previsaoAting,
        qtdOrcamentos: oficial?.qtdOrcamentos ?? null,
        orcamentosAbertos: oficial?.orcamentosAbertos ?? null,
        semMeta,
        falta: semMeta ? null : falta,
        projetadoAbaixo,
        pedidos: meus.length,
      };
    })
    .sort((a, b) => b.valorVendido - a.valorVendido || a.vendedor.localeCompare(b.vendedor, 'pt-BR'));
}

function ritmoDoPeriodo(meta: MetaRelatorio | null): { decorridos: number; diasMes: number } | null {
  if (!meta?.periodoInicio || !meta.periodoFim) return null;
  if (meta.periodoInicio.slice(0, 7) !== meta.periodoFim.slice(0, 7)) return null;
  const fimMes = fimDoMes(meta.periodoFim);
  if (meta.periodoFim >= fimMes && meta.periodoInicio <= inicioDoMes(meta.periodoFim)) return null;
  return {
    decorridos: Math.max(1, diasInclusivos(meta.periodoInicio, meta.periodoFim)),
    diasMes: diasNoMes(meta.periodoFim),
  };
}

function agruparCondicao(pedidos: Venda[]) {
  const mapa = new Map<string, { valor: number; pedidos: Venda[] }>();
  for (const pedido of pedidos) {
    const chave = pedido.condicao || 'Sem condição';
    const atual = mapa.get(chave) ?? { valor: 0, pedidos: [] };
    atual.valor += pedido.total;
    atual.pedidos.push(pedido);
    mapa.set(chave, atual);
  }
  return [...mapa.entries()]
    .map(([condicao, info]) => ({
      condicao,
      valor: info.valor,
      pedidos: info.pedidos.length,
      prazo: info.pedidos.length ? soma(info.pedidos.map((p) => p.prazoMedio)) / info.pedidos.length : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
}

function agruparPrazo(pedidos: Venda[]) {
  const mapa = new Map<string, { nome: string; valor: number; prazos: number[] }>();
  for (const pedido of pedidos) {
    const chave = normChave(pedido.vendedor);
    const atual = mapa.get(chave) ?? { nome: pedido.vendedor, valor: 0, prazos: [] };
    atual.valor += pedido.total;
    atual.prazos.push(pedido.prazoMedio);
    mapa.set(chave, atual);
  }
  return [...mapa.values()]
    .map((v) => ({
      vendedor: v.nome,
      prazo: v.prazos.length ? soma(v.prazos) / v.prazos.length : 0,
      valor: v.valor,
    }))
    .sort((a, b) => b.prazo - a.prazo);
}

function casarNomes(ranking: VendedorRanking[], pedidos: Venda[]) {
  const nomesRanking = new Map<string, string>();
  for (const linha of ranking) nomesRanking.set(normChave(linha.vendedor), linha.vendedor);
  const nomesVendas = new Map<string, string>();
  for (const pedido of pedidos) nomesVendas.set(normChave(pedido.vendedor), pedido.vendedor);
  const soRanking = [...nomesRanking.entries()].filter(([chave]) => !nomesVendas.has(chave)).map(([, nome]) => nome);
  const soVendas = [...nomesVendas.entries()].filter(([chave]) => !nomesRanking.has(chave)).map(([, nome]) => nome);
  const casados = [...nomesRanking.keys()].filter((chave) => nomesVendas.has(chave)).length;
  return {
    taxa: nomesRanking.size ? casados / nomesRanking.size : 1,
    soRanking,
    soVendas,
  };
}

function oportunidadesVendedores(foco: VendedorVisao[], equipe: VendedorVisao[]): Oportunidade[] {
  const lista: Oportunidade[] = [];
  const abertos = soma(foco.map((v) => v.orcamentosAbertos));
  if (abertos > 0) {
    const top = [...foco].sort((a, b) => (b.orcamentosAbertos ?? 0) - (a.orcamentosAbertos ?? 0))[0];
    lista.push({
      id: 'orcamentos-abertos',
      modulo: 'vendedores',
      severidade: 'alta',
      titulo: `${formatBRL(abertos)} em orçamentos ainda abertos`,
      detalhe: top?.orcamentosAbertos
        ? `${top.vendedor} concentra ${formatBRL(top.orcamentosAbertos)}. Dá para cobrar o fechamento hoje.`
        : 'Há valor parado em orçamento.',
      impacto: abertos,
      ancora: '/vendedores#orcamentos',
    });
  }
  const abaixo = foco.filter((v) => v.projetadoAbaixo && (v.falta ?? 0) > 0);
  if (abaixo.length) {
    const falta = soma(abaixo.map((v) => v.falta));
    lista.push({
      id: 'abaixo-da-meta',
      modulo: 'vendedores',
      severidade: 'alta',
      titulo: `${abaixo.length === 1 ? '1 vendedor projetado' : `${abaixo.length} vendedores projetados`} abaixo da meta`,
      detalhe: `Faltam ${formatBRL(falta)}. ${abaixo.slice(0, 3).map((v) => v.vendedor).join(', ')}.`,
      impacto: falta,
      ancora: '/vendedores#previsao',
    });
  }

  const baseTicket = equipe.filter((v) => v.ticketMedio != null && v.pedidos > 0);
  const mediaTicket = baseTicket.length ? soma(baseTicket.map((v) => v.ticketMedio)) / baseTicket.length : null;
  if (mediaTicket && mediaTicket > 0) {
    const pior = foco
      .filter((v) => v.ticketMedio != null && v.ticketMedio < mediaTicket * 0.75 && v.pedidos >= 3)
      .sort((a, b) => (a.ticketMedio ?? 0) - (b.ticketMedio ?? 0))[0];
    if (pior?.ticketMedio != null) {
      const impacto = Math.max(0, (mediaTicket - pior.ticketMedio) * pior.pedidos);
      lista.push({
        id: 'ticket-baixo',
        modulo: 'vendedores',
        severidade: 'media',
        titulo: `${pior.vendedor} está com ticket abaixo da equipe`,
        detalhe: `Ticket de ${formatBRL(pior.ticketMedio)} contra ${formatBRL(mediaTicket)} da média. A diferença, neste volume, é cerca de ${formatBRL(impacto)}.`,
        impacto,
        ancora: '/vendedores#dispersao',
      });
    }
  }

  const positivos = equipe.map((v) => v.clientesPositivados).filter((n): n is number => n != null);
  const medianaPos = mediana(positivos);
  if (medianaPos && medianaPos > 0) {
    const pior = foco
      .filter((v) => v.clientesPositivados != null && v.clientesPositivados < medianaPos * 0.6 && v.valorVendido > 0)
      .sort((a, b) => (a.clientesPositivados ?? 0) - (b.clientesPositivados ?? 0))[0];
    if (pior?.clientesPositivados != null && pior.ticketMedio != null) {
      const gap = Math.max(0, medianaPos - pior.clientesPositivados);
      lista.push({
        id: 'positivacao-baixa',
        modulo: 'vendedores',
        severidade: 'media',
        titulo: `${pior.vendedor} positiva poucos clientes`,
        detalhe: `${formatNum(pior.clientesPositivados, 0)} clientes contra mediana de ${formatNum(medianaPos, 0)}. Estimativa se chegasse à mediana: ${formatBRL(gap * pior.ticketMedio)}.`,
        impacto: gap * pior.ticketMedio,
        ancora: '/vendedores#dispersao',
      });
    }
  }
  return lista;
}

function insightDispersao(pontos: { vendedor: string; ticket: number; clientes: number }[]): string {
  if (pontos.length < 2) return 'Com mais de um vendedor, o gráfico separa quem vende muito para poucos de quem espalha pedidos.';
  const porTicket = [...pontos].sort((a, b) => b.ticket - a.ticket)[0];
  const porClientes = [...pontos].sort((a, b) => b.clientes - a.clientes)[0];
  if (porTicket.vendedor === porClientes.vendedor) {
    return `${porTicket.vendedor} lidera ticket e positivação neste recorte.`;
  }
  return `${porTicket.vendedor} tem o maior ticket; ${porClientes.vendedor} positiva mais clientes.`;
}

function mediaSimples(nums: Array<number | null>): number | null {
  const ok = nums.filter((n): n is number => n != null && Number.isFinite(n));
  if (!ok.length) return null;
  return soma(ok) / ok.length;
}
