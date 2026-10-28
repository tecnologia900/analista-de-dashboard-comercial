import { diffDias, soma } from '@dash/shared';
import type { TipoRelatorio } from '@dash/shared';
import * as XLSX from 'xlsx';

interface Sku {
  base: string;
  codigo: number;
  par: number;
  variante: 'DIR' | 'IND';
  preco: number;
  representada: string;
  estoque: number;
  custo: number;
}

interface Mov {
  data: string;
  pedido: string;
  razao: string;
  fantasia: string;
  vendedor: string;
  condicao: string;
  sku: Sku;
  qtd: number;
  detalhada: boolean;
}

const REF = '2026-10-27';
const CONDICAO: Record<string, string> = {
  'Ana Ribeiro': '30/60/90',
  'Bruno Carvalho': '28/56/84',
  'Carla Menezes': 'A vista',
  'Diego Albuquerque': '15',
  'Felipe Nogueira': '30',
};

const VENDAS: Sku[] = [
  sku('PARAFUSO SEXTAVADO M10 ACO', 868, 462, 'DIR', 180, 'Metalúrgica Horizonte', 8, 42),
  sku('PARAFUSO SEXTAVADO M10 ACO', 462, 868, 'IND', 160, 'Metalúrgica Horizonte', 36, 38),
  sku('PORCA SEXTAVADA M10 ACO', 501, 502, 'DIR', 40, 'Metalúrgica Horizonte', 800, 9),
  sku('ARRUELA LISA M10 ACO', 610, 611, 'DIR', 15, 'Metalúrgica Horizonte', 0, 3),
  sku('CHUMBADOR PARABOLT 3/8', 720, 721, 'DIR', 25, 'Metalúrgica Horizonte', 70, 8),
  sku('BARRA ROSCADA 1M ZINCADA', 830, 831, 'DIR', 22, 'Metalúrgica Horizonte', 120, 7),
  sku('DISCO DE CORTE 7 POLEGADAS', 940, 941, 'DIR', 12, 'EPI Leste', 180, 4),
  sku('ELETRODO REVESTIDO 6013', 1050, 1051, 'DIR', 28, 'Metalúrgica Horizonte', 24, 11),
];

const PARADOS: Sku[] = [
  sku('TINTA EPOXI CINZA GALAO', 1100, 1101, 'DIR', 900, 'Química Serra Azul', 80, 1400),
  sku('LUVA DE RASPA PETROLEIRA', 1200, 1201, 'DIR', 36, 'EPI Leste', 250, 36),
];

const SOLVENTE = sku('SOLVENTE INDUSTRIAL 18L', 1300, 1301, 'DIR', 210, 'Química Serra Azul', 24, 260);
const BROCA = sku('BROCA ACO RAPIDO 10MM', 1400, 1401, 'DIR', 20, 'Metalúrgica Horizonte', -5, 18);

function sku(
  base: string,
  codigo: number,
  par: number,
  variante: 'DIR' | 'IND',
  preco: number,
  representada: string,
  estoque: number,
  custo: number,
): Sku {
  return { base, codigo, par, variante, preco, representada, estoque, custo };
}

function descricao(item: Sku): string {
  const proprio = item.variante === 'DIR' ? item.codigo : item.par;
  const outro = item.variante === 'DIR' ? item.par : item.codigo;
  return `${item.base} IMP ${item.variante} - ${proprio} / ${outro}`;
}

