import {
  formatBRL,
  formatNum,
  formatPct,
  normChave,
  normDesc,
} from '@dash/shared';
import type { CarteiraView, GiroView, ProdutoVendido, VendasView, VendedoresView } from '@dash/shared';

export interface Resposta {
  id: string;
  pergunta: string;
  resposta: string;
  apoio: string;
  href: string;
  tom: 'bom' | 'alerta' | 'ruim' | 'neutro';
}

export function leituraGiro(view: GiroView, itens: ProdutoVendido[] | undefined): Resposta[] {
  const saida: Resposta[] = [];
  const total = view.kpis.valorVendido;
  const melhor = view.ranking.find((item) => item.valor > 0 || item.qtd > 0);
  const porQuantidade = [...view.ranking].filter((item) => item.qtd > 0).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
  const maisVolume = porQuantidade[0];
  const menos = [...porQuantidade].sort((a, b) => a.qtd - b.qtd || a.valor - b.valor)[0];

  if (melhor && total > 0) {
    saida.push({
      id: 'produto-melhor',
      pergunta: 'Qual o melhor produto?',
      resposta: melhor.nome,
      apoio: juntar([
        formatBRL(melhor.valor),
        parte(melhor.valor, total),
        `${formatNum(melhor.qtd, 0)} un.`,
        melhor.categoria,
      ]),
      href: '/giro#ranking',
      tom: 'bom',
    });
  }

  if (maisVolume && melhor && maisVolume.nome !== melhor.nome) {
    saida.push({
      id: 'produto-volume',
      pergunta: 'O que saiu em maior quantidade?',
      resposta: maisVolume.nome,
      apoio: juntar([`${formatNum(maisVolume.qtd, 0)} un.`, formatBRL(maisVolume.valor), maisVolume.categoria]),
      href: '/giro#ranking',
      tom: 'neutro',
    });
  }

  if (menos && porQuantidade.length > 1 && menos.nome !== melhor?.nome && menos.nome !== maisVolume?.nome) {
    saida.push({
      id: 'produto-menos',
      pergunta: 'Qual produto menos sai?',
      resposta: menos.nome,
      apoio: juntar([
        `${formatNum(menos.qtd, 0)} un. neste relatório`,
        formatBRL(menos.valor),
        'É o menor giro entre os que venderam',
      ]),
      href: '/giro#ranking',
      tom: 'alerta',
    });
  }

  const parado = paradoMaisTempo(view, itens);
  if (parado) {
    saida.push({
      id: 'produto-parado',
      pergunta: 'O que está parado há mais tempo sem vender?',
      resposta: parado.descricao,
      apoio: parado.nosDois
        ? juntar([
            'Sem venda neste período nem no de comparação',
            `maior valor nesse grupo: ${formatBRL(parado.valor)}`,
            `${formatNum(parado.estoque, 0)} un. em estoque`,
          ])
        : juntar([
            'Sem venda neste período, mas saiu no de comparação',
            formatBRL(parado.valor),
            'A planilha não traz a data de entrada no estoque',
          ]),
      href: '/giro#parados',
      tom: 'alerta',
    });
  }

  const ruptura = view.rupturas[0];
  if (ruptura) {
    saida.push({
      id: 'produto-ruptura',
      pergunta: 'O que pode furar o estoque?',
      resposta: ruptura.descricao,
      apoio: juntar([ruptura.motivo, formatBRL(ruptura.valorVendido), `${formatNum(ruptura.qtdVendida, 0)} un. vendidas`]),
      href: '/giro#ruptura',
      tom: 'ruim',
    });
  }

  return saida;
}

