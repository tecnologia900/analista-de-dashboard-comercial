import type {
  Filtros,
  ItemEstoque,
  Oportunidade,
  ProdutoVendido,
  RelatorioEstoque,
  RelatorioProdutos,
} from './tipos.js';
import { chavePar, normCabecalho, normDesc, parseVariante } from './texto.js';
import { diasInclusivos, formatBRL, formatNum, formatPct, soma } from './numeros.js';

export interface LinhaAbc {
  nome: string;
  valor: number;
  classe: 'A' | 'B' | 'C';
  participacao: number;
  acumulado: number;
}

export function classificarAbc(itens: { nome: string; valor: number }[]): LinhaAbc[] {
  const positivos = itens.filter((i) => i.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = soma(positivos.map((i) => i.valor));
  let acc = 0;
  return positivos.map((item) => {
    const participacao = total > 0 ? (item.valor / total) * 100 : 0;
    const antes = acc;
    acc += participacao;
    let classe: 'A' | 'B' | 'C' = 'C';
    if (antes < 80) classe = 'A';
    else if (antes < 95) classe = 'B';
    return { nome: item.nome, valor: item.valor, classe, participacao, acumulado: acc };
  });
}

export interface IndiceEstoque {
  porDesc: Map<string, ItemEstoque[]>;
  porCodigo: Map<string, ItemEstoque[]>;
}

export function indexarEstoque(itens: ItemEstoque[]): IndiceEstoque {
  const porDesc = new Map<string, ItemEstoque[]>();
  const porCodigo = new Map<string, ItemEstoque[]>();
  for (const item of itens) {
    const desc = normDesc(item.descricao);
    porDesc.set(desc, [...(porDesc.get(desc) ?? []), item]);
    if (item.codigo) porCodigo.set(item.codigo, [...(porCodigo.get(item.codigo) ?? []), item]);
  }
  return { porDesc, porCodigo };
}

export function cruzarProduto(
  nome: string,
  indice: IndiceEstoque,
): { item: ItemEstoque | null; por: 'descricao' | 'codigo' | null } {
  const porNome = indice.porDesc.get(normDesc(nome));
  if (porNome?.length) return { item: escolherItem(porNome, nome), por: 'descricao' };
  const variante = parseVariante(nome);
  if (variante) {
    const porCodigo = indice.porCodigo.get(variante.codigo);
    if (porCodigo?.length) return { item: escolherItem(porCodigo, nome), por: 'codigo' };
  }
  return { item: null, por: null };
}

function escolherItem(hits: ItemEstoque[], nome: string): ItemEstoque {
  if (hits.length === 1) return hits[0];
  const variante = parseVariante(nome);
  if (variante) {
    const mesmo = hits.find(
      (h) => h.codigo === variante.codigo && normDesc(h.descricao).includes(variante.variante.toLowerCase()),
    );
    if (mesmo) return mesmo;
  }
  return hits.find((h) => h.estoque > 0) ?? hits[0];
}

export interface ItemParado {
  codigo: string;
  descricao: string;
  representada: string;
  estoque: number;
  valor: number;
  qtdVendida: number;
  cobertura: number | null;
  par: string | null;
}

export interface ItemRuptura {
  descricao: string;
  qtdVendida: number;
  mediaDiaria: number;
  estoque: number | null;
  cobertura: number | null;
  valorVendido: number;
  motivo: string;
}

export interface LadoPar {
  descricao: string;
  codigo: string;
  estoque: number;
  valorEstoque: number;
  qtdVendida: number;
  valorVendido: number;
}

export interface ParVariante {
  base: string;
  dir: LadoPar | null;
  ind: LadoPar | null;
}

export interface GiroView {
  temProdutos: boolean;
  temEstoque: boolean;
  kpis: {
    valorVendido: number;
    quantidade: number;
    ticketMedio: number | null;
    valorEstoque: number;
    itensComEstoque: number;
    itensParados: number;
    valorParado: number;
  };
  ranking: { nome: string; valor: number; qtd: number; categoria: string | null }[];
  categorias: { nome: string; valor: number; qtd: number }[];
  cresceram: { nome: string; variacao: number; valor: number }[];
  cairam: { nome: string; variacao: number; valor: number }[];
  abc: LinhaAbc[];
  abcResumo: { classe: 'A' | 'B' | 'C'; itens: number; valor: number; participacao: number }[];
  parados: ItemParado[];
  rupturas: ItemRuptura[];
  negativos: ItemEstoque[];
  duplicados: { codigo: string; descricoes: string[] }[];
  porRepresentada: { nome: string; valor: number; itens: number }[];
  pares: ParVariante[];
  insights: {
    topo: string;
    abc: string;
    variacao: string;
    parados: string;
    ruptura: string;
    representada: string;
  };
  sobrepostos: boolean;
  avisos: string[];
  casamento: { taxa: number; comVenda: number; semEstoque: number } | null;
  oportunidades: Oportunidade[];
  diasPeriodo: number;
}

export function montarGiro(
  produtos: RelatorioProdutos | null,
  estoque: RelatorioEstoque | null,
  filtros: Filtros,
  opcoes?: { coberturaMaxDias?: number; vendaBaixaAte?: number },
): GiroView {
  const limite = opcoes?.coberturaMaxDias ?? 15;
  const vendaBaixa = opcoes?.vendaBaixaAte ?? 0;
  const linhasEstoque = estoque?.linhas ?? [];
  const indice = indexarEstoque(linhasEstoque);
  const todosProdutos = produtos?.itens ?? [];
  const dias = diasDoPeriodo(produtos);

  const porCategoria = (item: ProdutoVendido) =>
    !filtros.categoria || (item.categoria ?? 'Sem categoria') === filtros.categoria;

  const porRepresentadaProduto = (item: ProdutoVendido) => {
    if (!filtros.representada || !estoque) return true;
    const cruz = cruzarProduto(item.nome, indice);
    return !!cruz.item && normCabecalho(cruz.item.representada) === normCabecalho(filtros.representada);
  };

  const rankingBase = todosProdutos.filter((item) => porCategoria(item) && porRepresentadaProduto(item));
  const valorVendido = soma(rankingBase.map((i) => i.valor1));
  const quantidade = soma(rankingBase.map((i) => i.qtd1));
  const ticketMedio = quantidade > 0 ? valorVendido / quantidade : null;

  const ranking = [...rankingBase]
    .sort((a, b) => b.valor1 - a.valor1 || b.qtd1 - a.qtd1)
    .map((item) => ({ nome: item.nome, valor: item.valor1, qtd: item.qtd1, categoria: item.categoria }));

  const categoriasMap = new Map<string, { valor: number; qtd: number }>();
  for (const item of rankingBase) {
    if (!item.categoria) continue;
    const atual = categoriasMap.get(item.categoria) ?? { valor: 0, qtd: 0 };
    atual.valor += item.valor1;
    atual.qtd += item.qtd1;
    categoriasMap.set(item.categoria, atual);
  }
  const categorias = [...categoriasMap.entries()]
    .map(([nome, v]) => ({ nome, valor: v.valor, qtd: v.qtd }))
    .sort((a, b) => b.valor - a.valor);

  const abc = classificarAbc(rankingBase.map((i) => ({ nome: i.nome, valor: i.valor1 })));
  const abcResumo = (['A', 'B', 'C'] as const).map((classe) => {
    const grupo = abc.filter((i) => i.classe === classe);
    const valor = soma(grupo.map((i) => i.valor));
    return {
      classe,
      itens: grupo.length,
      valor,
      participacao: valorVendido > 0 ? (valor / valorVendido) * 100 : 0,
    };
  });

  const comVariacao = rankingBase.filter((i) => !i.semBase && i.varValor != null);
  const cresceram = comVariacao
    .filter((i) => (i.varValor ?? 0) > 0)
    .sort((a, b) => (b.varValor ?? 0) - (a.varValor ?? 0))
    .slice(0, 8)
    .map((i) => ({ nome: i.nome, variacao: i.varValor ?? 0, valor: i.valor1 }));
  const cairam = comVariacao
    .filter((i) => (i.varValor ?? 0) < 0)
    .sort((a, b) => (a.varValor ?? 0) - (b.varValor ?? 0))
    .slice(0, 8)
    .map((i) => ({ nome: i.nome, variacao: i.varValor ?? 0, valor: i.valor1 }));

  const vendaPorDesc = new Map<string, ProdutoVendido>();
  for (const item of todosProdutos) vendaPorDesc.set(normDesc(item.nome), item);

  const casaCategoria = (item: ItemEstoque) => {
    if (!filtros.categoria) return true;
    const venda = acharVenda(item, todosProdutos, vendaPorDesc);
    return (venda?.categoria ?? 'Sem categoria') === filtros.categoria;
  };
  const estoqueCtx = linhasEstoque.filter(casaCategoria);
  const estoqueKpi = estoqueCtx.filter(
    (item) => !filtros.representada || normCabecalho(item.representada) === normCabecalho(filtros.representada),
  );

  const paradosTodos = !produtos
    ? []
    : estoqueKpi
    .filter((item) => item.estoque > 0 && !item.negativo)
    .map((item) => {
      const venda = acharVenda(item, todosProdutos, vendaPorDesc);
      const qtd = venda?.qtd1 ?? 0;
      const media = dias > 0 ? qtd / dias : 0;
      const cobertura = media > 0 ? item.estoque / media : null;
      const variante = parseVariante(item.descricao);
      return {
        codigo: item.codigo,
        descricao: item.descricao,
        representada: item.representada,
        estoque: item.estoque,
        valor: item.valorTotal,
        qtdVendida: qtd,
        cobertura,
        par: variante?.par ?? null,
        variante,
      };
    })
    .filter((item) => item.qtdVendida <= vendaBaixa)
    .filter((item) => !filtros.produto || normDesc(item.descricao) === normDesc(filtros.produto))
    .sort((a, b) => b.valor - a.valor);

  const parados: ItemParado[] = paradosTodos.map(({ variante: _v, ...resto }) => resto);

  const lideres = new Set<string>();
  [...rankingBase]
    .filter((i) => i.valor1 > 0)
    .sort((a, b) => b.valor1 - a.valor1)
    .slice(0, 20)
    .forEach((i) => lideres.add(normDesc(i.nome)));
  for (const linha of abc) if (linha.classe === 'A') lideres.add(normDesc(linha.nome));

  const rupturas: ItemRuptura[] = [];
  for (const item of rankingBase) {
    if (!lideres.has(normDesc(item.nome))) continue;
    if (filtros.produto && normDesc(item.nome) !== normDesc(filtros.produto)) continue;
    if (item.qtd1 <= 0 && item.valor1 <= 0) continue;
    const cruz = estoque ? cruzarProduto(item.nome, indice) : { item: null, por: null };
    const saldo = cruz.item?.estoque ?? null;
    const media = dias > 0 ? item.qtd1 / dias : 0;
    const cobertura = saldo != null && media > 0 ? saldo / media : saldo === 0 ? 0 : null;
    let motivo: string | null = null;
    if (!estoque) motivo = null;
    else if (!cruz.item) motivo = 'Sem registro no estoque';
    else if (saldo != null && saldo < 0) motivo = 'Estoque negativo';
    else if (saldo === 0) motivo = 'Estoque zerado';
    else if (cobertura != null && cobertura < limite) motivo = `Cobertura de ${formatNum(cobertura, 0)} dias`;
    if (!motivo) continue;
    rupturas.push({
      descricao: item.nome,
      qtdVendida: item.qtd1,
      mediaDiaria: media,
      estoque: saldo,
      cobertura,
      valorVendido: item.valor1,
      motivo,
    });
  }
  rupturas.sort((a, b) => b.valorVendido - a.valorVendido);

  const negativos = estoqueKpi.filter((item) => item.negativo);
  const duplicados = (estoque?.codigosDuplicados ?? []).filter(
    (dup) => !filtros.representada || dup.descricoes.length > 0,
  );
  const duplicadosFiltrados = filtros.representada
    ? duplicados.filter((dup) =>
        linhasEstoque.some(
          (item) => item.codigo === dup.codigo && normCabecalho(item.representada) === normCabecalho(filtros.representada!),
        ),
      )
    : duplicados;

  const mapaRep = new Map<string, { nome: string; valor: number; itens: number }>();
  for (const item of estoqueCtx) {
    if (item.negativo || item.estoque < 0) continue;
    const chave = normCabecalho(item.representada || 'Sem representada');
    const atual = mapaRep.get(chave) ?? { nome: item.representada || 'Sem representada', valor: 0, itens: 0 };
    atual.valor += item.valorTotal;
    if (item.estoque > 0) atual.itens += 1;
    mapaRep.set(chave, atual);
  }
  const porRepresentada = [...mapaRep.values()].sort((a, b) => b.valor - a.valor);

  const pares = montarPares(linhasEstoque, todosProdutos, vendaPorDesc).filter((par) => {
    if (!filtros.produto) return true;
    const alvo = normDesc(filtros.produto);
    return normDesc(par.dir?.descricao ?? '') === alvo || normDesc(par.ind?.descricao ?? '') === alvo;
  });

  const valorEstoque = soma(estoqueKpi.filter((i) => !i.negativo && i.estoque >= 0).map((i) => i.valorTotal));
  const itensComEstoque = estoqueKpi.filter((i) => i.estoque > 0).length;
  const valorParado = soma(parados.map((p) => p.valor));

  const casamento = produtos && estoque ? calcularCasamento(todosProdutos, indice) : null;
  const avisos: string[] = [];
  if (produtos) avisos.push(...produtos.meta.avisos);
  if (estoque && !estoque.conferencia.ok) avisos.push(estoque.conferencia.mensagem);
  if (casamento && casamento.comVenda > 0 && casamento.semEstoque > 0) {
    avisos.push(
      `${formatPct((casamento.taxa) * 100, 1)} dos produtos com venda no período atual bateram com a descrição do estoque. ${casamento.semEstoque} ficaram sem par.`,
    );
  }
  if (produtos && !produtos.conferencia.ok) {
    avisos.push(
      'Como o total de produtos não fechou, a lista de parados pode incluir item que vendeu e não veio na planilha.',
    );
  }

  const sobrepostos = produtos?.sobrepostos ?? false;
  const insights = {
    topo: insightTopo(ranking),
    abc: insightAbc(abcResumo),
    variacao: insightVariacao(cresceram, cairam, sobrepostos),
    parados:
      parados.length > 0
        ? `${parados.length} ${parados.length === 1 ? 'item sem venda soma' : 'itens sem venda somam'} ${formatBRL(valorParado)} parados no estoque.`
        : 'Nenhum item com estoque positivo ficou sem venda neste recorte.',
    ruptura:
      rupturas.length > 0
        ? `${rupturas.length} ${rupturas.length === 1 ? 'produto líder está' : 'produtos líderes estão'} com cobertura abaixo de ${limite} dias ou sem saldo.`
        : 'Nenhum líder de venda está abaixo da cobertura configurada.',
    representada: insightRep(porRepresentada),
  };

  const oportunidades = oportunidadesGiro({
    parados: parados.length,
    valorParado,
    rupturas,
    negativos: negativos.length,
    limite,
    periodo: produtos?.periodo1.rotulo ?? 'período atual',
  });

  return {
    temProdutos: !!produtos,
    temEstoque: !!estoque,
    kpis: {
      valorVendido,
      quantidade,
      ticketMedio,
      valorEstoque,
      itensComEstoque,
      itensParados: parados.length,
      valorParado,
    },
    ranking,
    categorias,
    cresceram,
    cairam,
    abc,
    abcResumo,
    parados,
    rupturas,
    negativos,
    duplicados: duplicadosFiltrados,
    porRepresentada,
    pares,
    insights,
    sobrepostos,
    avisos: [...new Set(avisos)],
    casamento,
    oportunidades,
    diasPeriodo: dias,
  };
}

function diasDoPeriodo(produtos: RelatorioProdutos | null): number {
  if (produtos?.periodo1.inicio && produtos.periodo1.fim) {
    return Math.max(1, diasInclusivos(produtos.periodo1.inicio, produtos.periodo1.fim));
  }
  return 1;
}

function acharVenda(
  item: ItemEstoque,
  produtos: ProdutoVendido[],
  porDesc: Map<string, ProdutoVendido>,
): ProdutoVendido | null {
  const direto = porDesc.get(normDesc(item.descricao));
  if (direto) return direto;
  const variante = parseVariante(item.descricao);
  if (!variante) return null;
  return produtos.find((p) => parseVariante(p.nome)?.codigo === variante.codigo) ?? null;
}

function calcularCasamento(produtos: ProdutoVendido[], indice: IndiceEstoque) {
  const comVenda = produtos.filter((p) => p.qtd1 > 0 || p.valor1 > 0);
  let casados = 0;
  for (const produto of comVenda) {
    if (cruzarProduto(produto.nome, indice).item) casados += 1;
  }
  return {
    taxa: comVenda.length ? casados / comVenda.length : 1,
    comVenda: comVenda.length,
    semEstoque: comVenda.length - casados,
  };
}

function montarPares(
  estoque: ItemEstoque[],
  produtos: ProdutoVendido[],
  porDesc: Map<string, ProdutoVendido>,
): ParVariante[] {
  const grupos = new Map<string, ParVariante>();
  for (const item of estoque) {
    const variante = parseVariante(item.descricao);
    if (!variante) continue;
    const chave = chavePar(variante);
    const grupo = grupos.get(chave) ?? { base: variante.base, dir: null, ind: null };
    const venda = acharVenda(item, produtos, porDesc);
    const lado: LadoPar = {
      descricao: item.descricao,
      codigo: item.codigo,
      estoque: item.estoque,
      valorEstoque: item.negativo ? 0 : item.valorTotal,
      qtdVendida: venda?.qtd1 ?? 0,
      valorVendido: venda?.valor1 ?? 0,
    };
    if (variante.variante === 'DIR') grupo.dir = lado;
    else grupo.ind = lado;
    grupos.set(chave, grupo);
  }
  return [...grupos.values()]
    .filter((g) => g.dir || g.ind)
    .sort((a, b) => (b.dir?.valorVendido ?? 0) + (b.ind?.valorVendido ?? 0) - ((a.dir?.valorVendido ?? 0) + (a.ind?.valorVendido ?? 0)));
}

function insightTopo(ranking: { valor: number }[]): string {
  const total = soma(ranking.map((r) => r.valor));
  if (total <= 0 || ranking.length === 0) return 'Não há venda no recorte atual.';
  const n = Math.min(3, ranking.length);
  const parte = soma(ranking.slice(0, n).map((r) => r.valor));
  const pct = (parte / total) * 100;
  const sujeito = n === 1 ? '1 produto concentra' : `${n} produtos concentram`;
  return `${sujeito} ${formatPct(pct, 0)} do valor vendido neste recorte.`;
}

function insightAbc(resumo: GiroView['abcResumo']): string {
  const a = resumo.find((r) => r.classe === 'A');
  if (!a || a.itens === 0) return 'Ainda não há valor para separar a curva ABC.';
  return `A classe A tem ${a.itens} ${a.itens === 1 ? 'item' : 'itens'} e concentra ${formatPct(a.participacao, 0)} do valor vendido.`;
}

function insightVariacao(
  cresceram: { nome: string; variacao: number }[],
  cairam: { nome: string; variacao: number }[],
  sobrepostos: boolean,
): string {
  if (!cresceram.length && !cairam.length) return 'Não há base de comparação para apontar crescimento ou queda.';
  const aviso = sobrepostos ? ' Os períodos se sobrepõem, então leia a variação com cuidado.' : '';
  if (cairam[0] && (!cresceram[0] || Math.abs(cairam[0].variacao) >= cresceram[0].variacao)) {
    return `${cairam[0].nome} tem a maior queda (${formatPct(cairam[0].variacao, 0)}).${aviso}`;
  }
  return `${cresceram[0].nome} tem o maior crescimento (${formatPct(cresceram[0].variacao, 0)}).${aviso}`;
}

function insightRep(linhas: { nome: string; valor: number }[]): string {
  const total = soma(linhas.map((l) => l.valor));
  if (!linhas.length || total <= 0) return 'Não há valor em estoque para comparar representadas.';
  const topo = linhas[0];
  return `${topo.nome} concentra ${formatPct((topo.valor / total) * 100, 0)} do valor em estoque.`;
}

function oportunidadesGiro(entrada: {
  parados: number;
  valorParado: number;
  rupturas: ItemRuptura[];
  negativos: number;
  limite: number;
  periodo: string;
}): Oportunidade[] {
  const lista: Oportunidade[] = [];
  if (entrada.valorParado > 0) {
    lista.push({
      id: 'giro-parados',
      modulo: 'giro',
      severidade: entrada.valorParado >= 50000 ? 'alta' : 'media',
      titulo: `${entrada.parados} ${entrada.parados === 1 ? 'item parado soma' : 'itens parados somam'} ${formatBRL(entrada.valorParado)}`,
      detalhe: `Estoque acima de zero e venda até o limite no período ${entrada.periodo}. Vale campanha, transferência ou devolução ao fornecedor.`,
      impacto: entrada.valorParado,
      ancora: '/giro#parados',
    });
  }
  if (entrada.rupturas.length) {
    const pior = [...entrada.rupturas].sort((a, b) => (a.cobertura ?? 999) - (b.cobertura ?? 999))[0];
    const cobertura =
      pior.cobertura == null ? 'sem saldo identificado' : `${formatNum(pior.cobertura, 0)} dias de cobertura`;
    lista.push({
      id: 'giro-ruptura',
      modulo: 'giro',
      severidade: 'alta',
      titulo: `${entrada.rupturas.length} ${entrada.rupturas.length === 1 ? 'líder de venda' : 'líderes de venda'} com risco de ruptura`,
      detalhe: `${pior.descricao} vende ${formatNum(pior.mediaDiaria, 1)} por dia e está com ${cobertura}. O limite atual é ${entrada.limite} dias.`,
      impacto: soma(entrada.rupturas.map((r) => r.valorVendido)),
      ancora: '/giro#ruptura',
    });
  }
  if (entrada.negativos > 0) {
    lista.push({
      id: 'giro-negativos',
      modulo: 'giro',
      severidade: 'alta',
      titulo: `${entrada.negativos} ${entrada.negativos === 1 ? 'item com estoque negativo' : 'itens com estoque negativo'}`,
      detalhe: 'O saldo negativo não entra no valor imobilizado. Corrija a posição no ERP antes de decidir compra.',
      impacto: 0,
      ancora: '/giro#qualidade',
    });
  }
  return lista;
}
