import { RELATORIOS } from '@dash/shared';
import type { ColunaEsperada } from '@dash/shared';
import type {
  CategoriaProduto,
  ClienteCarteira,
  Conferencia,
  ItemEstoque,
  MetaRelatorio,
  PeriodoRotulo,
  ProdutoVendido,
  Relatorio,
  RelatorioCarteira,
  RelatorioEstoque,
  RelatorioProdutos,
  RelatorioRanking,
  RelatorioVendas,
  TipoRelatorio,
  TotaisProdutos,
  Venda,
  VendedorRanking,
} from '@dash/shared';
import {
  fimDoMes,
  formatBRL,
  formatData,
  normCabecalho,
  normChave,
  normDesc,
  parseData,
  parseNumero,
  prazoMedioCondicao,
  quaseIgual,
  relacaoPeriodos,
  soma,
  tituloSituacao,
} from '@dash/shared';
import * as XLSX from 'xlsx';
import { z } from 'zod';

export class PlanilhaErro extends Error {
  codigo: 'colunas' | 'tipo' | 'vazio' | 'leitura';

  constructor(mensagem: string, codigo: PlanilhaErro['codigo']) {
    super(mensagem);
    this.name = 'PlanilhaErro';
    this.codigo = codigo;
  }
}

interface Celula {
  raw: unknown;
  text: string;
}

interface Matriz {
  aba: string;
  linhas: Celula[][];
  corte: boolean;
}

const metaSchema = z.object({
  titulo: z.string().min(1),
  periodoInicio: z.string().nullable(),
  periodoFim: z.string().nullable(),
  referencia: z.string().nullable(),
  filtros: z.array(z.object({ rotulo: z.string(), valor: z.string() })),
  aba: z.string(),
  linhasDados: z.number().int().nonnegative(),
  origem: z.string(),
  avisos: z.array(z.string()),
});

const REGRAS_TOPO: { rotulo: string; re: RegExp }[] = [
  { rotulo: 'Data inicial', re: /data inicial:\s*(\d{2}\/\d{2}\/\d{4})/i },
  { rotulo: 'Data final', re: /data final:\s*(\d{2}\/\d{2}\/\d{4})/i },
  { rotulo: 'Situação dos pedidos', re: /situa[cç][aã]o dos pedidos:\s*([^\r\n]+)/i },
  { rotulo: 'Situações', re: /situa[cç][oõ]es:\s*([^\r\n]+)/i },
  { rotulo: 'Ano', re: /\bano:\s*(\d{4})/i },
  { rotulo: 'Mês', re: /\bm[eê]s:\s*([A-Za-zÀ-ÿ]+)/i },
  { rotulo: 'Períodos', re: /per[ií]odos:\s*([^\r\n]+)/i },
  { rotulo: 'Período', re: /per[ií]odo:\s*(\d{2}\/\d{2}\/\d{4})/i },
  { rotulo: 'Agrupado por categoria', re: /agrupado por categoria:\s*(sim|n[aã]o)/i },
  { rotulo: 'Exibir valores com impostos', re: /exibir valores com impostos:\s*(sim|n[aã]o)/i },
];

const MESES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

export function lerMatriz(buffer: Buffer): Matriz {
  if (!buffer?.length) throw new PlanilhaErro('O arquivo está vazio.', 'leitura');
  let pasta: XLSX.WorkBook;
  try {
    pasta = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellText: true });
  } catch {
    throw new PlanilhaErro('Não consegui ler este arquivo. Envie um .xls ou .xlsx exportado do ERP.', 'leitura');
  }
  if (!pasta.SheetNames.length) throw new PlanilhaErro('A planilha não tem abas.', 'vazio');
  const aba = pasta.SheetNames.find((nome) => normCabecalho(nome) === 'relatorio') ?? pasta.SheetNames[0];
  const folha = pasta.Sheets[aba];
  if (!folha?.['!ref']) throw new PlanilhaErro('A aba do relatório está vazia.', 'vazio');
  const alcance = XLSX.utils.decode_range(folha['!ref']);
  const limite = Math.min(alcance.e.r, alcance.s.r + 20000);
  const linhas: Celula[][] = [];
  for (let r = alcance.s.r; r <= limite; r += 1) {
    const linha: Celula[] = [];
    for (let c = alcance.s.c; c <= alcance.e.c; c += 1) {
      const celula = folha[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (!celula) linha.push({ raw: null, text: '' });
      else linha.push({ raw: celula.v ?? null, text: String(celula.w ?? celula.v ?? '').trim() });
    }
    linhas.push(linha);
  }
  return { aba, linhas, corte: limite < alcance.e.r };
}