export function leituraVendas(view: VendasView): Resposta[] {
  if (!view.temVendas || view.kpis.faturamento <= 0) return [];
  const saida: Resposta[] = [];
  const vendedor = view.porVendedor[0];
  const cliente = view.porCliente[0];
  const dia = [...view.porDiaSemana].sort((a, b) => b.valor - a.valor)[0];
  const condicao = view.porCondicao[0];
  const pedido = view.maiores[0];
  const totalCondicao = view.porCondicao.reduce((acc, item) => acc + item.valor, 0);

  if (vendedor) {
    saida.push({
      id: 'vendedor-topo',
      pergunta: 'Quem vendeu mais?',
      resposta: vendedor.nome,
      apoio: juntar([formatBRL(vendedor.valor), parte(vendedor.valor, view.kpis.faturamento), `${formatNum(vendedor.pedidos, 0)} pedidos`]),
      href: '/vendas#vendedores',
      tom: 'bom',
    });
  }
  if (cliente) {
    saida.push({
      id: 'cliente-topo',
      pergunta: 'Quem comprou mais?',
      resposta: cliente.nome,
      apoio: juntar([formatBRL(cliente.valor), parte(cliente.valor, view.kpis.faturamento), `${formatNum(cliente.pedidos, 0)} pedidos`]),
      href: '/vendas#clientes',
      tom: 'neutro',
    });
  }
  if (dia && dia.valor > 0) {
    saida.push({
      id: 'venda-dia',
      pergunta: 'Qual dia da semana fatura mais?',
      resposta: dia.dia,
      apoio: juntar([formatBRL(dia.valor), parte(dia.valor, view.kpis.faturamento)]),
      href: '/vendas#semana',
      tom: 'neutro',
    });
  }
  if (condicao) {
    saida.push({
      id: 'venda-condicao',
      pergunta: 'Qual condição concentra o valor?',
      resposta: condicao.condicao,
      apoio: juntar([formatBRL(condicao.valor), parte(condicao.valor, totalCondicao), `prazo médio ${formatNum(condicao.prazo, 0)} dias`]),
      href: '/vendas#condicao',
      tom: 'neutro',
    });
  }
  if (pedido) {
    saida.push({
      id: 'venda-pedido',
      pergunta: 'Qual o maior pedido?',
      resposta: pedido.razaoSocial,
      apoio: juntar([formatBRL(pedido.total), pedido.vendedor, pedido.condicao]),
      href: '/vendas#pedidos',
      tom: 'neutro',
    });
  }
  return saida;
}

export function leituraVendedores(view: VendedoresView): Resposta[] {
  const saida: Resposta[] = [];
  const comVenda = [...view.foco].filter((item) => item.valorVendido > 0).sort((a, b) => b.valorVendido - a.valorVendido);
  const topo = comVenda[0];
  const total = view.kpis.valorVendido;
  if (topo) {
    const meta = topo.semMeta || topo.atingimento == null ? 'sem meta' : formatPct(topo.atingimento, 0) + ' da meta';
    saida.push({
      id: 'vendedor-topo',
      pergunta: 'Quem vendeu mais?',
      resposta: topo.vendedor,
      apoio: juntar([formatBRL(topo.valorVendido), parte(topo.valorVendido, total), meta]),
      href: '/vendedores#meta',
      tom: 'bom',
    });
  }

  const acima = [...view.foco]
    .filter((item) => !item.semMeta && item.atingimento != null && item.atingimento >= 100)
    .sort((a, b) => (b.atingimento ?? 0) - (a.atingimento ?? 0))[0];
  if (acima && acima.vendedor !== topo?.vendedor) {
    saida.push({
      id: 'vendedor-meta',
      pergunta: 'Quem mais passou da meta?',
      resposta: acima.vendedor,
      apoio: juntar([formatPct(acima.atingimento ?? 0, 0), formatBRL(acima.valorVendido), acima.meta != null ? `meta ${formatBRL(acima.meta)}` : null]),
      href: '/vendedores#meta',
      tom: 'bom',
    });
  }

  const longe = view.abaixo[0];
  if (longe) {
    saida.push({
      id: 'vendedor-longe',
      pergunta: 'Quem está mais longe da meta?',
      resposta: longe.vendedor,
      apoio: juntar([
        longe.previsaoAtingimento != null ? `previsão ${formatPct(longe.previsaoAtingimento, 0)}` : null,
        longe.falta != null && longe.falta > 0 ? `faltam ${formatBRL(longe.falta)}` : null,
        formatBRL(longe.valorVendido),
      ]),
      href: '/vendedores#previsao',
      tom: 'ruim',
    });
  }

  const orcamento = [...view.foco]
    .filter((item) => (item.orcamentosAbertos ?? 0) > 0)
    .sort((a, b) => (b.orcamentosAbertos ?? 0) - (a.orcamentosAbertos ?? 0))[0];
  if (orcamento) {
    saida.push({
      id: 'vendedor-orcamento',
      pergunta: 'Quem tem mais orçamento parado?',
      resposta: orcamento.vendedor,
      apoio: juntar([formatBRL(orcamento.orcamentosAbertos ?? 0), 'valor em aberto, não quantidade']),
      href: '/vendedores#orcamentos',
      tom: 'alerta',
    });
  }
  return saida;
}

