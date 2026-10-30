import {
  avisosDePeriodo,
  filtrosVazios,
  formatBRL,
  formatData,
  formatNum,
  formatPct,
  listarOportunidades,
  montarCarteira,
  montarGiro,
  montarVendas,
  montarVendedores,
  principaisDoDia,
} from '@dash/shared';
import type { Pacote } from './store';
import { leituraCarteira, leituraExecutivo, leituraGiro, leituraVendas, leituraVendedores } from './leitura';

export interface Cartao {
  rotulo: string;
  valor: string;
  apoio: string;
}

export interface ItemLista {
  titulo: string;
  detalhe: string;
}

export interface AcaoDiretoria {
  area: string;
  impacto: string;
  titulo: string;
  detalhe: string;
}

export interface Barra {
  rotulo: string;
  valor: number;
  texto: string;
}

export interface LinhaTime {
  nome: string;
  vendido: string;
  meta: string;
  atingimento: string;
  previsao: string;
  orcamentos: string;
  ticket: string;
  clientes: string;
  tom: 'acima' | 'abaixo' | 'neutro';
}

export interface FrenteVendas {
  kpis: Cartao[];
  evolucao: string;
  semana: string;
  condicao: string;
  clientesFrase: string;
  dias: Barra[];
  faixas: Barra[];
  pedidos: ItemLista[];
  clientes: ItemLista[];
  condicoes: ItemLista[];
  vendedores: Barra[];
}

export interface FrenteTime {
  kpis: Cartao[];
  meta: string;
  orcamentos: string;
  semMeta: string;
  dispersao: string;
  prazo: string;
  linhas: LinhaTime[];
  demais: string | null;
}

export interface FrenteCarteira {
  kpis: Cartao[];
  situacao: Barra[];
  faixas: Barra[];
  risco: string;
  concentracao: string;
  mistura: string;
  ligar: ItemLista[];
  reativar: ItemLista[];
  topo: ItemLista[];
  distante: string | null;
}

export interface FrenteGiro {
  temProdutos: boolean;
  temEstoque: boolean;
  kpis: Cartao[];
  abc: string;
  variacao: string;
  parado: string;
  ruptura: string;
  representada: string;
  classes: Barra[];
  produtos: ItemLista[];
  categorias: Barra[];
  cresceram: ItemLista[];
  cairam: ItemLista[];
  parados: ItemLista[];
  rupturas: ItemLista[];
  representadas: Barra[];
}

export interface RoteiroDiretoria {
  geradoEm: string;
  periodo: string;
  origens: string[];
  avisos: string[];
  frase: string;
  numeros: Cartao[];
  secoes: string[];
  abertura: Cartao[];
  acoes: AcaoDiretoria[];
  vendas: FrenteVendas | null;
  time: FrenteTime | null;
  carteira: FrenteCarteira | null;
  giro: FrenteGiro | null;
}

const AREA: Record<string, string> = {
  giro: 'Giro',
  carteira: 'Carteira',
  vendedores: 'Time',
  vendas: 'Vendas',
};

