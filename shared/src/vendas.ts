import { FAIXAS_PEDIDO } from './catalogo.js';
import { filtrarVendas } from './filtros.js';
import {
  DIAS_SEMANA,
  diaSemanaIndice,
  diasInclusivos,
  diasNoMes,
  fimDoMes,
  formatBRL,
  formatData,
  formatNum,
  formatPct,
  inicioDoMes,
  inicioSemana,
  soma,
} from './numeros.js';
import { normChave } from './texto.js';
import type { Filtros, Oportunidade, RelatorioVendas, Venda } from './tipos.js';

export interface PontoSerie {
  rotulo: string;
  chave: string;
  valor: number;
  pedidos: number;
}

export interface VendasView {
  temVendas: boolean;
  kpis: {
    faturamento: number;
    pedidos: number;
    ticketMedio: number | null;
    clientes: number;
    prazoMedio: number | null;
    projecao: number | null;
    diasDecorridos: number | null;
    diasMes: number | null;
    incompleto: boolean;
  };
  porDia: { data: string; valor: number; pedidos: number }[];
  heatmap: { semana: string; dia: number; valor: number }[];
  porCondicao: { condicao: string; valor: number; pedidos: number; prazo: number }[];
  porVendedor: { nome: string; valor: number; pedidos: number }[];
  porCliente: { nome: string; valor: number; pedidos: number }[];
  maiores: Venda[];
  faixas: { rotulo: string; pedidos: number; valor: number }[];
  porDiaSemana: { dia: string; valor: number }[];
  insights: { evolucao: string; calor: string; condicao: string; clientes: string };
  avisos: string[];
  oportunidades: Oportunidade[];
  origem: string | null;
}