export function analisarArquivo(
  buffer: Buffer,
  slot: TipoRelatorio | 'auto',
  confirmar: boolean,
):
  | { ok: true; relatorio: Relatorio }
  | { ok: false; codigo: 'slot_incorreto'; detectado: TipoRelatorio; mensagem: string } {
  const matriz = lerMatriz(buffer);
  const detectado = detectarMatriz(matriz);
  if (slot !== 'auto' && detectado && detectado !== slot && !confirmar) {
    return {
      ok: false,
      codigo: 'slot_incorreto',
      detectado,
      mensagem: `Este arquivo é o relatório "${RELATORIOS[detectado].titulo}", mas foi colocado em "${RELATORIOS[slot].titulo}".`,
    };
  }
  const tipo = slot === 'auto' || confirmar ? detectado : slot;
  if (!tipo) {
    throw new PlanilhaErro(
      'Não reconheci o relatório. Confira se é Vendas detalhadas, Carteira detalhada de clientes, Ranking de vendedores, Estoque ou Produtos mais vendidos.',
      'tipo',
    );
  }
  return { ok: true, relatorio: parsearTipo(tipo, matriz) };
}

export function detectarBuffer(buffer: Buffer): TipoRelatorio | null {
  return detectarMatriz(lerMatriz(buffer));
}

function detectarMatriz(matriz: Matriz): TipoRelatorio | null {
  const pontos: { tipo: TipoRelatorio; nota: number }[] = [];
  for (const tipo of ['vendas', 'carteira', 'ranking', 'estoque'] as const) {
    const local = localizar(matriz.linhas, RELATORIOS[tipo].esperadas);
    if (local.found < 3) continue;
    const completo = local.found === RELATORIOS[tipo].esperadas.length;
    pontos.push({ tipo, nota: local.found + (completo ? 100 : 0) });
  }
  if (acharProdutos(matriz.linhas) >= 0) pontos.push({ tipo: 'produtos', nota: 130 });
  pontos.sort((a, b) => b.nota - a.nota);
  if (!pontos.length) return null;
  if (pontos[0].nota >= 100) return pontos[0].tipo;
  if (pontos.length === 1 || pontos[0].nota > pontos[1].nota) return pontos[0].tipo;
  return null;
}

function parsearTipo(tipo: TipoRelatorio, matriz: Matriz): Relatorio {
  if (tipo === 'vendas') return parseVendas(matriz);
  if (tipo === 'carteira') return parseCarteira(matriz);
  if (tipo === 'ranking') return parseRanking(matriz);
  if (tipo === 'estoque') return parseEstoque(matriz);
  return parseProdutos(matriz);
}

function parseVendas(matriz: Matriz): RelatorioVendas {
  const cabecalho = exigirCabecalho(matriz, 'vendas');
  const campos = lerTopo(matriz.linhas, cabecalho.i);
  const avisos = avisosIniciais(matriz);
  const linhas: Venda[] = [];
  let ignoradas = 0;
  for (const linha of matriz.linhas.slice(cabecalho.i + 1)) {
    if (linhaVazia(linha)) continue;
    const pedido = comoTexto(bruto(linha[cabecalho.map.pedido]));
    if (!pedido || normCabecalho(pedido) === 'total') continue;
    const total = parseNumero(bruto(linha[cabecalho.map.total]));
    const candidato = {
      data: parseData(bruto(linha[cabecalho.map.data])),
      pedido,
      razaoSocial: comoTexto(bruto(linha[cabecalho.map.razao])),
      nomeFantasia: comoTexto(bruto(linha[cabecalho.map.fantasia])),
      vendedor: comoTexto(bruto(linha[cabecalho.map.vendedor])),
      condicao: comoTexto(bruto(linha[cabecalho.map.condicao])),
      prazoMedio: prazoMedioCondicao(comoTexto(bruto(linha[cabecalho.map.condicao]))),
      total: total ?? Number.NaN,
    };
    const validado = z
      .object({
        data: z.string().nullable(),
        pedido: z.string().min(1),
        razaoSocial: z.string(),
        nomeFantasia: z.string(),
        vendedor: z.string(),
        condicao: z.string(),
        prazoMedio: z.number().finite(),
        total: z.number().finite(),
      })
      .safeParse(candidato);
    if (!validado.success) {
      ignoradas += 1;
      continue;
    }
    linhas.push(validado.data);
  }
  if (ignoradas) avisos.push(fraseIgnoradas(ignoradas));
  if (!linhas.length) throw new PlanilhaErro('O cabeçalho foi encontrado, mas não há linhas de dados.', 'vazio');
  const inicio = parseData(valorCampo(campos, 'Data inicial'));
  const fim = parseData(valorCampo(campos, 'Data final'));
  const situacao = valorCampo(campos, 'Situação dos pedidos');
  const meta = fecharMeta({
    titulo: RELATORIOS.vendas.titulo,
    periodoInicio: inicio,
    periodoFim: fim,
    referencia: null,
    filtros: campos,
    aba: matriz.aba,
    linhasDados: linhas.length,
    origem: inicio && fim ? `${formatData(inicio)} a ${formatData(fim)}${situacao ? ` · ${situacao}` : ''}` : 'Período não identificado no topo da planilha',
    avisos,
  });
  return { tipo: 'vendas', meta, linhas };
}