export function montarRoteiro(relatorios: Pacote, coberturaMax: number): RoteiroDiretoria {
  const filtros = filtrosVazios;
  const giro = montarGiro(relatorios.produtos, relatorios.estoque, filtros, { coberturaMaxDias: coberturaMax });
  const vendas = montarVendas(relatorios.vendas, filtros);
  const vendedores = montarVendedores(relatorios.ranking, relatorios.vendas, filtros);
  const carteira = montarCarteira(relatorios.carteira, relatorios.vendas, filtros);
  const respostas = leituraExecutivo([
    leituraGiro(giro, relatorios.produtos?.itens),
    leituraVendedores(vendedores),
    leituraVendas(vendas),
    leituraCarteira(carteira),
  ]);
  const acoes = principaisDoDia(listarOportunidades({ ...relatorios, filtros, coberturaMaxDias: coberturaMax }), 8);
  const graves = carteira.risco.filter((cliente) => cliente.destaque);
  const ligar = (graves.length ? graves : carteira.risco).slice(0, 5);
  const comValor = vendedores.equipe.filter((vendedor) => vendedor.valorVendido > 0 || (vendedor.meta ?? 0) > 0);
  const visiveis = comValor.slice(0, 9);
  const semMetaNomes = vendedores.semMeta.map((vendedor) => vendedor.vendedor);
  const frenteVendas = frenteDeVendas(vendas);
  const frenteTime = frenteDeTime(vendedores, visiveis, comValor.length - visiveis.length, semMetaNomes);
  const frenteCarteira = frenteDeCarteira(carteira, ligar);
  const frenteGiro = frenteDeGiro(giro);
  const numeros = numerosDoPeriodo(frenteVendas, frenteTime, frenteCarteira, frenteGiro);

  return {
    geradoEm: new Date().toLocaleDateString('pt-BR'),
    periodo: vendas.origem ?? relatorios.ranking?.meta.origem ?? relatorios.produtos?.meta.origem ?? 'Período da análise',
    origens: origensDe(relatorios),
    avisos: avisosDePeriodo(relatorios).slice(0, 2),
    frase: fraseDaDiretoria(respostas) ?? 'A análise ainda não junta uma frase de abertura. Os blocos seguintes mostram o que cada arquivo liberou.',
    numeros,
    secoes: secoesDe(acoes.length > 0, frenteVendas, frenteTime, frenteCarteira, frenteGiro),
    abertura: respostas.slice(0, 6).map((item) => ({
      rotulo: item.pergunta,
      valor: corta(item.resposta, 64),
      apoio: corta(item.apoio, 96),
    })),
    acoes: acoes.map((acao) => ({
      area: AREA[acao.modulo] ?? 'Análise',
      impacto: acao.impacto > 0 ? formatBRL(acao.impacto) : 'Sem valor',
      titulo: acao.titulo,
      detalhe: corta(acao.detalhe, 150),
    })),
    vendas: frenteVendas,
    time: frenteTime,
    carteira: frenteCarteira,
    giro: frenteGiro,
  };
}

function frenteDeVendas(vendas: ReturnType<typeof montarVendas>): FrenteVendas | null {
  if (!vendas.temVendas) return null;
  const total = vendas.kpis.faturamento;
  const apoioProjecao =
    vendas.kpis.incompleto && vendas.kpis.diasDecorridos != null && vendas.kpis.diasMes != null
      ? `${formatNum(vendas.kpis.diasDecorridos, 0)} de ${formatNum(vendas.kpis.diasMes, 0)} dias`
      : vendas.kpis.incompleto
        ? 'Mês ainda aberto'
        : 'Período fechado';
  return {
    kpis: [
      { rotulo: 'Faturamento', valor: formatBRL(vendas.kpis.faturamento), apoio: pedidosDe(vendas.kpis.pedidos) },
      { rotulo: 'Projeção', valor: vendas.kpis.projecao == null ? '—' : formatBRL(vendas.kpis.projecao), apoio: apoioProjecao },
      { rotulo: 'Ticket médio', valor: vendas.kpis.ticketMedio == null ? '—' : formatBRL(vendas.kpis.ticketMedio), apoio: `${formatNum(vendas.kpis.clientes, 0)} clientes` },
      { rotulo: 'Prazo médio', valor: vendas.kpis.prazoMedio == null ? '—' : `${formatNum(vendas.kpis.prazoMedio, 0)} dias`, apoio: 'Condição dos pedidos' },
    ],
    evolucao: vendas.insights.evolucao,
    semana: vendas.insights.calor,
    condicao: vendas.insights.condicao,
    clientesFrase: vendas.insights.clientes,
    dias: vendas.porDiaSemana.map((dia) => ({ rotulo: dia.dia.slice(0, 3), valor: dia.valor, texto: formatBRL(dia.valor) })),
    faixas: vendas.faixas.map((faixa) => ({
      rotulo: faixa.rotulo,
      valor: faixa.valor,
      texto: `${formatNum(faixa.pedidos, 0)} · ${formatBRL(faixa.valor)}`,
    })),
    pedidos: vendas.maiores.slice(0, 6).map((pedido) => ({
      titulo: corta(pedido.razaoSocial, 40),
      detalhe: `${formatBRL(pedido.total)} · ${formatData(pedido.data)} · ${pedido.vendedor}`,
    })),
    clientes: vendas.porCliente.slice(0, 6).map((cliente) => ({
      titulo: corta(cliente.nome, 36),
      detalhe: `${formatBRL(cliente.valor)} · ${pedidosDe(cliente.pedidos)} · ${parte(cliente.valor, total)}`,
    })),
    condicoes: vendas.porCondicao.slice(0, 5).map((condicao) => ({
      titulo: corta(condicao.condicao, 34),
      detalhe: `${formatBRL(condicao.valor)} · ${pedidosDe(condicao.pedidos)} · ${formatNum(condicao.prazo, 0)} dias`,
    })),
    vendedores: vendas.porVendedor.slice(0, 6).map((vendedor) => ({
      rotulo: corta(vendedor.nome, 18),
      valor: vendedor.valor,
      texto: `${formatBRL(vendedor.valor)} · ${parte(vendedor.valor, total)}`,
    })),
  };
}