export function montarVendas(relatorio: RelatorioVendas | null, filtros: Filtros): VendasView {
  const vazio = viewVazia();
  if (!relatorio) return vazio;
  const pedidos = filtrarVendas(relatorio.linhas, filtros);
  const pedidosSemCondicao = filtrarVendas(relatorio.linhas, { ...filtros, condicao: null });
  const faturamento = soma(pedidos.map((p) => p.total));
  const ticketMedio = pedidos.length ? faturamento / pedidos.length : null;
  const clientes = new Set(pedidos.map((p) => normChave(p.razaoSocial))).size;
  const prazoMedio = pedidos.length ? soma(pedidos.map((p) => p.prazoMedio)) / pedidos.length : null;
  const ritmo = projetar(relatorio, faturamento);

  const porDiaMap = new Map<string, { valor: number; pedidos: number }>();
  for (const pedido of pedidos) {
    if (!pedido.data) continue;
    const atual = porDiaMap.get(pedido.data) ?? { valor: 0, pedidos: 0 };
    atual.valor += pedido.total;
    atual.pedidos += 1;
    porDiaMap.set(pedido.data, atual);
  }
  const porDia = [...porDiaMap.entries()]
    .map(([data, info]) => ({ data, valor: info.valor, pedidos: info.pedidos }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const calor = new Map<string, number>();
  for (const ponto of porDia) {
    const chave = `${inicioSemana(ponto.data)}|${diaSemanaIndice(ponto.data)}`;
    calor.set(chave, (calor.get(chave) ?? 0) + ponto.valor);
  }
  const heatmap = [...calor.entries()].map(([chave, valor]) => {
    const [semana, dia] = chave.split('|');
    return { semana, dia: Number(dia), valor };
  });

  const semanaValor = [0, 0, 0, 0, 0, 0, 0];
  for (const ponto of porDia) semanaValor[diaSemanaIndice(ponto.data)] += ponto.valor;
  const porDiaSemana = DIAS_SEMANA.map((dia, i) => ({ dia, valor: semanaValor[i] ?? 0 }));

  const porCondicao = agrupar(pedidosSemCondicao, (p) => p.condicao || 'Sem condição').map((g) => ({
    condicao: g.nome,
    valor: g.valor,
    pedidos: g.pedidos,
    prazo: g.pedidos ? soma(g.linhas.map((p) => p.prazoMedio)) / g.pedidos : 0,
  }));
  const porVendedor = agrupar(
    filtrarVendas(relatorio.linhas, { ...filtros, vendedor: null }),
    (p) => p.vendedor,
  ).map((g) => ({ nome: g.nome, valor: g.valor, pedidos: g.pedidos }));
  const porCliente = agrupar(
    filtrarVendas(relatorio.linhas, { ...filtros, cliente: null }),
    (p) => p.razaoSocial,
  ).map((g) => ({ nome: g.nome, valor: g.valor, pedidos: g.pedidos }));

  const maiores = [...pedidos].sort((a, b) => b.total - a.total).slice(0, 8);
  const faixas = FAIXAS_PEDIDO.map((f) => ({ rotulo: f.rotulo, pedidos: 0, valor: 0 }));
  for (const pedido of pedidos) {
    const rotulo = rotuloFaixa(pedido.total);
    const alvo = faixas.find((f) => f.rotulo === rotulo);
    if (!alvo) continue;
    alvo.pedidos += 1;
    alvo.valor += pedido.total;
  }

  const diaForte = [...porDiaSemana].sort((a, b) => b.valor - a.valor)[0];
  const condTop = porCondicao[0];
  const condTotal = soma(porCondicao.map((c) => c.valor));
  const clienteTop = [...porCliente].sort((a, b) => b.valor - a.valor)[0];

  const oportunidades: Oportunidade[] = [];
  if (prazoMedio != null && prazoMedio > 45) {
    const longos = pedidos.filter((p) => p.prazoMedio > 45);
    const impacto = soma(longos.map((p) => p.total));
    oportunidades.push({
      id: 'prazo-longo',
      modulo: 'vendas',
      severidade: prazoMedio > 60 ? 'alta' : 'media',
      titulo: `Prazo médio de ${formatNum(prazoMedio, 0)} dias`,
      detalhe: `${formatBRL(impacto)} estão em condições acima de 45 dias. Vale revisar limite por vendedor.`,
      impacto,
      ancora: '/vendas#condicao',
    });
  }
  if (clienteTop && faturamento > 0 && clienteTop.valor / faturamento >= 0.3) {
    oportunidades.push({
      id: 'concentracao-clientes',
      modulo: 'vendas',
      severidade: clienteTop.valor / faturamento >= 0.5 ? 'alta' : 'media',
      titulo: `${clienteTop.nome} concentra ${formatPct((clienteTop.valor / faturamento) * 100, 0)} do faturamento`,
      detalhe: 'Se esse cliente esfriar, o mês muda de patamar. Vale um plano de conta.',
      impacto: clienteTop.valor,
      ancora: '/vendas#clientes',
    });
  }

  return {
    temVendas: true,
    kpis: {
      faturamento,
      pedidos: pedidos.length,
      ticketMedio,
      clientes,
      prazoMedio,
      projecao: ritmo.projecao,
      diasDecorridos: ritmo.diasDecorridos,
      diasMes: ritmo.diasMes,
      incompleto: ritmo.incompleto,
    },
    porDia,
    heatmap,
    porCondicao,
    porVendedor,
    porCliente,
    maiores,
    faixas,
    porDiaSemana,
    insights: {
      evolucao: insightEvolucao(porDia),
      calor: diaForte && diaForte.valor > 0 ? `${diaForte.dia} é o dia da semana com maior faturamento neste recorte.` : 'Sem datas para ver o ritmo da semana.',
      condicao: condTop && condTotal > 0
        ? `${condTop.condicao} concentra ${formatPct((condTop.valor / condTotal) * 100, 0)} do valor. O prazo médio do recorte é ${formatNum(prazoMedio ?? 0, 0)} dias.`
        : 'Sem condição de pagamento no recorte.',
      clientes: clienteTop && faturamento > 0
        ? `${clienteTop.nome} responde por ${formatPct((clienteTop.valor / faturamento) * 100, 0)} do faturamento.`
        : 'Sem clientes no recorte.',
    },
    avisos: [...relatorio.meta.avisos],
    oportunidades,
    origem: relatorio.meta.origem,
  };
}

export function agruparSerie(
  dias: { data: string; valor: number; pedidos: number }[],
  modo: 'dia' | 'semana' | 'mes',
): PontoSerie[] {
  const mapa = new Map<string, PontoSerie>();
  for (const dia of dias) {
    const chave = modo === 'dia' ? dia.data : modo === 'semana' ? inicioSemana(dia.data) : dia.data.slice(0, 7);
    const rotulo = modo === 'mes' ? rotuloMes(chave) : formatData(chave);
    const atual = mapa.get(chave) ?? { rotulo, chave, valor: 0, pedidos: 0 };
    atual.valor += dia.valor;
    atual.pedidos += dia.pedidos;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave));
}

function viewVazia(): VendasView {
  return {
    temVendas: false,
    kpis: {
      faturamento: 0,
      pedidos: 0,
      ticketMedio: null,
      clientes: 0,
      prazoMedio: null,
      projecao: null,
      diasDecorridos: null,
      diasMes: null,
      incompleto: false,
    },
    porDia: [],
    heatmap: [],
    porCondicao: [],
    porVendedor: [],
    porCliente: [],
    maiores: [],
    faixas: [],
    porDiaSemana: [],
    insights: { evolucao: '', calor: '', condicao: '', clientes: '' },
    avisos: [],
    oportunidades: [],
    origem: null,
  };
}

function projetar(relatorio: RelatorioVendas, faturamento: number) {
  const inicio = relatorio.meta.periodoInicio;
  const fim = relatorio.meta.periodoFim;
  if (!inicio || !fim || inicio.slice(0, 7) !== fim.slice(0, 7)) {
    return { projecao: null, diasDecorridos: null, diasMes: null, incompleto: false };
  }
  const fimMes = fimDoMes(fim);
  const incompleto = inicio > inicioDoMes(fim) || fim < fimMes;
  const diasDecorridos = diasInclusivos(inicio, fim);
  const diasMes = diasNoMes(fim);
  const projecao = incompleto && diasDecorridos > 0 ? (faturamento / diasDecorridos) * diasMes : null;
  return { projecao, diasDecorridos, diasMes, incompleto };
}

function agrupar(pedidos: Venda[], nomeDe: (pedido: Venda) => string) {
  const mapa = new Map<string, { nome: string; valor: number; pedidos: number; linhas: Venda[] }>();
  for (const pedido of pedidos) {
    const nome = nomeDe(pedido) || 'Sem nome';
    const chave = normChave(nome);
    const atual = mapa.get(chave) ?? { nome, valor: 0, pedidos: 0, linhas: [] };
    atual.valor += pedido.total;
    atual.pedidos += 1;
    atual.linhas.push(pedido);
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

function rotuloFaixa(valor: number): string {
  if (valor <= 500) return FAIXAS_PEDIDO[0].rotulo;
  if (valor <= 2000) return FAIXAS_PEDIDO[1].rotulo;
  if (valor <= 5000) return FAIXAS_PEDIDO[2].rotulo;
  if (valor <= 10000) return FAIXAS_PEDIDO[3].rotulo;
  if (valor <= 50000) return FAIXAS_PEDIDO[4].rotulo;
  return FAIXAS_PEDIDO[5].rotulo;
}

function insightEvolucao(dias: { valor: number }[]): string {
  if (dias.length < 2) return 'É preciso mais de um dia com venda para ver se o ritmo acelerou.';
  const meio = Math.floor(dias.length / 2);
  const antes = soma(dias.slice(0, meio).map((d) => d.valor));
  const depois = soma(dias.slice(meio).map((d) => d.valor));
  if (antes <= 0) return 'A venda se concentrou na segunda metade do período.';
  const variacao = ((depois - antes) / antes) * 100;
  if (variacao >= 0) return `A segunda metade do período faturou ${formatPct(variacao, 0)} a mais que a primeira.`;
  return `A segunda metade do período faturou ${formatPct(Math.abs(variacao), 0)} a menos que a primeira.`;
}

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const indice = Number(mes) - 1;
  return `${nomes[indice] ?? mes}/${ano}`;
}
