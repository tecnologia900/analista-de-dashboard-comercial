import type { ObjetivoId, TipoRelatorio } from './tipos.js';

export interface ColunaEsperada {
  chave: string;
  rotulo: string;
  aliases?: string[];
}

export interface DefRelatorio {
  tipo: TipoRelatorio;
  titulo: string;
  arquivo: string;
  resumo: string;
  colunas: string[];
  esperadas: ColunaEsperada[];
}

export const RELATORIOS: Record<TipoRelatorio, DefRelatorio> = {
  vendas: {
    tipo: 'vendas',
    titulo: 'Vendas detalhadas',
    arquivo: 'Relatório de Vendas (.xls)',
    resumo: 'Uma linha por pedido, com cliente, vendedor e condição de pagamento.',
    colunas: [
      'Data de emissão',
      'Pedido',
      'Razão Social',
      'Nome Fantasia',
      'Vendedor(a)',
      'Condição de pagamento',
      'Total do pedido',
    ],
    esperadas: [
      { chave: 'data', rotulo: 'Data de emissão' },
      { chave: 'pedido', rotulo: 'Pedido' },
      { chave: 'razao', rotulo: 'Razão Social' },
      { chave: 'fantasia', rotulo: 'Nome Fantasia' },
      { chave: 'vendedor', rotulo: 'Vendedor(a)', aliases: ['Vendedor', 'Vendedor (a)'] },
      { chave: 'condicao', rotulo: 'Condição de pagamento' },
      { chave: 'total', rotulo: 'Total do pedido' },
    ],
  },
  carteira: {
    tipo: 'carteira',
    titulo: 'Carteira detalhada de clientes',
    arquivo: 'Carteira detalhada de clientes (.xls)',
    resumo: 'Situação, último pedido, dias sem comprar e ciclo médio.',
    colunas: [
      'Razão Social',
      'Último pedido',
      'Data do último pedido',
      'Valor do último pedido',
      'Dias sem comprar',
      'Ciclo médio de compra',
      'Situação',
    ],
    esperadas: [
      { chave: 'razao', rotulo: 'Razão Social' },
      { chave: 'ultimoPedido', rotulo: 'Último pedido' },
      { chave: 'dataUltimo', rotulo: 'Data do último pedido' },
      { chave: 'valorUltimo', rotulo: 'Valor do último pedido' },
      { chave: 'dias', rotulo: 'Dias sem comprar' },
      { chave: 'ciclo', rotulo: 'Ciclo médio de compra' },
      { chave: 'situacao', rotulo: 'Situação' },
    ],
  },
  ranking: {
    tipo: 'ranking',
    titulo: 'Ranking de vendedores',
    arquivo: 'Ranking de vendedores (.xls)',
    resumo: 'Meta, vendido, ticket, positivação, previsão e orçamentos em aberto.',
    colunas: [
      'Ranking',
      'Vendedor',
      'Atingimento de meta',
      'Valor vendido',
      'Ticket Médio',
      'Clientes positivados',
      'Meta',
      'Previsão de vendas',
      'Previsão de atingimento de meta',
      'Quantidade de orçamentos',
      'Orçamentos em aberto',
    ],
    esperadas: [
      { chave: 'ranking', rotulo: 'Ranking' },
      { chave: 'vendedor', rotulo: 'Vendedor' },
      { chave: 'atingimento', rotulo: 'Atingimento de meta' },
      { chave: 'valor', rotulo: 'Valor vendido' },
      { chave: 'ticket', rotulo: 'Ticket Médio', aliases: ['Ticket medio'] },
      { chave: 'positivados', rotulo: 'Clientes positivados' },
      { chave: 'meta', rotulo: 'Meta' },
      { chave: 'previsao', rotulo: 'Previsão de vendas' },
      { chave: 'previsaoAtingimento', rotulo: 'Previsão de atingimento de meta' },
      { chave: 'qtdOrcamentos', rotulo: 'Quantidade de orçamentos' },
      { chave: 'orcamentosAbertos', rotulo: 'Orçamentos em aberto' },
    ],
  },
  estoque: {
    tipo: 'estoque',
    titulo: 'Estoque',
    arquivo: 'Relatório de Estoque (.xls)',
    resumo: 'Código, descrição, representada, quantidade e valor.',
    colunas: ['Codigo', 'Descricao', 'Representada', 'Estoque', 'Valor Total'],
    esperadas: [
      { chave: 'codigo', rotulo: 'Codigo', aliases: ['Código'] },
      { chave: 'descricao', rotulo: 'Descricao', aliases: ['Descrição'] },
      { chave: 'representada', rotulo: 'Representada' },
      { chave: 'estoque', rotulo: 'Estoque' },
      { chave: 'valor', rotulo: 'Valor Total' },
    ],
  },
  produtos: {
    tipo: 'produtos',
    titulo: 'Produtos mais vendidos',
    arquivo: 'Produtos mais vendidos (.xlsx)',
    resumo: 'Dois blocos de período, variação e total geral.',
    colunas: [
      'Categorias e Produtos',
      'Quantidade vendida',
      'Valor vendido',
      'Ticket médio',
      'Participação',
      '% Variação',
      'Quantidade total',
      'Valor total',
    ],
    esperadas: [],
  },
};