function parseCarteira(matriz: Matriz): RelatorioCarteira {
  const cabecalho = exigirCabecalho(matriz, 'carteira');
  const campos = lerTopo(matriz.linhas, cabecalho.i);
  const avisos = avisosIniciais(matriz);
  const linhas: ClienteCarteira[] = [];
  let ignoradas = 0;
  for (const linha of matriz.linhas.slice(cabecalho.i + 1)) {
    if (linhaVazia(linha)) continue;
    const razao = comoTexto(bruto(linha[cabecalho.map.razao]));
    if (!razao || normCabecalho(razao) === 'total') continue;
    const ultimo = comoTexto(bruto(linha[cabecalho.map.ultimoPedido]));
    const diasBruto = parseNumero(bruto(linha[cabecalho.map.dias]));
    const cicloBruto = parseNumero(bruto(linha[cabecalho.map.ciclo]));
    const candidato = {
      chave: `${normChave(razao)}|${ultimo}`,
      razaoSocial: razao,
      ultimoPedido: ultimo,
      dataUltimoPedido: parseData(bruto(linha[cabecalho.map.dataUltimo])),
      valorUltimoPedido: parseNumero(bruto(linha[cabecalho.map.valorUltimo])),
      diasSemComprar: diasBruto == null ? 0 : diasBruto,
      cicloMedio: cicloBruto == null || cicloBruto <= 0 ? null : cicloBruto,
      situacao: tituloSituacao(comoTexto(bruto(linha[cabecalho.map.situacao]))),
    };
    const validado = z
      .object({
        chave: z.string().min(1),
        razaoSocial: z.string().min(1),
        ultimoPedido: z.string(),
        dataUltimoPedido: z.string().nullable(),
        valorUltimoPedido: z.number().finite().nullable(),
        diasSemComprar: z.number().finite(),
        cicloMedio: z.number().finite().nullable(),
        situacao: z.string(),
      })
      .safeParse(candidato);
    if (!validado.success) {
      ignoradas += 1;
      continue;
    }
    linhas.push(validado.data);
  }
  if (ignoradas) avisos.push(fraseIgnoradas(ignoradas));
  if (!linhas.length) throw new PlanilhaErro('O cabeçalho foi encontrado, mas não há linhas de dados.', 'vazio');
  const referencia = parseData(valorCampo(campos, 'Período'));
  const situacoes = valorCampo(campos, 'Situações');
  const meta = fecharMeta({
    titulo: RELATORIOS.carteira.titulo,
    periodoInicio: null,
    periodoFim: null,
    referencia,
    filtros: campos,
    aba: matriz.aba,
    linhasDados: linhas.length,
    origem: `${referencia ? `Referência ${formatData(referencia)}` : 'Referência não identificada'}${situacoes ? ` · ${situacoes}` : ''}`,
    avisos,
  });
  return { tipo: 'carteira', meta, linhas };
}