function frenteDeTime(
  vendedores: ReturnType<typeof montarVendedores>,
  visiveis: ReturnType<typeof montarVendedores>['equipe'],
  restantes: number,
  semMetaNomes: string[],
): FrenteTime | null {
  if (!vendedores.temRanking) return null;
  return {
    kpis: [
      {
        rotulo: 'Atingimento',
        valor: vendedores.kpis.atingimentoPonderado == null ? 'Sem meta' : formatPct(vendedores.kpis.atingimentoPonderado, 0),
        apoio: 'Ponderado pela meta',
      },
      {
        rotulo: 'Previsão',
        valor: vendedores.kpis.previsao == null ? '—' : formatBRL(vendedores.kpis.previsao),
        apoio: 'Soma de quem tem meta',
      },
      { rotulo: 'Falta', valor: formatBRL(vendedores.kpis.faltaEquipe), apoio: 'Projeção abaixo da meta' },
      { rotulo: 'Orçamentos', valor: formatBRL(vendedores.kpis.orcamentosAbertos), apoio: 'Valor em aberto' },
    ],
    meta: vendedores.insights.meta,
    orcamentos: vendedores.insights.orcamentos,
    semMeta: semMetaNomes.length ? `Sem meta: ${listaNomes(semMetaNomes)}. Ficam fora do atingimento.` : 'Todos os vendedores deste ranking têm meta.',
    dispersao: vendedores.insights.dispersao,
    prazo: vendedores.insights.prazo,
    linhas: visiveis.map((vendedor) => ({
      nome: corta(vendedor.vendedor, 22),
      vendido: formatBRL(vendedor.valorVendido),
      meta: vendedor.meta == null ? '—' : formatBRL(vendedor.meta),
      atingimento: vendedor.atingimento == null ? '—' : formatPct(vendedor.atingimento, 0),
      previsao: vendedor.previsaoAtingimento == null ? '—' : formatPct(vendedor.previsaoAtingimento, 0),
      orcamentos: vendedor.orcamentosAbertos == null ? '—' : formatBRL(vendedor.orcamentosAbertos),
      ticket: vendedor.ticketMedio == null ? '—' : formatBRL(vendedor.ticketMedio),
      clientes: vendedor.clientesPositivados == null ? '—' : formatNum(vendedor.clientesPositivados, 0),
      tom: vendedor.semMeta || vendedor.atingimento == null ? 'neutro' : vendedor.atingimento >= 100 ? 'acima' : vendedor.projetadoAbaixo ? 'abaixo' : 'neutro',
    })),
    demais: restantes > 0 ? `Mais ${restantes} ${restantes === 1 ? 'vendedor fica' : 'vendedores ficam'} fora desta tabela.` : null,
  };
}