function fantasiaDe(razao: string): string {
  return razao.replace(/ Ltda| S\.A\./g, '');
}

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function montarMovimentos(): Mov[] {
  const movimentos: Mov[] = [];
  let seq = 8100;
  const lancar = (data: string, razao: string, vendedor: string, item: Sku, qtd: number, detalhada = true) => {
    movimentos.push({
      data,
      pedido: String(seq),
      razao,
      fantasia: fantasiaDe(razao),
      vendedor,
      condicao: CONDICAO[vendedor] ?? 'A vista',
      sku: item,
      qtd,
      detalhada,
    });
    seq += 1;
  };

  lancar('2026-10-01', 'Construtora Vale Verde Ltda', 'Ana Ribeiro', VENDAS[0], 8);
  lancar('2026-10-08', 'Construtora Vale Verde Ltda', 'Ana Ribeiro', VENDAS[0], 8);
  lancar('2026-10-12', 'Construtora Vale Verde Ltda', 'Ana Ribeiro', VENDAS[0], 24);
  lancar('2026-10-02', 'Indústria Nova Serra S.A.', 'Felipe Nogueira', VENDAS[2], 10);
  lancar('2026-10-09', 'Indústria Nova Serra S.A.', 'Felipe Nogueira', VENDAS[4], 12);
  lancar('2026-10-13', 'Indústria Nova Serra S.A.', 'Felipe Nogueira', VENDAS[0], 6);
  lancar('2026-10-03', 'Usina Recanto Azul Ltda', 'Ana Ribeiro', VENDAS[5], 20);
  lancar('2026-10-10', 'Usina Recanto Azul Ltda', 'Ana Ribeiro', VENDAS[1], 5);
  lancar('2026-10-14', 'Usina Recanto Azul Ltda', 'Ana Ribeiro', VENDAS[0], 10);

  lancar('2026-10-06', 'Metalúrgica Piratininga Ltda', 'Bruno Carvalho', VENDAS[2], 30);
  lancar('2026-10-16', 'Metalúrgica Piratininga Ltda', 'Bruno Carvalho', VENDAS[4], 16);
  lancar('2026-10-22', 'Metalúrgica Piratininga Ltda', 'Bruno Carvalho', VENDAS[5], 18);
  lancar('2026-10-26', 'Metalúrgica Piratininga Ltda', 'Bruno Carvalho', VENDAS[2], 22);
  lancar('2026-10-18', 'Comercial Lima Ltda', 'Carla Menezes', VENDAS[6], 8);
  lancar('2026-10-25', 'Comercial Lima Ltda', 'Carla Menezes', VENDAS[3], 6);
  lancar('2026-10-07', 'Ferragens Bom Preço Ltda', 'Diego Albuquerque', VENDAS[1], 4);
  lancar('2026-10-17', 'Ferragens Bom Preço Ltda', 'Diego Albuquerque', VENDAS[6], 10);
  lancar('2026-10-21', 'Ferragens Bom Preço Ltda', 'Diego Albuquerque', VENDAS[5], 8);
  lancar('2026-10-26', 'Ferragens Bom Preço Ltda', 'Diego Albuquerque', VENDAS[2], 12);
  lancar('2026-10-24', 'Oficina Três Irmãos Ltda', 'Carla Menezes', VENDAS[3], 4);
  lancar('2026-10-08', 'Distribuidora Rio Claro Ltda', 'Bruno Carvalho', VENDAS[4], 20);
  lancar('2026-10-15', 'Distribuidora Rio Claro Ltda', 'Bruno Carvalho', VENDAS[0], 6);
  lancar('2026-10-23', 'Distribuidora Rio Claro Ltda', 'Bruno Carvalho', VENDAS[2], 14);
  lancar('2026-10-27', 'Distribuidora Rio Claro Ltda', 'Bruno Carvalho', VENDAS[7], 4);
  lancar('2026-10-11', 'Montagens Atlântico Ltda', 'Felipe Nogueira', VENDAS[6], 6);
  lancar('2026-10-19', 'Montagens Atlântico Ltda', 'Felipe Nogueira', VENDAS[4], 8);
  lancar('2026-10-05', 'Agropecuária Santa Luzia Ltda', 'Diego Albuquerque', VENDAS[5], 10);
  lancar('2026-10-20', 'Agropecuária Santa Luzia Ltda', 'Diego Albuquerque', VENDAS[1], 3);
  lancar('2026-10-27', 'Agropecuária Santa Luzia Ltda', 'Diego Albuquerque', VENDAS[2], 9);
  lancar('2026-10-27', 'Serralheria Dois Irmãos Ltda', 'Carla Menezes', VENDAS[6], 5);
  lancar('2026-10-16', 'Oficina Fantasma ME', 'Felipe Nogueira', VENDAS[3], 3);

  lancar('2026-09-18', 'Empreiteira Morro Alto Ltda', 'Ana Ribeiro', VENDAS[0], 12, false);
  lancar('2026-09-05', 'Caldeiraria Boa Vista Ltda', 'Bruno Carvalho', VENDAS[5], 15, false);
  lancar('2026-08-12', 'Estruturas Planalto Ltda', 'Diego Albuquerque', VENDAS[6], 80, false);
  lancar('2026-08-20', 'Estruturas Planalto Ltda', 'Diego Albuquerque', SOLVENTE, 6, false);
  return movimentos;
}