function parseRanking(matriz: Matriz): RelatorioRanking {
  const cabecalho = exigirCabecalho(matriz, 'ranking');
  const campos = lerTopo(matriz.linhas, cabecalho.i);
  const avisos = avisosIniciais(matriz);
  const linhas: VendedorRanking[] = [];
  let ignoradas = 0;
  for (const linha of matriz.linhas.slice(cabecalho.i + 1)) {
    if (linhaVazia(linha)) continue;
    const vendedor = comoTexto(bruto(linha[cabecalho.map.vendedor]));
    if (!vendedor || normCabecalho(vendedor) === 'total') continue;
    const metaValor = parseNumero(bruto(linha[cabecalho.map.meta]));
    const semMeta = metaValor == null || metaValor <= 0;
    const valor = parseNumero(bruto(linha[cabecalho.map.valor])) ?? 0;
    const previsao = parseNumero(bruto(linha[cabecalho.map.previsao]));
    const atingimento = semMeta ? null : (percentual(linha[cabecalho.map.atingimento]) ?? (metaValor ? (valor / metaValor) * 100 : null));
    const previsaoAting = semMeta
      ? null
      : (percentual(linha[cabecalho.map.previsaoAtingimento]) ?? (metaValor && previsao != null ? (previsao / metaValor) * 100 : null));
    const candidato = {
      ranking: parseNumero(bruto(linha[cabecalho.map.ranking])),
      vendedor,
      atingimento,
      valorVendido: valor,
      ticketMedio: parseNumero(bruto(linha[cabecalho.map.ticket])),
      clientesPositivados: parseNumero(bruto(linha[cabecalho.map.positivados])),
      meta: semMeta ? null : metaValor,
      previsaoVendas: previsao,
      previsaoAtingimento: previsaoAting,
      qtdOrcamentos: parseNumero(bruto(linha[cabecalho.map.qtdOrcamentos])),
      orcamentosAbertos: parseNumero(bruto(linha[cabecalho.map.orcamentosAbertos])),
      semMeta,
    };
    const validado = z
      .object({
        ranking: z.number().finite().nullable(),
        vendedor: z.string().min(1),
        atingimento: z.number().finite().nullable(),
        valorVendido: z.number().finite(),
        ticketMedio: z.number().finite().nullable(),
        clientesPositivados: z.number().finite().nullable(),
        meta: z.number().finite().nullable(),
        previsaoVendas: z.number().finite().nullable(),
        previsaoAtingimento: z.number().finite().nullable(),
        qtdOrcamentos: z.number().finite().nullable(),
        orcamentosAbertos: z.number().finite().nullable(),
        semMeta: z.boolean(),
      })
      .safeParse(candidato);
    if (!validado.success) {
      ignoradas += 1;
      continue;
    }
    linhas.push(validado.data);
  }
  if (ignoradas) avisos.push(fraseIgnoradas(ignoradas));
  if (!linhas.length) throw new PlanilhaErro('O cabeçalho foi encontrado, mas não há linhas de dados.', 'vazio');
  const ano = valorCampo(campos, 'Ano');
  const mes = valorCampo(campos, 'Mês');
  const periodo = periodoRanking(ano, mes);
  const meta = fecharMeta({
    titulo: RELATORIOS.ranking.titulo,
    periodoInicio: periodo?.inicio ?? null,
    periodoFim: periodo?.fim ?? null,
    referencia: periodo ? `${mes}/${ano}` : null,
    filtros: campos,
    aba: matriz.aba,
    linhasDados: linhas.length,
    origem: mes && ano ? `${mes}/${ano}` : 'Mês não identificado no topo da planilha',
    avisos,
  });
  return { tipo: 'ranking', meta, linhas };
}