export function leituraCarteira(view: CarteiraView): Resposta[] {
  const saida: Resposta[] = [];
  const cliente = view.topClientes[0];
  if (cliente && cliente.valor > 0) {
    saida.push({
      id: 'cliente-topo',
      pergunta: 'Quem comprou mais?',
      resposta: cliente.razaoSocial,
      apoio: juntar([formatBRL(cliente.valor), `${formatPct(cliente.participacao, 0)} do faturamento`, `${formatNum(cliente.pedidos, 0)} pedidos`]),
      href: '/carteira#faturamento',
      tom: 'neutro',
    });
  }

  const ligar = view.risco[0];
  if (ligar) {
    saida.push({
      id: 'cliente-ligar',
      pergunta: 'Quem ligar primeiro?',
      resposta: ligar.razaoSocial,
      apoio: juntar([
        `${formatNum(ligar.diasSemComprar, 0)} dias sem comprar`,
        `ciclo de ${formatNum(ligar.cicloMedio, 0)}`,
        ligar.valorUltimoPedido > 0 ? `último pedido ${formatBRL(ligar.valorUltimoPedido)}` : null,
        ligar.vendedor,
      ]),
      href: '/carteira#risco',
      tom: 'ruim',
    });
  }

  const distante = view.maisDistante;
  if (distante && (!ligar || normChave(distante.razaoSocial) !== normChave(ligar.razaoSocial))) {
    const situacao = distante.situacao || 'Sem situação';
    const noRisco = view.risco.some((item) => normChave(item.razaoSocial) === normChave(distante.razaoSocial));
    const naReativacao = view.reativacao.some((item) => normChave(item.razaoSocial) === normChave(distante.razaoSocial));
    saida.push({
      id: 'cliente-distante',
      pergunta: 'Quem está há mais tempo sem comprar?',
      resposta: distante.razaoSocial,
      apoio: juntar([
        situacao,
        `${formatNum(distante.diasSemComprar, 0)} dias`,
        distante.valorUltimoPedido != null ? `último pedido ${formatBRL(distante.valorUltimoPedido)}` : null,
      ]),
      href: noRisco ? '/carteira#risco' : naReativacao ? '/carteira#reativacao' : '/carteira',
      tom: 'alerta',
    });
  }

  const reativar = view.reativacao[0];
  if (reativar && (!ligar || normChave(reativar.razaoSocial) !== normChave(ligar.razaoSocial)) && (!distante || normChave(reativar.razaoSocial) !== normChave(distante.razaoSocial))) {
    saida.push({
      id: 'cliente-reativar',
      pergunta: 'Quem reativar primeiro?',
      resposta: reativar.razaoSocial,
      apoio: juntar([
        'Inativo recente',
        formatBRL(reativar.valorUltimoPedido),
        `${formatNum(reativar.diasSemComprar, 0)} dias sem comprar`,
        reativar.vendedor,
      ]),
      href: '/carteira#reativacao',
      tom: 'alerta',
    });
  }
  return saida;
}

const PRIORIDADE = [
  'produto-melhor',
  'produto-menos',
  'produto-parado',
  'vendedor-topo',
  'produto-volume',
  'cliente-topo',
  'cliente-distante',
  'vendedor-longe',
  'produto-ruptura',
  'cliente-ligar',
  'venda-dia',
  'venda-condicao',
];