function itensEstoque(): Sku[] {
  const zeros: Sku[] = [];
  for (let i = 0; i < 25; i += 1) {
    zeros.push(
      sku(
        `ITEM SEM GIRO ${String(i + 1).padStart(2, '0')}`,
        2000 + i,
        3000 + i,
        'DIR',
        10,
        i % 2 === 0 ? 'Metalúrgica Horizonte' : 'EPI Leste',
        0,
        5,
      ),
    );
  }
  return [...VENDAS, ...PARADOS, SOLVENTE, BROCA, ...zeros];
}

export function gerarPlanilha(tipo: TipoRelatorio): Buffer {
  const movimentos = montarMovimentos();
  if (tipo === 'vendas') return pasta(linhasVendas(movimentos));
  if (tipo === 'carteira') return pasta(linhasCarteira(movimentos));
  if (tipo === 'ranking') return pasta(linhasRanking(movimentos));
  if (tipo === 'estoque') return pasta(linhasEstoque());
  return pasta(linhasProdutos(movimentos));
}

function linhasVendas(movimentos: Mov[]): unknown[][] {
  const corpo = movimentos
    .filter((mov) => mov.detalhada)
    .sort((a, b) => b.data.localeCompare(a.data) || b.pedido.localeCompare(a.pedido))
    .map((mov) => [
      dataBR(mov.data),
      mov.pedido,
      mov.razao,
      mov.fantasia,
      mov.vendedor,
      mov.condicao,
      mov.qtd * mov.sku.preco,
    ]);
  return [
    ['Relatório de Vendas'],
    ['Filtros'],
    ['Data inicial: 01/10/2026'],
    ['Data final: 27/10/2026'],
    ['Situação dos pedidos: Pedidos concluídos'],
    [],
    ['Data de emissão', 'Pedido', 'Razão Social', 'Nome Fantasia', 'Vendedor(a)', 'Condição de pagamento', 'Total do pedido'],
    ...corpo,
  ];
}

function linhasCarteira(movimentos: Mov[]): unknown[][] {
  const porCliente = new Map<string, Mov[]>();
  for (const mov of movimentos) {
    if (mov.razao === 'Oficina Fantasma ME') continue;
    porCliente.set(mov.razao, [...(porCliente.get(mov.razao) ?? []), mov]);
  }
  const linhas = [...porCliente.entries()].map(([razao, movs]) => {
    const ordenados = [...movs].sort((a, b) => a.data.localeCompare(b.data) || a.pedido.localeCompare(b.pedido));
    const ultimo = ordenados[ordenados.length - 1];
    const dias = diffDias(ultimo.data, REF);
    const datas = [...new Set(ordenados.map((mov) => mov.data))].sort();
    const ciclo = cicloDe(datas);
    return [
      razao,
      ultimo.pedido,
      dataBR(ultimo.data),
      ultimo.qtd * ultimo.sku.preco,
      dias === 0 ? '' : dias,
      ciclo ?? '',
      situacaoDe(dias),
    ];
  });
  linhas.push(['Mecânica Estrela do Norte Ltda', '4401', '02/04/2026', 8600, diffDias('2026-04-02', REF), 45, 'Inativo antigo']);
  linhas.push(['Comercial Lima Ltda', '4402', '10/03/2026', 700, diffDias('2026-03-10', REF), '', 'Inativo antigo']);
  return [
    ['Carteira detalhada de clientes'],
    ['Período: 27/10/2026'],
    ['Situações: Ativos, Inativos recentes, Inativos antigos'],
    [],
    ['Razão Social', 'Último pedido', 'Data do último pedido', 'Valor do último pedido', 'Dias sem comprar', 'Ciclo médio de compra', 'Situação'],
    ...linhas,
  ];
}