function parseEstoque(matriz: Matriz): RelatorioEstoque {
  const cabecalho = exigirCabecalho(matriz, 'estoque');
  const avisos = avisosIniciais(matriz);
  const linhas: ItemEstoque[] = [];
  let totalLinha: number | null = null;
  let ignoradas = 0;
  const dados = matriz.linhas.slice(cabecalho.i + 1);
  for (const linha of dados) {
    if (linhaVazia(linha)) continue;
    const codigo = comoTexto(bruto(linha[cabecalho.map.codigo]));
    const valor = parseNumero(bruto(linha[cabecalho.map.valor]));
    if (!codigo) {
      if (valor != null) totalLinha = valor;
      continue;
    }
    const estoque = parseNumero(bruto(linha[cabecalho.map.estoque]));
    const descricao = comoTexto(bruto(linha[cabecalho.map.descricao]));
    const candidato = {
      chave: `${codigo}|${normDesc(descricao)}`,
      codigo,
      descricao,
      representada: comoTexto(bruto(linha[cabecalho.map.representada])) || 'Sem representada',
      estoque: estoque ?? Number.NaN,
      valorTotal: valor ?? 0,
      negativo: (estoque ?? 0) < 0,
    };
    const validado = z
      .object({
        chave: z.string(),
        codigo: z.string().min(1),
        descricao: z.string(),
        representada: z.string(),
        estoque: z.number().finite(),
        valorTotal: z.number().finite(),
        negativo: z.boolean(),
      })
      .safeParse(candidato);
    if (!validado.success) {
      ignoradas += 1;
      continue;
    }
    linhas.push(validado.data);
  }
  if (ignoradas) avisos.push(fraseIgnoradas(ignoradas));
  if (!linhas.length) throw new PlanilhaErro('O cabeçalho foi encontrado, mas não há linhas de dados.', 'vazio');
  const somaValor = soma(linhas.filter((item) => !item.negativo).map((item) => item.valorTotal));
  const conferencia: Conferencia = totalLinha == null
    ? { ok: true, mensagem: 'O relatório de estoque não trouxe uma linha de total para conferir.', somaValor, totalInformado: null }
    : {
        ok: quaseIgual(somaValor, totalLinha),
        mensagem: quaseIgual(somaValor, totalLinha)
          ? 'Total do estoque confere com a soma dos itens.'
          : `A soma dos itens não confere com o total do relatório de estoque (${formatBRL(somaValor)} contra ${formatBRL(totalLinha)}).`,
        somaValor,
        totalInformado: totalLinha,
      };
  if (!conferencia.ok) avisos.push(conferencia.mensagem);
  const porCodigo = new Map<string, string[]>();
  for (const item of linhas) {
    porCodigo.set(item.codigo, [...(porCodigo.get(item.codigo) ?? []), item.descricao]);
  }
  const codigosDuplicados = [...porCodigo.entries()]
    .filter(([, descricoes]) => new Set(descricoes.map((d) => normDesc(d))).size > 1)
    .map(([codigo, descricoes]) => ({ codigo, descricoes }));
  if (codigosDuplicados.length) {
    avisos.push(`${codigosDuplicados.length} ${codigosDuplicados.length === 1 ? 'código aparece' : 'códigos aparecem'} em mais de uma descrição.`);
  }
  const meta = fecharMeta({
    titulo: RELATORIOS.estoque.titulo,
    periodoInicio: null,
    periodoFim: null,
    referencia: null,
    filtros: [],
    aba: matriz.aba,
    linhasDados: linhas.length,
    origem: 'Posição atual do estoque',
    avisos,
  });
  return { tipo: 'estoque', meta, linhas, conferencia, codigosDuplicados };
}

interface ProdutoBruto {
  nome: string;
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
  semBase: boolean;
  qtdTotal: number | null;
  valorTotal: number | null;
}

