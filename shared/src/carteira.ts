import { FAIXAS_DIAS } from './catalogo.js';
import type {
  ClienteCarteira,
  Filtros,
  Oportunidade,
  RelatorioCarteira,
  RelatorioVendas,
  Venda,
} from './tipos.js';
import { normCabecalho, normChave, tituloSituacao } from './texto.js';
import { filtrarVendas } from './filtros.js';
import { formatBRL, formatPct, mediana, soma } from './numeros.js';

export interface ClienteRisco {
  chave: string;
  razaoSocial: string;
  situacao: string;
  diasSemComprar: number;
  cicloMedio: number;
  razao: number;
  valorUltimoPedido: number;
  potencial: number;
  destaque: boolean;
  vendedor: string | null;
  ultimoPedido: string;
  dataUltimoPedido: string | null;
}

export interface ClienteReativar {
  chave: string;
  razaoSocial: string;
  valorUltimoPedido: number;
  diasSemComprar: number;
  dataUltimoPedido: string | null;
  ultimoPedido: string;
  vendedor: string | null;
}

export interface ClienteFaturamento {
  razaoSocial: string;
  valor: number;
  pedidos: number;
  ticket: number;
  participacao: number;
}

export interface CarteiraView {
  temCarteira: boolean;
  temVendas: boolean;
  kpis: {
    ativos: number;
    inativosRecentes: number;
    inativosAntigos: number;
    outros: number;
    total: number;
    pctAtivos: number | null;
    valorMedioUltimo: number | null;
    cicloMediano: number | null;
  };
  porSituacao: { situacao: string; clientes: number }[];
  faixas: { rotulo: string; clientes: number }[];
  risco: ClienteRisco[];
  reativacao: ClienteReativar[];
  topClientes: ClienteFaturamento[];
  concentracaoTop10: number | null;
  novos: number;
  recorrentes: number;
  maisDistante: {
    razaoSocial: string;
    diasSemComprar: number;
    situacao: string;
    valorUltimoPedido: number | null;
  } | null;
  menoresQueHistorico: {
    razaoSocial: string;
    mediaPeriodo: number;
    referencia: number;
    pedidos: number;
  }[];
  casamento: {
    taxa: number;
    pedidos: number;
    casados: number;
    naoCasados: { razaoSocial: string; pedidos: number; valor: number }[];
  } | null;
  insights: { situacao: string; faixas: string; risco: string; concentracao: string };
  avisos: string[];
  oportunidades: Oportunidade[];
}