function frenteDeCarteira(
  carteira: ReturnType<typeof montarCarteira>,
  ligar: ReturnType<typeof montarCarteira>['risco'],
): FrenteCarteira | null {
  if (!carteira.temCarteira) return null;
  return {
    kpis: [
      {
        rotulo: 'Ativos',
        valor: carteira.kpis.pctAtivos == null ? '—' : formatPct(carteira.kpis.pctAtivos, 0),
        apoio: `${formatNum(carteira.kpis.ativos, 0)} de ${formatNum(carteira.kpis.total, 0)}`,
      },
      { rotulo: 'Inativos recentes', valor: formatNum(carteira.kpis.inativosRecentes, 0), apoio: 'Reativação' },
      { rotulo: 'Inativos antigos', valor: formatNum(carteira.kpis.inativosAntigos, 0), apoio: 'Fora do ciclo recente' },
      {
        rotulo: 'Ciclo mediano',
        valor: carteira.kpis.cicloMediano == null ? '—' : `${formatNum(carteira.kpis.cicloMediano, 0)} dias`,
        apoio: 'Entre compras',
      },
      {
        rotulo: '10 maiores',
        valor: carteira.concentracaoTop10 == null ? '—' : formatPct(carteira.concentracaoTop10, 0),
        apoio: 'Do faturamento',
      },
      {
        rotulo: 'Último pedido',
        valor: carteira.kpis.valorMedioUltimo == null ? '—' : formatBRL(carteira.kpis.valorMedioUltimo),
        apoio: 'Média da carteira',
      },
    ],
    situacao: carteira.porSituacao.map((item) => ({
      rotulo: corta(item.situacao, 18),
      valor: item.clientes,
      texto: formatNum(item.clientes, 0),
    })),
    faixas: carteira.faixas.map((faixa) => ({
      rotulo: faixa.rotulo,
      valor: faixa.clientes,
      texto: formatNum(faixa.clientes, 0),
    })),
    risco: carteira.insights.risco,
    concentracao: carteira.insights.concentracao,
    mistura: carteira.temVendas
      ? `${formatNum(carteira.novos, 0)} clientes novos neste recorte e ${formatNum(carteira.recorrentes, 0)} recorrentes.`
      : 'A separação entre novo e recorrente pede as vendas detalhadas.',
    ligar: ligar.map((cliente) => ({
      titulo: corta(cliente.razaoSocial, 38),
      detalhe: `${formatNum(cliente.diasSemComprar, 0)} dias · ciclo ${formatNum(cliente.cicloMedio, 0)} · último ${formatBRL(cliente.valorUltimoPedido)}${cliente.vendedor ? ` · ${cliente.vendedor}` : ''}`,
    })),
    reativar: carteira.reativacao.slice(0, 5).map((cliente) => ({
      titulo: corta(cliente.razaoSocial, 38),
      detalhe: `${formatBRL(cliente.valorUltimoPedido)} · ${formatNum(cliente.diasSemComprar, 0)} dias${cliente.vendedor ? ` · ${cliente.vendedor}` : ''}`,
    })),
    topo: carteira.topClientes.slice(0, 6).map((cliente) => ({
      titulo: corta(cliente.razaoSocial, 36),
      detalhe: `${formatBRL(cliente.valor)} · ${pedidosDe(cliente.pedidos)} · ${formatPct(cliente.participacao, 0)}`,
    })),
    distante: carteira.maisDistante
      ? `${corta(carteira.maisDistante.razaoSocial, 42)} está há ${formatNum(carteira.maisDistante.diasSemComprar, 0)} dias sem comprar (${carteira.maisDistante.situacao})${carteira.maisDistante.valorUltimoPedido == null ? '' : `, último pedido ${formatBRL(carteira.maisDistante.valorUltimoPedido)}`}.`
      : null,
  };
}