function parseProdutos(matriz: Matriz): RelatorioProdutos {
  const header = acharProdutos(matriz.linhas);
  if (header < 0) {
    throw new PlanilhaErro(
      'Não encontrei a linha de cabeçalho. Faltam as colunas: Categorias e Produtos, Quantidade vendida.',
      'colunas',
    );
  }
  const cabeca = matriz.linhas[header] ?? [];
  const base = cabeca.findIndex((celula) => normCelula(celula).includes('categorias e produtos'));
  const avisos = avisosIniciais(matriz);
  if (!normCelula(cabeca[base + 1] ?? { raw: null, text: '' }).includes('quantidade')) {
    avisos.push('O primeiro bloco não começa com "Quantidade vendida". A leitura usou a posição padrão das colunas.');
  }
  const campos = lerTopo(matriz.linhas, header);
  const intervalos = extrairIntervalos(matriz.linhas, header);
  const periodo1 = intervalos[0] ?? { inicio: null, fim: null, rotulo: 'Período atual' };
  const periodo2 = intervalos[1] ?? { inicio: null, fim: null, rotulo: 'Período de comparação' };
  if (intervalos.length < 2) avisos.push('Não encontrei os dois rótulos de período no topo. Os blocos foram lidos pela posição das colunas.');

  let relacao: RelatorioProdutos['relacao'] = 'indefinido';
  let sobrepostos = false;
  if (periodo1.inicio && periodo1.fim && periodo2.inicio && periodo2.fim) {
    relacao = relacaoPeriodos({ inicio: periodo1.inicio, fim: periodo1.fim }, { inicio: periodo2.inicio, fim: periodo2.fim });
    sobrepostos = relacao !== 'separado';
  }
  if (sobrepostos) avisos.push(avisoSobreposicao(periodo1, periodo2, relacao));

  const agrupadoCampo = valorCampo(campos, 'Agrupado por categoria');
  const agrupadoPorCategoria = agrupadoCampo ? normCabecalho(agrupadoCampo).startsWith('sim') : false;
  const brutos: ProdutoBruto[] = [];
  let totalGeral: TotaisProdutos | null = null;
  for (const linha of matriz.linhas.slice(header + 1)) {
    if (linhaVazia(linha)) continue;
    const nome = comoTexto(bruto(linha[base]));
    if (!nome) continue;
    const item = lerProduto(linha, base, nome);
    if (normCabecalho(nome) === 'total geral' || normCabecalho(nome).startsWith('total geral')) {
      totalGeral = {
        qtd1: item.qtd1,
        valor1: item.valor1,
        qtd2: item.qtd2,
        valor2: item.valor2,
        qtdTotal: item.qtdTotal,
        valorTotal: item.valorTotal,
      };
      continue;
    }
    brutos.push(item);
  }
  const { itens, categorias } = partirCategorias(brutos, agrupadoPorCategoria);
  if (!itens.length) throw new PlanilhaErro('O cabeçalho foi encontrado, mas não há produtos depois dele.', 'vazio');
  z.array(
    z.object({
      nome: z.string().min(1),
      categoria: z.string().nullable(),
      qtd1: z.number().finite(),
      valor1: z.number().finite(),
      qtd2: z.number().finite(),
      valor2: z.number().finite(),
      semBase: z.boolean(),
      varQtd: z.number().finite().nullable(),
      varValor: z.number().finite().nullable(),
    }).passthrough(),
  ).parse(itens);
  const somaValor = soma(itens.map((item) => item.valor1));
  const somaQtd = soma(itens.map((item) => item.qtd1));
  const conferencia: Conferencia = !totalGeral
    ? {
        ok: false,
        mensagem: 'Não encontrei a linha Total geral. O relatório possivelmente foi truncado pelo ERP.',
        somaValor,
        totalInformado: null,
      }
    : {
        ok: quaseIgual(somaValor, totalGeral.valor1) && quaseIgual(somaQtd, totalGeral.qtd1),
        mensagem:
          quaseIgual(somaValor, totalGeral.valor1) && quaseIgual(somaQtd, totalGeral.qtd1)
            ? 'Total geral confere com a soma dos itens.'
            : `A soma dos itens (${formatBRL(somaValor)}) não confere com o Total geral (${formatBRL(totalGeral.valor1)}). O relatório possivelmente foi truncado pelo ERP.`,
        somaValor,
        totalInformado: totalGeral.valor1,
      };
  if (!conferencia.ok) avisos.push(conferencia.mensagem);
  const meta = fecharMeta({
    titulo: RELATORIOS.produtos.titulo,
    periodoInicio: periodo1.inicio,
    periodoFim: periodo1.fim,
    referencia: null,
    filtros: campos,
    aba: matriz.aba,
    linhasDados: itens.length,
    origem: `${periodo1.rotulo} comparado com ${periodo2.rotulo}`,
    avisos,
  });
  return {
    tipo: 'produtos',
    meta,
    periodo1,
    periodo2,
    sobrepostos,
    relacao,
    agrupadoPorCategoria,
    itens,
    categorias,
    totalGeral,
    conferencia,
  };
}

function lerProduto(linha: Celula[], base: number, nome: string): ProdutoBruto {
  const qtd2 = numero(linha, base + 8) ?? 0;
  const valor2 = numero(linha, base + 9) ?? 0;
  const varQtd = lerVariacao(linha[base + 14], qtd2, valor2);
  const varValor = lerVariacao(linha[base + 15], qtd2, valor2);
  return {
    nome,
    qtd1: numero(linha, base + 1) ?? 0,
    valor1: numero(linha, base + 2) ?? 0,
    ticket1: numero(linha, base + 3),
    partQtd1: percentual(linha[base + 4]),
    partValor1: percentual(linha[base + 5]),
    partTicket1: percentual(linha[base + 6]),
    qtd2,
    valor2,
    ticket2: numero(linha, base + 10),
    partQtd2: percentual(linha[base + 11]),
    partValor2: percentual(linha[base + 12]),
    partTicket2: percentual(linha[base + 13]),
    varQtd: varQtd.valor,
    varValor: varValor.valor,
    semBase: varValor.semBase,
    qtdTotal: numero(linha, base + 17),
    valorTotal: numero(linha, base + 18),
  };
}

function lerVariacao(celula: Celula | undefined, qtdBase: number, valorBase: number): { valor: number | null; semBase: boolean } {
  if (!celula || (bruto(celula) == null && !celula.text)) return { valor: null, semBase: true };
  if (!comoTexto(bruto(celula)) && !celula.text) return { valor: null, semBase: true };
  const n = percentual(celula);
  if (n == null) return { valor: null, semBase: true };
  if (qtdBase === 0 && valorBase === 0) return { valor: null, semBase: true };
  if (n === 100 && qtdBase === 0) return { valor: null, semBase: true };
  return { valor: n, semBase: false };
}