export interface DefObjetivo {
  id: ObjetivoId;
  titulo: string;
  pergunta: string;
  detalhe: string;
  relatorios: TipoRelatorio[];
  rota: string;
}

export const OBJETIVOS: DefObjetivo[] = [
  {
    id: 'giro',
    titulo: 'Giro de produtos',
    pergunta: 'O que está parado e o que mais sai?',
    detalhe: 'Mais vendidos, curva ABC, cobertura e itens sem giro.',
    relatorios: ['produtos', 'estoque'],
    rota: '/giro',
  },
  {
    id: 'carteira',
    titulo: 'Saúde da carteira',
    pergunta: 'Quais clientes estão esfriando?',
    detalhe: 'Ativos além do ciclo, inativos para reativar e concentração.',
    relatorios: ['carteira', 'vendas'],
    rota: '/carteira',
  },
  {
    id: 'vendedores',
    titulo: 'Desempenho de vendedores',
    pergunta: 'Quem vai bater a meta?',
    detalhe: 'Atingimento, ticket, positivação, previsão e orçamentos parados.',
    relatorios: ['ranking', 'vendas'],
    rota: '/vendedores',
  },
  {
    id: 'vendas',
    titulo: 'Visão geral de vendas',
    pergunta: 'Como o período está andando?',
    detalhe: 'Evolução, dia da semana, condição de pagamento e maiores pedidos.',
    relatorios: ['vendas'],
    rota: '/vendas',
  },
  {
    id: 'executivo',
    titulo: 'Visão executiva completa',
    pergunta: 'O que precisa de decisão hoje?',
    detalhe: 'Os principais números de cada frente e as ações de maior valor.',
    relatorios: ['produtos', 'estoque', 'carteira', 'vendas', 'ranking'],
    rota: '/executivo',
  },
];

export function objetivoPorId(id: string): DefObjetivo | undefined {
  return OBJETIVOS.find((o) => o.id === id);
}

export const FAIXAS_DIAS = [
  { id: '0-30', rotulo: '0–30', min: 0, max: 30 },
  { id: '31-60', rotulo: '31–60', min: 31, max: 60 },
  { id: '61-90', rotulo: '61–90', min: 61, max: 90 },
  { id: '91-180', rotulo: '91–180', min: 91, max: 180 },
  { id: '181-365', rotulo: '181–365', min: 181, max: 365 },
  { id: '365+', rotulo: '365+', min: 366, max: Number.POSITIVE_INFINITY },
] as const;

export const FAIXAS_PEDIDO = [
  { rotulo: 'Até 500', min: 0, max: 500 },
  { rotulo: '500 a 2 mil', min: 500, max: 2000 },
  { rotulo: '2 a 5 mil', min: 2000, max: 5000 },
  { rotulo: '5 a 10 mil', min: 5000, max: 10000 },
  { rotulo: '10 a 50 mil', min: 10000, max: 50000 },
  { rotulo: 'Acima de 50 mil', min: 50000, max: Number.POSITIVE_INFINITY },
] as const;