function linhasRanking(movimentos: Mov[]): unknown[][] {
  const porVend = new Map<string, Mov[]>();
  for (const mov of movimentos) {
    if (!mov.detalhada) continue;
    porVend.set(mov.vendedor, [...(porVend.get(mov.vendedor) ?? []), mov]);
  }
  const nomes = ['Ana Ribeiro', 'Bruno Carvalho', 'Carla Menezes', 'Diego Albuquerque', 'Felipe Nogueira', 'Gisele Tavares'];
  const resumo = nomes.map((nome) => {
    const movs = porVend.get(nome) ?? [];
    const valor = soma(movs.map((mov) => mov.qtd * mov.sku.preco));
    const pedidos = movs.length;
    const clientes = new Set(movs.map((mov) => mov.razao)).size;
    const meta = metaDe(nome, valor);
    const previsao = previsaoDe(nome, valor, meta);
    return { nome, valor, pedidos, clientes, meta, previsao };
  });
  resumo.sort((a, b) => b.valor - a.valor);
  const corpo = resumo.map((vend, i) => [
    i + 1,
    vend.nome,
    vend.meta == null ? '' : round2((vend.valor / vend.meta) * 100),
    vend.valor,
    vend.pedidos ? round2(vend.valor / vend.pedidos) : '',
    vend.clientes,
    vend.meta ?? '',
    vend.previsao ?? '',
    vend.meta == null || vend.previsao == null ? '' : round2((vend.previsao / vend.meta) * 100),
    orcamentosQtd(vend.nome),
    orcamentosValor(vend.nome),
  ]);
  return [
    ['Ranking de vendedores'],
    ['Ano: 2026'],
    ['Mês: Outubro'],
    [],
    ['Ranking', 'Vendedor', 'Atingimento de meta', 'Valor vendido', 'Ticket Médio', 'Clientes positivados', 'Meta', 'Previsão de vendas', 'Previsão de atingimento de meta', 'Quantidade de orçamentos', 'Orçamentos em aberto'],
    ...corpo,
  ];
}

function linhasEstoque(): unknown[][] {
  const itens = itensEstoque();
  const corpo = itens.map((item) => [
    item.codigo,
    descricao(item),
    item.representada,
    item.estoque,
    item.estoque > 0 ? item.estoque * item.custo : 0,
  ]);
  corpo.push([868, 'PARAFUSO SEXTAVADO M10 ACO LOTE ANTIGO', 'Metalúrgica Horizonte', 2, 80]);
  const total = soma(corpo.map((linha) => Number(linha[4]) || 0));
  return [
    ['Relatório de Estoque'],
    [],
    ['Codigo', 'Descricao', 'Representada', 'Estoque', 'Valor Total'],
    ...corpo,
    ['', '', '', '', total],
  ];
}

function linhasProdutos(movimentos: Mov[]): unknown[][] {
  const catalogo = [...VENDAS, SOLVENTE];
  const linhas = catalogo.map((item) => agregar(item, movimentos));
  const eletrodo = linhas.find((linha) => String(linha[0]).includes('ELETRODO'));
  if (eletrodo) {
    eletrodo[8] = 0;
    eletrodo[9] = 0;
    eletrodo[10] = 0;
    eletrodo[14] = '';
    eletrodo[15] = '';
  }
  const totais = somarColunas(linhas);
  const periodRow = Array<string>(19).fill('');
  periodRow[1] = '01/10/2026 a 27/10/2026';
  periodRow[8] = '01/08/2026 a 31/10/2026';
  return [
    ['Produtos mais Vendidos'],
    ['Filtros'],
    ['Períodos: 01/10/2026 a 27/10/2026, 01/08/2026 a 31/10/2026'],
    ['Agrupado por categoria: Não'],
    ['Exibir valores com impostos: Não'],
    periodRow,
    [
      'Categorias e Produtos',
      'Quantidade vendida',
      'Valor vendido',
      'Ticket médio',
      'Participação (quantidade vendida)',
      'Participação (valor vendido)',
      'Participação (ticket médio)',
      '',
      'Quantidade vendida',
      'Valor vendido',
      'Ticket médio',
      'Participação (quantidade vendida)',
      'Participação (valor vendido)',
      'Participação (ticket médio)',
      '% Variação (quantidade vendida)',
      '% Variação (valor vendido)',
      '',
      'Quantidade total',
      'Valor total',
    ],
    ...linhas,
    ['Total geral', totais.qtd1, totais.valor1, '', '', '', '', '', totais.qtd2, totais.valor2, '', '', '', '', '', '', '', totais.qtd1 + totais.qtd2, totais.valor1 + totais.valor2],
  ];
}