function partirCategorias(brutos: ProdutoBruto[], agrupado: boolean): { itens: ProdutoVendido[]; categorias: CategoriaProduto[] } {
  if (!agrupado) return { itens: brutos.map((item) => paraProduto(item, null)), categorias: [] };
  const itens: ProdutoVendido[] = [];
  const categorias: CategoriaProduto[] = [];
  let i = 0;
  while (i < brutos.length) {
    const grupo = menorGrupo(brutos, i);
    if (grupo != null) {
      const pai = brutos[i];
      categorias.push({ nome: pai.nome, qtd1: pai.qtd1, valor1: pai.valor1, qtd2: pai.qtd2, valor2: pai.valor2 });
      for (const filho of brutos.slice(i + 1, i + 1 + grupo)) itens.push(paraProduto(filho, pai.nome));
      i += 1 + grupo;
      continue;
    }
    if (categoriaVazia(brutos[i]) && i + 1 < brutos.length && !categoriaVazia(brutos[i + 1])) {
      const nome = brutos[i].nome;
      i += 1;
      while (i < brutos.length && !categoriaVazia(brutos[i]) && menorGrupo(brutos, i) == null) {
        itens.push(paraProduto(brutos[i], nome));
        i += 1;
      }
      continue;
    }
    itens.push(paraProduto(brutos[i], null));
    i += 1;
  }
  return { itens, categorias };
}

function menorGrupo(linhas: ProdutoBruto[], i: number): number | null {
  const pai = linhas[i];
  if (!pai || (pai.qtd1 === 0 && pai.valor1 === 0)) return null;
  let qtd = 0;
  let valor = 0;
  for (let k = 1; i + k < linhas.length; k += 1) {
    qtd += linhas[i + k].qtd1;
    valor += linhas[i + k].valor1;
    if (quaseIgual(qtd, pai.qtd1) && quaseIgual(valor, pai.valor1)) {
      if (k === 1 && normDesc(linhas[i + 1]?.nome ?? '') === normDesc(pai.nome)) return null;
      return k;
    }
    if (valor > pai.valor1 * 1.02 && qtd > pai.qtd1 * 1.02) break;
  }
  return null;
}

function categoriaVazia(item: ProdutoBruto): boolean {
  return item.qtd1 === 0 && item.valor1 === 0 && item.qtd2 === 0 && item.valor2 === 0;
}

function paraProduto(item: ProdutoBruto, categoria: string | null): ProdutoVendido {
  return { ...item, categoria };
}

function avisoSobreposicao(p1: PeriodoRotulo, p2: PeriodoRotulo, relacao: RelatorioProdutos['relacao']): string {
  if (relacao === 'contido') {
    return `Os períodos se sobrepõem: ${p1.rotulo} está contido em ${p2.rotulo}. A variação percentual não é uma comparação entre períodos independentes.`;
  }
  if (relacao === 'contem') {
    return `Os períodos se sobrepõem: ${p2.rotulo} está contido em ${p1.rotulo}. A variação percentual não é uma comparação entre períodos independentes.`;
  }
  return `Os períodos se sobrepõem (${p1.rotulo} e ${p2.rotulo}). A variação percentual não é uma comparação entre períodos independentes.`;
}