export function montarCarteira(
  carteira: RelatorioCarteira | null,
  vendas: RelatorioVendas | null,
  filtros: Filtros,
): CarteiraView {
  const linhas = carteira?.linhas ?? [];
  const pedidos = filtrarVendas(vendas?.linhas ?? [], filtros);
  const vendedorPorNome = mapaVendedor(pedidos);

  const passaCliente = (cliente: ClienteCarteira, ignorarSituacao = false) => {
    if (filtros.cliente && normChave(cliente.razaoSocial) !== normChave(filtros.cliente)) return false;
    if (!ignorarSituacao && filtros.situacao && normCabecalho(cliente.situacao) !== normCabecalho(filtros.situacao)) {
      return false;
    }
    if (filtros.vendedor) {
      const resp = vendedorPorNome.get(normChave(cliente.razaoSocial));
      if (!resp || normChave(resp) !== normChave(filtros.vendedor)) return false;
    }
    return true;
  };

  const base = linhas.filter((c) => passaCliente(c, true));
  const foco = linhas.filter((c) => passaCliente(c, false));
  const nomesFoco = new Set(foco.map((c) => normChave(c.razaoSocial)));
  const pedidosFoco = nomesFoco.size && (filtros.situacao || filtros.vendedor || filtros.cliente)
    ? pedidos.filter((p) => nomesFoco.has(normChave(p.razaoSocial)))
    : pedidos;

  const contagem = contarSituacoes(foco);
  const total = foco.length;
  const cicloMediano = mediana(foco.map((c) => c.cicloMedio).filter((n): n is number => n != null && n > 0));
  const valoresUltimo = foco.map((c) => c.valorUltimoPedido).filter((n): n is number => n != null);
  const valorMedioUltimo = valoresUltimo.length ? soma(valoresUltimo) / valoresUltimo.length : null;

  const porSituacao = contarSituacoes(base).lista;
  const faixas = FAIXAS_DIAS.map((faixa) => ({
    rotulo: faixa.rotulo,
    clientes: foco.filter((c) => c.diasSemComprar >= faixa.min && c.diasSemComprar <= faixa.max).length,
  }));

  const risco = foco
    .filter((c) => normCabecalho(c.situacao) === 'ativo' && c.cicloMedio != null && c.cicloMedio > 0 && c.diasSemComprar > c.cicloMedio)
    .map((c) => {
      const razao = c.diasSemComprar / (c.cicloMedio as number);
      const valor = c.valorUltimoPedido ?? 0;
      return {
        chave: c.chave,
        razaoSocial: c.razaoSocial,
        situacao: c.situacao,
        diasSemComprar: c.diasSemComprar,
        cicloMedio: c.cicloMedio as number,
        razao,
        valorUltimoPedido: valor,
        potencial: valor * razao,
        destaque: razao >= 1.5,
        vendedor: vendedorPorNome.get(normChave(c.razaoSocial)) ?? null,
        ultimoPedido: c.ultimoPedido,
        dataUltimoPedido: c.dataUltimoPedido,
      };
    })
    .sort((a, b) => b.potencial - a.potencial);

  const reativacao = foco
    .filter((c) => normCabecalho(c.situacao) === 'inativo recente')
    .map((c) => ({
      chave: c.chave,
      razaoSocial: c.razaoSocial,
      valorUltimoPedido: c.valorUltimoPedido ?? 0,
      diasSemComprar: c.diasSemComprar,
      dataUltimoPedido: c.dataUltimoPedido,
      ultimoPedido: c.ultimoPedido,
      vendedor: vendedorPorNome.get(normChave(c.razaoSocial)) ?? null,
    }))
    .sort((a, b) => b.valorUltimoPedido - a.valorUltimoPedido);

  const faturamento = faturamentoPorCliente(pedidosFoco);
  const totalFat = soma(faturamento.map((c) => c.valor));
  const topClientes = faturamento.slice(0, 10).map((c) => ({
    ...c,
    participacao: totalFat > 0 ? (c.valor / totalFat) * 100 : 0,
  }));
  const concentracaoTop10 = totalFat > 0 ? (soma(faturamento.slice(0, 10).map((c) => c.valor)) / totalFat) * 100 : null;

  const { novos, recorrentes } = classificarNovos(pedidosFoco, linhas);
  const distante = [...foco].sort(
    (a, b) => b.diasSemComprar - a.diasSemComprar || (b.valorUltimoPedido ?? 0) - (a.valorUltimoPedido ?? 0),
  )[0];
  const maisDistante = distante && distante.diasSemComprar > 0
    ? {
        razaoSocial: distante.razaoSocial,
        diasSemComprar: distante.diasSemComprar,
        situacao: distante.situacao,
        valorUltimoPedido: distante.valorUltimoPedido,
      }
    : null;
  const menoresQueHistorico = acharMenores(foco, pedidosFoco, vendas?.meta.periodoInicio ?? null);

  const casamento = carteira && vendas ? casarPedidos(vendas.linhas, linhas) : null;
  const avisos = [...(carteira?.meta.avisos ?? [])];
  if (casamento && casamento.pedidos > 0 && casamento.casados < casamento.pedidos) {
    avisos.push(
      `${formatPct((casamento.taxa) * 100, 1)} dos pedidos encontraram a razão social na carteira. ${casamento.naoCasados.length} ${casamento.naoCasados.length === 1 ? 'cliente ficou' : 'clientes ficaram'} de fora.`,
    );
  }

  const emDestaque = risco.filter((r) => r.destaque);
  const valorDestaque = soma(emDestaque.map((r) => r.valorUltimoPedido));
  const oportunidades: Oportunidade[] = [];
  if (emDestaque.length && valorDestaque > 0) {
    oportunidades.push({
      id: 'carteira-risco',
      modulo: 'carteira',
      severidade: 'alta',
      titulo: `${emDestaque.length} ${emDestaque.length === 1 ? 'cliente ativo passou' : 'clientes ativos passaram'} de 1,5× o ciclo`,
      detalhe: `No último pedido eles somam ${formatBRL(valorDestaque)}. O time consegue ligar antes que virem inativo recente.`,
      impacto: valorDestaque,
      ancora: '/carteira#risco',
    });
  } else if (risco.length) {
    oportunidades.push({
      id: 'carteira-risco',
      modulo: 'carteira',
      severidade: 'media',
      titulo: `${risco.length} ${risco.length === 1 ? 'ativo já passou' : 'ativos já passaram'} do próprio ciclo`,
      detalhe: `Ainda abaixo de 1,5×, mas o atraso soma ${formatBRL(soma(risco.map((r) => r.valorUltimoPedido)))} no último pedido.`,
      impacto: soma(risco.map((r) => r.valorUltimoPedido)),
      ancora: '/carteira#risco',
    });
  }
  const valorReativacao = soma(reativacao.map((r) => r.valorUltimoPedido));
  if (reativacao.length && valorReativacao > 0) {
    oportunidades.push({
      id: 'carteira-reativacao',
      modulo: 'carteira',
      severidade: 'alta',
      titulo: `${reativacao.length} ${reativacao.length === 1 ? 'inativo recente' : 'inativos recentes'} para reativar`,
      detalhe: `O último pedido desses clientes soma ${formatBRL(valorReativacao)}. Comece pelos maiores.`,
      impacto: valorReativacao,
      ancora: '/carteira#reativacao',
    });
  }
  if (concentracaoTop10 != null && concentracaoTop10 >= 40 && topClientes.length) {
    oportunidades.push({
      id: 'concentracao-clientes',
      modulo: 'carteira',
      severidade: concentracaoTop10 >= 60 ? 'alta' : 'media',
      titulo: `Os 10 maiores concentram ${formatPct(concentracaoTop10, 0)} do faturamento`,
      detalhe: `${topClientes[0].razaoSocial} lidera com ${formatBRL(topClientes[0].valor)}. Vale um plano se algum deles esfriar.`,
      impacto: topClientes[0].valor,
      ancora: '/carteira#faturamento',
    });
  }

  const maiorFaixa = [...faixas].sort((a, b) => b.clientes - a.clientes)[0];
  return {
    temCarteira: !!carteira,
    temVendas: !!vendas,
    kpis: {
      ativos: contagem.ativos,
      inativosRecentes: contagem.inativosRecentes,
      inativosAntigos: contagem.inativosAntigos,
      outros: contagem.outros,
      total,
      pctAtivos: total > 0 ? (contagem.ativos / total) * 100 : null,
      valorMedioUltimo,
      cicloMediano,
    },
    porSituacao,
    faixas,
    risco,
    reativacao,
    topClientes,
    concentracaoTop10,
    novos,
    recorrentes,
    maisDistante,
    menoresQueHistorico,
    casamento,
    insights: {
      situacao: total
        ? `${formatPct(total > 0 ? (contagem.ativos / total) * 100 : 0, 0)} da carteira deste recorte está ativa (${contagem.ativos} de ${total}).`
        : 'Nenhum cliente no recorte.',
      faixas: maiorFaixa && maiorFaixa.clientes > 0
        ? `A faixa ${maiorFaixa.rotulo} dias concentra ${maiorFaixa.clientes} clientes.`
        : 'Sem dias sem comprar para montar o histograma.',
      risco: emDestaque.length
        ? `${emDestaque.length} ativos passaram de 1,5× o ciclo e somam ${formatBRL(valorDestaque)} no último pedido.`
        : risco.length
          ? `${risco.length} ativos já passaram do ciclo médio, ainda abaixo de 1,5×.`
          : 'Nenhum ativo ultrapassou o próprio ciclo de compra.',
      concentracao: concentracaoTop10 == null
        ? 'Falta a planilha de vendas detalhadas para ver concentração.'
        : `Os 10 maiores clientes concentram ${formatPct(concentracaoTop10, 0)} do faturamento deste recorte.`,
    },
    avisos,
    oportunidades,
  };
}