function frenteDeGiro(giro: ReturnType<typeof montarGiro>): FrenteGiro | null {
  if (!giro.temProdutos && !giro.temEstoque) return null;
  const categorias = [...giro.categorias].sort((a, b) => b.valor - a.valor);
  const rupturas = [...giro.rupturas].sort((a, b) => (a.cobertura ?? -1) - (b.cobertura ?? -1) || b.valorVendido - a.valorVendido);
  return {
    temProdutos: giro.temProdutos,
    temEstoque: giro.temEstoque,
    kpis: [
      { rotulo: 'Valor vendido', valor: giro.temProdutos ? formatBRL(giro.kpis.valorVendido) : '—', apoio: giro.temProdutos ? `${formatNum(giro.kpis.quantidade, 0)} un.` : 'Sem produtos' },
      { rotulo: 'Valor em estoque', valor: giro.temEstoque ? formatBRL(giro.kpis.valorEstoque) : '—', apoio: giro.temEstoque ? `${formatNum(giro.kpis.itensComEstoque, 0)} itens` : 'Sem estoque' },
      { rotulo: 'Parado', valor: giro.temEstoque ? formatBRL(giro.kpis.valorParado) : '—', apoio: giro.temEstoque ? `${formatNum(giro.kpis.itensParados, 0)} itens` : 'Sem estoque' },
      { rotulo: 'Ruptura', valor: formatNum(giro.rupturas.length, 0), apoio: giro.negativos.length ? `${formatNum(giro.negativos.length, 0)} com saldo negativo` : 'Líderes com cobertura curta' },
    ],
    abc: giro.insights.abc,
    variacao: giro.insights.variacao,
    parado: giro.temEstoque ? giro.insights.parados : 'Sem o estoque, o valor parado não entra.',
    ruptura: giro.temEstoque && giro.temProdutos ? giro.insights.ruptura : 'A ruptura pede produtos e estoque juntos.',
    representada: giro.temEstoque ? giro.insights.representada : 'A representada entra com o estoque.',
    classes: giro.abcResumo.map((classe) => ({
      rotulo: `Classe ${classe.classe}`,
      valor: classe.participacao,
      texto: `${formatPct(classe.participacao, 0)} · ${formatNum(classe.itens, 0)}`,
    })),
    produtos: giro.ranking.slice(0, 6).map((produto) => ({
      titulo: corta(produto.nome, 72),
      detalhe: `${formatBRL(produto.valor)} · ${formatNum(produto.qtd, 0)} un.${produto.categoria ? ` · ${produto.categoria}` : ''}`,
    })),
    categorias: categorias.slice(0, 5).map((categoria) => ({
      rotulo: corta(categoria.nome, 16),
      valor: categoria.valor,
      texto: formatBRL(categoria.valor),
    })),
    cresceram: giro.cresceram.slice(0, 4).map((item) => ({
      titulo: corta(nomeFalado(item.nome), 34),
      detalhe: `${formatPct(item.variacao, 0)} · ${formatBRL(item.valor)}`,
    })),
    cairam: giro.cairam.slice(0, 4).map((item) => ({
      titulo: corta(nomeFalado(item.nome), 34),
      detalhe: `${formatPct(item.variacao, 0)} · ${formatBRL(item.valor)}`,
    })),
    parados: giro.parados.slice(0, 5).map((item) => ({
      titulo: corta(item.descricao, 72),
      detalhe: `${formatBRL(item.valor)} · ${formatNum(item.estoque, 0)} un.${item.cobertura == null ? '' : ` · ${formatNum(item.cobertura, 0)} dias de cobertura`}`,
    })),
    rupturas: rupturas.slice(0, 4).map((item) => ({
      titulo: corta(item.descricao, 72),
      detalhe: `${item.cobertura == null ? 'Sem saldo' : `${formatNum(item.cobertura, 0)} dias`} · vendeu ${formatBRL(item.valorVendido)} · ${formatNum(item.mediaDiaria, 1)} por dia`,
    })),
    representadas: giro.porRepresentada.slice(0, 4).map((item) => ({
      rotulo: corta(item.nome, 28),
      valor: item.valor,
      texto: formatBRL(item.valor),
    })),
  };
}