function extrairIntervalos(linhas: Celula[][], ate: number): PeriodoRotulo[] {
  const vistos = new Set<string>();
  const saida: PeriodoRotulo[] = [];
  const re = /(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/gi;
  for (let r = 0; r < ate; r += 1) {
    for (const celula of linhas[r] ?? []) {
      const texto = celula.text || comoTexto(celula.raw);
      for (const match of texto.matchAll(re)) {
        const rotulo = `${match[1]} a ${match[2]}`;
        if (vistos.has(rotulo)) continue;
        vistos.add(rotulo);
        saida.push({ inicio: parseData(match[1]), fim: parseData(match[2]), rotulo });
      }
    }
  }
  return saida;
}

function exigirCabecalho(matriz: Matriz, tipo: TipoRelatorio) {
  const colunas = RELATORIOS[tipo].esperadas;
  const local = localizar(matriz.linhas, colunas);
  if (local.found !== colunas.length) {
    const faltam = local.found === 0 ? colunas.map((coluna) => coluna.rotulo) : local.missing;
    throw new PlanilhaErro(`Não encontrei a linha de cabeçalho. Faltam as colunas: ${faltam.join(', ')}.`, 'colunas');
  }
  return local;
}

function localizar(linhas: Celula[][], colunas: ColunaEsperada[]) {
  let melhor = { i: -1, found: 0, missing: colunas.map((coluna) => coluna.rotulo), map: {} as Record<string, number> };
  linhas.forEach((linha, i) => {
    const textos = linha.map(normCelula);
    const map: Record<string, number> = {};
    const missing: string[] = [];
    for (const coluna of colunas) {
      const nomes = [coluna.rotulo, ...(coluna.aliases ?? [])].map((nome) => normCabecalho(nome));
      const idx = textos.findIndex((texto) => nomes.includes(texto));
      if (idx >= 0) map[coluna.chave] = idx;
      else missing.push(coluna.rotulo);
    }
    const found = colunas.length - missing.length;
    if (found > melhor.found) melhor = { i, found, missing, map };
  });
  return melhor;
}

function acharProdutos(linhas: Celula[][]): number {
  return linhas.findIndex((linha) => {
    const textos = linha.map(normCelula);
    const temNome = textos.some((texto) => texto.includes('categorias e produtos'));
    const quantidades = textos.filter((texto) => texto === 'quantidade vendida' || texto.startsWith('quantidade vendida')).length;
    return temNome && quantidades >= 1;
  });
}

function lerTopo(linhas: Celula[][], ate: number): { rotulo: string; valor: string }[] {
  const campos: { rotulo: string; valor: string }[] = [];
  const vistos = new Set<string>();
  for (let i = 0; i < ate; i += 1) {
    const texto = (linhas[i] ?? []).map((celula) => celula.text || comoTexto(celula.raw)).filter(Boolean).join(' ');
    if (!texto) continue;
    for (const regra of REGRAS_TOPO) {
      if (vistos.has(regra.rotulo)) continue;
      const match = texto.match(regra.re);
      if (!match?.[1]) continue;
      vistos.add(regra.rotulo);
      campos.push({ rotulo: regra.rotulo, valor: match[1].trim().replace(/[|,]\s*$/, '') });
    }
  }
  return campos;
}

function periodoRanking(ano: string | null, mes: string | null): { inicio: string; fim: string } | null {
  if (!ano || !mes) return null;
  const numero = MESES[normCabecalho(mes)];
  if (!numero) return null;
  const inicio = `${ano}-${String(numero).padStart(2, '0')}-01`;
  return { inicio, fim: fimDoMes(inicio) };
}

function avisosIniciais(matriz: Matriz): string[] {
  const avisos: string[] = [];
  if (normCabecalho(matriz.aba) !== 'relatorio') {
    avisos.push(`A aba lida foi "${matriz.aba}". O exportado do ERP costuma se chamar Relatório.`);
  }
  if (matriz.corte) avisos.push('A planilha passou de 20 mil linhas e a leitura foi interrompida.');
  return avisos;
}

function fecharMeta(meta: MetaRelatorio): MetaRelatorio {
  return metaSchema.parse(meta);
}

function valorCampo(campos: { rotulo: string; valor: string }[], rotulo: string): string | null {
  return campos.find((campo) => campo.rotulo === rotulo)?.valor ?? null;
}

function normCelula(celula: Celula): string {
  return normCabecalho(celula.text || comoTexto(celula.raw));
}

function bruto(celula: Celula | undefined): unknown {
  if (!celula) return null;
  if (celula.raw != null && celula.raw !== '') return celula.raw;
  if (celula.text) return celula.text;
  return null;
}

function numero(linha: Celula[], indice: number): number | null {
  return parseNumero(bruto(linha[indice]));
}

function percentual(celula: Celula | undefined): number | null {
  const n = parseNumero(bruto(celula));
  if (n == null) return null;
  if ((celula?.text ?? '').includes('%') && Math.abs(n) <= 3) return n * 100;
  return n;
}

function comoTexto(valor: unknown): string {
  if (valor == null) return '';
  if (typeof valor === 'number' && Number.isFinite(valor)) return Number.isInteger(valor) ? String(valor) : String(valor);
  if (valor instanceof Date) return parseData(valor) ?? '';
  return String(valor).trim();
}

function linhaVazia(linha: Celula[]): boolean {
  return linha.every((celula) => !comoTexto(bruto(celula)));
}

function fraseIgnoradas(qtd: number): string {
  return qtd === 1 ? '1 linha foi ignorada por dados inválidos.' : `${qtd} linhas foram ignoradas por dados inválidos.`;
}