function agregar(item: Sku, movimentos: Mov[]): unknown[] {
  const meus = movimentos.filter((mov) => mov.sku === item);
  const atual = meus.filter((mov) => mov.data >= '2026-10-01' && mov.data <= '2026-10-27');
  const comparacao = meus.filter((mov) => mov.data >= '2026-08-01' && mov.data <= '2026-10-31');
  const qtd1 = soma(atual.map((mov) => mov.qtd));
  const valor1 = soma(atual.map((mov) => mov.qtd * mov.sku.preco));
  const qtd2 = soma(comparacao.map((mov) => mov.qtd));
  const valor2 = soma(comparacao.map((mov) => mov.qtd * mov.sku.preco));
  return [
    descricao(item),
    qtd1,
    valor1,
    qtd1 ? round2(valor1 / qtd1) : 0,
    0,
    0,
    0,
    '',
    qtd2,
    valor2,
    qtd2 ? round2(valor2 / qtd2) : 0,
    0,
    0,
    0,
    qtd2 === 0 ? '' : round2(((qtd1 - qtd2) / qtd2) * 100),
    valor2 === 0 ? '' : round2(((valor1 - valor2) / valor2) * 100),
    '',
    qtd1 + qtd2,
    valor1 + valor2,
  ];
}

function somarColunas(linhas: unknown[][]) {
  return {
    qtd1: soma(linhas.map((linha) => Number(linha[1]) || 0)),
    valor1: soma(linhas.map((linha) => Number(linha[2]) || 0)),
    qtd2: soma(linhas.map((linha) => Number(linha[8]) || 0)),
    valor2: soma(linhas.map((linha) => Number(linha[9]) || 0)),
  };
}

function metaDe(nome: string, valor: number): number | null {
  if (nome === 'Diego Albuquerque') return null;
  if (nome === 'Gisele Tavares') return 20000;
  if (nome === 'Felipe Nogueira') return Math.round(valor / 0.62);
  if (nome === 'Ana Ribeiro') return Math.round(valor / 1.45);
  if (nome === 'Bruno Carvalho') return Math.round(valor / 0.92);
  if (nome === 'Carla Menezes') return Math.round(valor / 1.08);
  return Math.round(valor);
}

function previsaoDe(nome: string, valor: number, meta: number | null): number | null {
  if (nome === 'Diego Albuquerque') return null;
  if (nome === 'Gisele Tavares') return 0;
  if (nome === 'Felipe Nogueira' && meta != null) return Math.round(meta * 0.74);
  return Math.round((valor / 27) * 31);
}

function orcamentosQtd(nome: string): number | '' {
  const mapa: Record<string, number> = {
    'Ana Ribeiro': 4,
    'Bruno Carvalho': 11,
    'Carla Menezes': 2,
    'Diego Albuquerque': 3,
    'Felipe Nogueira': 6,
    'Gisele Tavares': 2,
  };
  return mapa[nome] ?? '';
}

function orcamentosValor(nome: string): number | '' {
  const mapa: Record<string, number | ''> = {
    'Ana Ribeiro': 3500,
    'Bruno Carvalho': 72000,
    'Carla Menezes': 800,
    'Diego Albuquerque': 2200,
    'Felipe Nogueira': 18000,
    'Gisele Tavares': '',
  };
  return mapa[nome] ?? '';
}

function cicloDe(datas: string[]): number | null {
  if (datas.length < 3) return null;
  const gaps: number[] = [];
  for (let i = 1; i < datas.length; i += 1) gaps.push(diffDias(datas[i - 1], datas[i]));
  const media = soma(gaps) / gaps.length;
  return media > 0 ? Math.round(media) : null;
}

function situacaoDe(dias: number): string {
  if (dias <= 35) return 'Ativo';
  if (dias <= 160) return 'Inativo recente';
  return 'Inativo antigo';
}

function round2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function pasta(linhas: unknown[][]): Buffer {
  const pastaLivro = XLSX.utils.book_new();
  const folha = XLSX.utils.aoa_to_sheet(linhas);
  XLSX.utils.book_append_sheet(pastaLivro, folha, 'Relatório');
  return XLSX.write(pastaLivro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
