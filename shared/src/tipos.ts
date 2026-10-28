export type TipoRelatorio = 'vendas' | 'carteira' | 'ranking' | 'estoque' | 'produtos';

export type ObjetivoId = 'giro' | 'carteira' | 'vendedores' | 'vendas' | 'executivo';

export interface CampoFiltro {
  rotulo: string;
  valor: string;
}

export interface MetaRelatorio {
  titulo: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  referencia: string | null;
  filtros: CampoFiltro[];
  aba: string;
  linhasDados: number;
  origem: string;
  avisos: string[];
}

export interface Venda {
  data: string | null;
  pedido: string;
  razaoSocial: string;
  nomeFantasia: string;
  vendedor: string;
  condicao: string;
  prazoMedio: number;
  total: number;
}

export interface ClienteCarteira {
  chave: string;
  razaoSocial: string;
  ultimoPedido: string;
  dataUltimoPedido: string | null;
  valorUltimoPedido: number | null;
  diasSemComprar: number;
  cicloMedio: number | null;
  situacao: string;
}

export interface VendedorRanking {
  ranking: number | null;
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
}

export interface ItemEstoque {
  chave: string;
  codigo: string;
  descricao: string;
  representada: string;
  estoque: number;
  valorTotal: number;
  negativo: boolean;
}

export interface PeriodoRotulo {
  inicio: string | null;
  fim: string | null;
  rotulo: string;
}

export interface ProdutoVendido {
  nome: string;
  categoria: string | null;
  qtd1: number;
  valor1: number;
  ticket1: number | null;
  partQtd1: number | null;
  partValor1: number | null;
  partTicket1: number | null;
  qtd2: number;
  valor2: number;
  ticket2: number | null;
  partQtd2: number | null;
  partValor2: number | null;
  partTicket2: number | null;
  varQtd: number | null;
  varValor: number | null;
  qtdTotal: number | null;
  valorTotal: number | null;
  semBase: boolean;
}

export interface CategoriaProduto {
  nome: string;
  qtd1: number;
  valor1: number;
  qtd2: number;
  valor2: number;
}

export interface TotaisProdutos {
  qtd1: number;
  valor1: number;
  qtd2: number;
  valor2: number;
  qtdTotal: number | null;
  valorTotal: number | null;
}

export interface Conferencia {
  ok: boolean;
  mensagem: string;
  somaValor: number;
  totalInformado: number | null;
}

export interface RelatorioVendas {
  tipo: 'vendas';
  meta: MetaRelatorio;
  linhas: Venda[];
}

export interface RelatorioCarteira {
  tipo: 'carteira';
  meta: MetaRelatorio;
  linhas: ClienteCarteira[];
}

export interface RelatorioRanking {
  tipo: 'ranking';
  meta: MetaRelatorio;
  linhas: VendedorRanking[];
}

export interface RelatorioEstoque {
  tipo: 'estoque';
  meta: MetaRelatorio;
  linhas: ItemEstoque[];
  conferencia: Conferencia;
  codigosDuplicados: { codigo: string; descricoes: string[] }[];
}

export interface RelatorioProdutos {
  tipo: 'produtos';
  meta: MetaRelatorio;
  periodo1: PeriodoRotulo;
  periodo2: PeriodoRotulo;
  sobrepostos: boolean;
  relacao: 'separado' | 'sobrepoe' | 'contem' | 'contido' | 'indefinido';
  agrupadoPorCategoria: boolean;
  itens: ProdutoVendido[];
  categorias: CategoriaProduto[];
  totalGeral: TotaisProdutos | null;
  conferencia: Conferencia;
}

export type Relatorio =
  | RelatorioVendas
  | RelatorioCarteira
  | RelatorioRanking
  | RelatorioEstoque
  | RelatorioProdutos;

export interface Filtros {
  vendedor: string | null;
  cliente: string | null;
  categoria: string | null;
  representada: string | null;
  situacao: string | null;
  condicao: string | null;
  produto: string | null;
}

export interface Oportunidade {
  id: string;
  modulo: 'giro' | 'carteira' | 'vendedores' | 'vendas';
  severidade: 'alta' | 'media' | 'baixa';
  titulo: string;
  detalhe: string;
  impacto: number;
  ancora: string;
}

export interface ContextoAnalise {
  vendas: RelatorioVendas | null;
  carteira: RelatorioCarteira | null;
  ranking: RelatorioRanking | null;
  estoque: RelatorioEstoque | null;
  produtos: RelatorioProdutos | null;
  filtros: Filtros;
  coberturaMaxDias: number;
}