function contarSituacoes(linhas: ClienteCarteira[]) {
  let ativos = 0;
  let inativosRecentes = 0;
  let inativosAntigos = 0;
  let outros = 0;
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    const situacao = tituloSituacao(linha.situacao);
    mapa.set(situacao, (mapa.get(situacao) ?? 0) + 1);
    const n = normCabecalho(situacao);
    if (n === 'ativo') ativos += 1;
    else if (n === 'inativo recente') inativosRecentes += 1;
    else if (n === 'inativo antigo') inativosAntigos += 1;
    else outros += 1;
  }
  const ordem = ['Ativo', 'Inativo recente', 'Inativo antigo'];
  const lista = [...mapa.entries()]
    .map(([situacao, clientes]) => ({ situacao, clientes }))
    .sort((a, b) => {
      const ia = ordem.indexOf(a.situacao);
      const ib = ordem.indexOf(b.situacao);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  return { ativos, inativosRecentes, inativosAntigos, outros, lista };
}

function mapaVendedor(pedidos: Venda[]): Map<string, string> {
  const cont = new Map<string, Map<string, { nome: string; n: number }>>();
  for (const pedido of pedidos) {
    const cliente = normChave(pedido.razaoSocial);
    const vend = normChave(pedido.vendedor);
    const mapa = cont.get(cliente) ?? new Map<string, { nome: string; n: number }>();
    const atual = mapa.get(vend) ?? { nome: pedido.vendedor, n: 0 };
    atual.n += 1;
    mapa.set(vend, atual);
    cont.set(cliente, mapa);
  }
  const saida = new Map<string, string>();
  for (const [cliente, mapa] of cont) {
    const top = [...mapa.values()].sort((a, b) => b.n - a.n)[0];
    if (top) saida.set(cliente, top.nome);
  }
  return saida;
}

function faturamentoPorCliente(pedidos: Venda[]): { razaoSocial: string; valor: number; pedidos: number; ticket: number }[] {
  const mapa = new Map<string, { nome: string; valor: number; pedidos: number }>();
  for (const pedido of pedidos) {
    const chave = normChave(pedido.razaoSocial);
    const atual = mapa.get(chave) ?? { nome: pedido.razaoSocial, valor: 0, pedidos: 0 };
    atual.valor += pedido.total;
    atual.pedidos += 1;
    if (pedido.razaoSocial.length > atual.nome.length) atual.nome = pedido.razaoSocial;
    mapa.set(chave, atual);
  }
  return [...mapa.values()]
    .map((c) => ({ razaoSocial: c.nome, valor: c.valor, pedidos: c.pedidos, ticket: c.pedidos ? c.valor / c.pedidos : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

function classificarNovos(pedidos: Venda[], carteira: ClienteCarteira[]) {
  const ciclos = new Set(
    carteira.filter((c) => c.cicloMedio != null && c.cicloMedio > 0).map((c) => normChave(c.razaoSocial)),
  );
  const grupos = new Map<string, number>();
  for (const pedido of pedidos) {
    const chave = normChave(pedido.razaoSocial);
    grupos.set(chave, (grupos.get(chave) ?? 0) + 1);
  }
  let novos = 0;
  let recorrentes = 0;
  for (const [chave, qtd] of grupos) {
    if (qtd >= 2 || ciclos.has(chave)) recorrentes += 1;
    else novos += 1;
  }
  return { novos, recorrentes };
}

function acharMenores(clientes: ClienteCarteira[], pedidos: Venda[], inicioPeriodo: string | null) {
  const porNome = new Map<string, Venda[]>();
  for (const pedido of pedidos) {
    const chave = normChave(pedido.razaoSocial);
    porNome.set(chave, [...(porNome.get(chave) ?? []), pedido]);
  }
  const saida: CarteiraView['menoresQueHistorico'] = [];
  for (const cliente of clientes) {
    const referencia = cliente.valorUltimoPedido;
    if (referencia == null || referencia <= 0) continue;
    const doCliente = porNome.get(normChave(cliente.razaoSocial)) ?? [];
    if (!doCliente.length) continue;
    const anteriorAoPeriodo = !!(cliente.dataUltimoPedido && inicioPeriodo && cliente.dataUltimoPedido < inicioPeriodo);
    const base = anteriorAoPeriodo ? doCliente : doCliente.filter((p) => p.pedido !== cliente.ultimoPedido);
    if (!base.length) continue;
    const media = soma(base.map((p) => p.total)) / base.length;
    if (media < referencia * 0.7) {
      saida.push({
        razaoSocial: cliente.razaoSocial,
        mediaPeriodo: media,
        referencia,
        pedidos: base.length,
      });
    }
  }
  return saida.sort((a, b) => b.referencia - a.referencia);
}

function casarPedidos(pedidos: Venda[], carteira: ClienteCarteira[]) {
  const nomes = new Set(carteira.map((c) => normChave(c.razaoSocial)));
  const soltos = new Map<string, { razaoSocial: string; pedidos: number; valor: number }>();
  let casados = 0;
  for (const pedido of pedidos) {
    if (nomes.has(normChave(pedido.razaoSocial))) {
      casados += 1;
      continue;
    }
    const chave = normChave(pedido.razaoSocial);
    const atual = soltos.get(chave) ?? { razaoSocial: pedido.razaoSocial, pedidos: 0, valor: 0 };
    atual.pedidos += 1;
    atual.valor += pedido.total;
    soltos.set(chave, atual);
  }
  return {
    taxa: pedidos.length ? casados / pedidos.length : 1,
    pedidos: pedidos.length,
    casados,
    naoCasados: [...soltos.values()].sort((a, b) => b.valor - a.valor),
  };
}