function numerosDoPeriodo(
  vendas: FrenteVendas | null,
  time: FrenteTime | null,
  carteira: FrenteCarteira | null,
  giro: FrenteGiro | null,
): Cartao[] {
  const itens: Cartao[] = [];
  if (vendas) itens.push(vendas.kpis[0], vendas.kpis[1]);
  if (time) itens.push(time.kpis[0], time.kpis[2]);
  if (giro?.temEstoque) itens.push(giro.kpis[2]);
  if (carteira) itens.push(carteira.kpis[0]);
  if (vendas) itens.push(vendas.kpis[2]);
  return itens.filter((item) => item.valor !== '—' && item.valor !== 'Sem meta').slice(0, 6);
}

function secoesDe(
  temAcoes: boolean,
  vendas: FrenteVendas | null,
  time: FrenteTime | null,
  carteira: FrenteCarteira | null,
  giro: FrenteGiro | null,
): string[] {
  const itens = ['Leitura do período'];
  if (temAcoes) itens.push('Decisões por impacto');
  if (vendas) itens.push('Ritmo, clientes e condição');
  if (time) itens.push('Meta, previsão e time');
  if (carteira) itens.push('Carteira e contas');
  if (giro) itens.push('Giro e estoque');
  itens.push('Fechamento');
  return itens;
}

function fraseDaDiretoria(itens: { id: string; resposta: string }[]): string | null {
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
  if (melhor) partes.push(`${nomeFalado(melhor.resposta)} é o produto que mais faturou`);
  if (vendedor) partes.push(`${nomeFalado(vendedor.resposta)} foi quem mais vendeu`);
  if (parado) partes.push(`${nomeFalado(parado.resposta)} é o maior valor parado sem venda`);
  if (menos && menos.resposta !== melhor?.resposta) partes.push(`${nomeFalado(menos.resposta)} foi o que menos saiu`);
  if (cliente && cliente.resposta !== ligar?.resposta) partes.push(`${nomeFalado(cliente.resposta)} foi quem mais comprou`);
  if (longe) partes.push(`${nomeFalado(longe.resposta)} está mais longe da meta`);
  if (distante) partes.push(`${nomeFalado(distante.resposta)} está há mais tempo sem comprar`);
  if (ligar && ligar.resposta !== cliente?.resposta && ligar.resposta !== distante?.resposta) {
    partes.push(`${nomeFalado(ligar.resposta)} é o primeiro da lista de ligação`);
  }
  const escolhidas = partes.slice(0, 3);
  if (!escolhidas.length) return null;
  const texto = escolhidas.length === 1 ? escolhidas[0] : `${escolhidas.slice(0, -1).join(', ')} e ${escolhidas[escolhidas.length - 1]}`;
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`;
}

function nomeFalado(nome: string): string {
  const limpo = nome.replace(/\s+/g, ' ').trim().replace(/\s+-\s+\d.*$/, '').trim();
  return limpo || nome.replace(/\s+/g, ' ').trim();
}

function origensDe(relatorios: Pacote): string[] {
  const lista = [
    relatorios.vendas?.meta.origem,
    relatorios.ranking?.meta.origem,
    relatorios.carteira?.meta.origem,
    relatorios.produtos?.meta.origem,
    relatorios.estoque?.meta.origem,
  ].filter((item): item is string => !!item && item.trim().length > 0);
  return [...new Set(lista)];
}

function listaNomes(nomes: string[]): string {
  const visiveis = nomes.slice(0, 6).join(', ');
  return nomes.length > 6 ? `${visiveis} e mais ${nomes.length - 6}` : visiveis;
}

function parte(valor: number, total: number): string {
  if (total <= 0) return '—';
  return formatPct((valor / total) * 100, 0);
}

function pedidosDe(quantidade: number): string {
  return `${formatNum(quantidade, 0)} ${quantidade === 1 ? 'pedido' : 'pedidos'}`;
}

function corta(texto: string, max: number): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= max) return limpo;
  return `${limpo.slice(0, max - 1).trimEnd()}…`;
}