export function leituraExecutivo(grupos: Resposta[][]): Resposta[] {
  const mapa = new Map<string, Resposta>();
  for (const grupo of grupos) {
    for (const item of grupo) {
      if (!mapa.has(item.id)) mapa.set(item.id, item);
    }
  }
  const melhor = mapa.get('produto-melhor');
  const volume = mapa.get('produto-volume');
  if (melhor && volume && melhor.resposta === volume.resposta) mapa.delete('produto-volume');
  const saida: Resposta[] = [];
  for (const id of PRIORIDADE) {
    const item = mapa.get(id);
    if (!item) continue;
    saida.push(item);
    if (saida.length === 6) break;
  }
  return saida;
}

export function fraseLeitura(itens: Resposta[]): string | null {
  const porId = new Map(itens.map((item) => [item.id, item]));
  const partes: string[] = [];
  const melhor = porId.get('produto-melhor');
  const vendedor = porId.get('vendedor-topo');
  const cliente = porId.get('cliente-topo');
  const parado = porId.get('produto-parado');
  const menos = porId.get('produto-menos');
  const longe = porId.get('vendedor-longe');
  const distante = porId.get('cliente-distante');
  const ligar = porId.get('cliente-ligar');
  if (melhor) partes.push(`${curto(melhor.resposta)} é o produto que mais faturou`);
  if (vendedor) partes.push(`${curto(vendedor.resposta)} foi quem mais vendeu`);
  if (parado) partes.push(`${curto(parado.resposta)} é o maior valor parado sem venda`);
  if (menos && menos.resposta !== melhor?.resposta) partes.push(`${curto(menos.resposta)} foi o que menos saiu`);
  if (cliente && cliente.resposta !== ligar?.resposta) partes.push(`${curto(cliente.resposta)} foi quem mais comprou`);
  if (longe) partes.push(`${curto(longe.resposta)} está mais longe da meta`);
  if (distante) partes.push(`${curto(distante.resposta)} está há mais tempo sem comprar`);
  if (ligar && ligar.resposta !== cliente?.resposta && ligar.resposta !== distante?.resposta) {
    partes.push(`${curto(ligar.resposta)} é o primeiro da lista de ligação`);
  }
  if (cliente && cliente.resposta === ligar?.resposta && !melhor && !vendedor && !parado) {
    partes.unshift(`${curto(cliente.resposta)} foi quem mais comprou`);
  }
  const escolhidas = partes.slice(0, 3);
  if (!escolhidas.length) return null;
  if (escolhidas.length === 1) return capitalizar(escolhidas[0]) + '.';
  const ultima = escolhidas[escolhidas.length - 1];
  return capitalizar(escolhidas.slice(0, -1).join(', ')) + ' e ' + ultima + '.';
}

function paradoMaisTempo(view: GiroView, itens: ProdutoVendido[] | undefined) {
  if (!view.parados.length) return null;
  const porNome = new Map((itens ?? []).map((item) => [normDesc(item.nome), item]));
  const ricos = view.parados.map((item) => {
    const produto = porNome.get(normDesc(item.descricao));
    const qtdComparacao = produto?.qtd2 ?? 0;
    return { ...item, nosDois: qtdComparacao <= 0 };
  });
  const longos = ricos.filter((item) => item.nosDois);
  const grupo = longos.length ? longos : ricos;
  return [...grupo].sort((a, b) => b.valor - a.valor || b.estoque - a.estoque)[0] ?? null;
}

function parte(valor: number, total: number): string | null {
  if (total <= 0) return null;
  return `${formatPct((valor / total) * 100, 0)} do valor`;
}

function juntar(partes: Array<string | null | undefined>): string {
  return partes.filter((parte): parte is string => !!parte && parte.trim().length > 0).join(' · ');
}

function curto(nome: string): string {
  const limpo = nome.replace(/\s+/g, ' ').trim();
  if (limpo.length <= 42) return limpo;
  return `${limpo.slice(0, 41).trimEnd()}…`;
}

function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
