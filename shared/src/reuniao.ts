import { montarVendedores } from './vendedores.js';
import type { VendedorVisao } from './vendedores.js';
import type {
  ClienteCarteira,
  ProdutoVendido,
  RelatorioCarteira,
  RelatorioProdutos,
  RelatorioRanking,
  RelatorioVendas,
  Venda,
} from './tipos.js';
import { normCabecalho, normChave } from './texto.js';
import { filtrosVazios, formatBRL, formatNum, formatPct, quaseIgual, soma } from './numeros.js';

export interface ComparativoLinha {
  id: string;
  rotulo: string;
  dele: number | null;
  lider: number | null;
  media: number | null;
  unidade: 'moeda' | 'pct' | 'num' | 'dias';
  leitura: string;
}

export interface ClienteReuniao {
  razaoSocial: string;
  valor: number;
  pedidos: number;
  ticket: number;
  participacao: number;
  ultimaData: string | null;
  condicao: string;
}

export interface ClienteEsfriando {
  razaoSocial: string;
  situacao: string;
  diasSemComprar: number;
  cicloMedio: number | null;
  valorUltimoPedido: number | null;
  dataUltimoPedido: string | null;
  leitura: string;
}

export interface ContaSemEle {
  razaoSocial: string;
  valor: number;
  pedidos: number;
  vendedor: string;
  participacao: number;
}

export interface PedidoReuniao {
  pedido: string;
  razaoSocial: string;
  data: string | null;
  total: number;
  condicao: string;
}

export interface ProdutoEmpresa {
  nome: string;
  valor: number;
  qtd: number;
  participacao: number | null;
}

export interface PontoReuniao {
  id: string;
  titulo: string;
  detalhe: string;
  tom: 'bom' | 'alerta' | 'ruim' | 'neutro';
}

export interface ReuniaoView {
  vendedor: string;
  periodo: string | null;
  frase: string;
  temRanking: boolean;
  temVendas: boolean;
  temCarteira: boolean;
  temProdutos: boolean;
  semMeta: boolean;
  valor: number;
  participacao: number | null;
  atingimento: number | null;
  previsao: number | null;
  previsaoAtingimento: number | null;
  falta: number | null;
  meta: number | null;
  ticket: number | null;
  prazo: number | null;
  clientes: number;
  orcamentosAbertos: number | null;
  qtdOrcamentos: number | null;
  posicao: number;
  tamanhoEquipe: number;
  ehLider: boolean;
  comparativo: ComparativoLinha[];
  evolucao: { data: string; dele: number; lider: number; media: number }[];
  condicoes: { condicao: string; valor: number }[];
  melhoresClientes: ClienteReuniao[];
  esfriando: ClienteEsfriando[];
  semCompra: ClienteEsfriando[];
  contasSemEle: ContaSemEle[];
  maioresPedidos: PedidoReuniao[];
  produtosEmpresa: ProdutoEmpresa[];
  pontos: PontoReuniao[];
  avisos: string[];
}

export function listarVendedores(ranking: RelatorioRanking | null, vendas: RelatorioVendas | null): string[] {
  const nomes = new Map<string, string>();
  for (const linha of ranking?.linhas ?? []) {
    const chave = normChave(linha.vendedor);
    if (chave) nomes.set(chave, linha.vendedor);
  }
  for (const pedido of vendas?.linhas ?? []) {
    const chave = normChave(pedido.vendedor);
    if (chave && !nomes.has(chave)) nomes.set(chave, pedido.vendedor);
  }
  return [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function montarReuniao(
  ranking: RelatorioRanking | null,
  vendas: RelatorioVendas | null,
  carteira: RelatorioCarteira | null,
  produtos: RelatorioProdutos | null,
  vendedor: string | null,
): ReuniaoView | null {
  if (!vendedor || !normChave(vendedor)) return null;
  const chave = normChave(vendedor);
  const painel = montarVendedores(ranking, vendas, filtrosVazios);
  const oficial = painel.equipe.find((item) => normChave(item.vendedor) === chave);
  if (!oficial && !(vendas?.linhas.some((p) => normChave(p.vendedor) === chave))) return null;

  const nome = oficial?.vendedor ?? vendedor;
  const pedidos = vendas?.linhas ?? [];
  const fichas = painel.equipe.map((item) => numerosDaPessoa(normChave(item.vendedor), item, pedidos));
  const minha = fichas.find((item) => item.chave === chave) ?? numerosDaPessoa(chave, oficial, pedidos);
  const lider = fichas[0] ?? minha;
  const mediaEquipe = mediaDasFichas(fichas.length ? fichas : [minha]);
  const ehLider = lider.chave === chave;
  const valor = minha.valor;
  const valorEmpresa = soma(painel.equipe.map((item) => item.valorVendido));
  const participacao = valorEmpresa > 0 ? (valor / valorEmpresa) * 100 : null;
  const indice = painel.equipe.findIndex((item) => normChave(item.vendedor) === chave);
  const posicao = indice >= 0 ? indice + 1 : painel.equipe.length;
  const tamanhoEquipe = painel.equipe.length;
  const ticket = minha.ticket;
  const prazo = minha.prazo;
  const clientes = minha.clientes;

  const meus = pedidos.filter((p) => normChave(p.vendedor) === chave);
  const valorPedidos = soma(meus.map((p) => p.total));
  const melhoresClientes = agruparClientes(meus);
  const contasSemEle = maioresSemEle(pedidos, chave);
  const { esfriando, semCompra } = carteiraDele(carteira?.linhas ?? [], pedidos, chave);
  const evolucao = evoluir(pedidos, chave, lider.chave, tamanhoEquipe);
  const condicoes = agruparCondicao(meus);
  const maioresPedidos = [...meus]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((p) => ({ pedido: p.pedido, razaoSocial: p.razaoSocial, data: p.data, total: p.total, condicao: p.condicao }));
  const produtosEmpresa = topProdutos(produtos?.itens ?? []);

  const avisos: string[] = [];
  if (oficial && meus.length && !quaseIgual(oficial.valorVendido, valorPedidos)) {
    avisos.push(
      `O ranking aponta ${formatBRL(oficial.valorVendido)} e a soma dos pedidos dele é ${formatBRL(valorPedidos)}. A meta segue o ranking. Clientes, prazo e condições seguem os pedidos.`,
    );
  }
  if (!carteira) avisos.push('Sem a carteira, não dá para ver quem passou do ciclo de compra.');
  if (!vendas) avisos.push('Sem as vendas detalhadas, a reunião fica só com os números do ranking.');

  const semMeta = oficial?.semMeta ?? true;
  const frase = montarFrase(nome, valor, participacao, semMeta, oficial?.atingimento ?? null);
  const pontos = montarPontos({
    nome,
    semMeta,
    atingimento: oficial?.atingimento ?? null,
    falta: oficial?.falta ?? null,
    previsaoAtingimento: oficial?.previsaoAtingimento ?? null,
    participacao,
    posicao,
    tamanhoEquipe,
    melhor: melhoresClientes[0] ?? null,
    esfriando: esfriando[0] ?? null,
    esfriandoQtd: esfriando.length,
    conta: contasSemEle[0] ?? null,
    orcamentos: oficial?.orcamentosAbertos ?? null,
    ticket,
    ticketMedia: mediaEquipe.ticket,
    ticketLider: ehLider ? null : lider.ticket,
    prazo,
    prazoMedia: mediaEquipe.prazo,
    prazoLider: ehLider ? null : lider.prazo,
    ehLider,
    mediaValor: mediaEquipe.valor,
    valorLider: ehLider ? null : lider.valor,
  });

  return {
    vendedor: nome,
    periodo: vendas?.meta.origem ?? ranking?.meta.origem ?? null,
    frase,
    temRanking: !!ranking,
    temVendas: !!vendas,
    temCarteira: !!carteira,
    temProdutos: !!produtos,
    semMeta,
    valor,
    participacao,
    atingimento: oficial?.atingimento ?? null,
    previsao: oficial?.previsaoVendas ?? null,
    previsaoAtingimento: oficial?.previsaoAtingimento ?? null,
    falta: oficial?.falta ?? null,
    meta: oficial?.meta ?? null,
    ticket,
    prazo,
    clientes,
    orcamentosAbertos: oficial?.orcamentosAbertos ?? null,
    qtdOrcamentos: oficial?.qtdOrcamentos ?? null,
    posicao,
    tamanhoEquipe,
    ehLider,
    comparativo: [
      linha('valor', 'Valor vendido', valor, lider.valor, mediaEquipe.valor, 'moeda', 'maior', ehLider),
      linha('meta', 'Atingimento da meta', oficial?.atingimento ?? null, lider.atingimento, mediaEquipe.atingimento, 'pct', 'maior', ehLider),
      linha('ticket', 'Ticket médio', ticket, lider.ticket, mediaEquipe.ticket, 'moeda', 'maior', ehLider),
      linha('clientes', 'Clientes atendidos', clientes, lider.clientes, mediaEquipe.clientes, 'num', 'maior', ehLider),
      linha('prazo', 'Prazo médio', prazo, lider.prazo, mediaEquipe.prazo, 'dias', 'dias', ehLider),
      linha('pedidos', 'Pedidos', meus.length, lider.pedidos, mediaEquipe.pedidos, 'num', 'maior', ehLider),
    ],
    evolucao,
    condicoes,
    melhoresClientes,
    esfriando,
    semCompra,
    contasSemEle,
    maioresPedidos,
    produtosEmpresa,
    pontos,
    avisos,
  };
}

interface Ficha {
  chave: string;
  valor: number;
  atingimento: number | null;
  ticket: number | null;
  prazo: number | null;
  clientes: number;
  pedidos: number;
}

function numerosDaPessoa(chave: string, oficial: VendedorVisao | undefined, pedidos: Venda[]): Ficha {
  const meus = pedidos.filter((p) => normChave(p.vendedor) === chave);
  const valorPedidos = soma(meus.map((p) => p.total));
  return {
    chave,
    valor: oficial?.valorVendido ?? valorPedidos,
    atingimento: oficial?.atingimento ?? null,
    ticket: meus.length ? valorPedidos / meus.length : oficial?.ticketMedio ?? null,
    prazo: media(meus.map((p) => p.prazoMedio)),
    clientes: new Set(meus.map((p) => normChave(p.razaoSocial)).filter(Boolean)).size,
    pedidos: meus.length,
  };
}

function mediaDasFichas(fichas: Ficha[]): Ficha {
  const presentes = (nums: (number | null)[]) => nums.filter((n): n is number => n != null);
  return {
    chave: '',
    valor: media(fichas.map((f) => f.valor)) ?? 0,
    atingimento: media(presentes(fichas.map((f) => f.atingimento))),
    ticket: media(presentes(fichas.map((f) => f.ticket))),
    prazo: media(presentes(fichas.map((f) => f.prazo))),
    clientes: media(fichas.map((f) => f.clientes)) ?? 0,
    pedidos: media(fichas.map((f) => f.pedidos)) ?? 0,
  };
}

function linha(
  id: string,
  rotulo: string,
  dele: number | null,
  doLider: number | null,
  daMedia: number | null,
  unidade: ComparativoLinha['unidade'],
  modo: 'maior' | 'dias',
  ehLider: boolean,
): ComparativoLinha {
  return {
    id,
    rotulo,
    dele,
    lider: doLider,
    media: daMedia,
    unidade,
    leitura: leituraComparada(dele, doLider, daMedia, modo, ehLider),
  };
}

function media(nums: number[]): number | null {
  if (!nums.length) return null;
  return soma(nums) / nums.length;
}

function leituraComparada(
  dele: number | null,
  doLider: number | null,
  daMedia: number | null,
  modo: 'maior' | 'dias',
  ehLider: boolean,
): string {
  const contraMedia = classificar(dele, daMedia, modo, 'média');
  if (ehLider) return contraMedia ? `É o 1º lugar. ${contraMedia}` : 'É o 1º lugar.';
  const contraLider = classificar(dele, doLider, modo, '1º lugar');
  return [contraMedia, contraLider].filter(Boolean).join(' ') || 'Sem base para comparar.';
}

function classificar(dele: number | null, base: number | null, modo: 'maior' | 'dias', alvo: 'média' | '1º lugar'): string {
  if (dele == null || base == null) return '';
  const igual = Math.abs(dele - base) < 0.05;
  const perto = Math.abs(dele - base) / Math.max(Math.abs(base), 1) < 0.1;
  if (modo === 'dias') {
    if (igual) return alvo === 'média' ? 'Na média.' : 'Igual ao 1º lugar.';
    if (perto) return alvo === 'média' ? 'Na média.' : 'Perto do 1º lugar.';
    if (dele > base) return alvo === 'média' ? 'Prazo maior que a média.' : 'Prazo maior que o 1º lugar.';
    return alvo === 'média' ? 'Prazo menor que a média.' : 'Prazo menor que o 1º lugar.';
  }
  if (igual || perto) return alvo === 'média' ? 'Na média.' : igual ? 'Igual ao 1º lugar.' : 'Perto do 1º lugar.';
  if (dele > base) return alvo === 'média' ? 'Acima da média.' : 'Acima do 1º lugar.';
  return alvo === 'média' ? 'Abaixo da média.' : 'Abaixo do 1º lugar.';
}

function montarFrase(nome: string, valor: number, participacao: number | null, semMeta: boolean, atingimento: number | null): string {
  const partes = [`${nome} vendeu ${formatBRL(valor)}`];
  if (participacao != null) partes.push(`responde por ${formatPct(participacao, 0)} do faturamento da equipe`);
  if (semMeta) partes.push('está sem meta cadastrada');
  else if (atingimento != null) partes.push(`está em ${formatPct(atingimento, 0)} da meta`);
  if (partes.length === 1) return `${partes[0]}.`;
  const ultima = partes[partes.length - 1];
  return `${partes.slice(0, -1).join(', ')} e ${ultima}.`;
}

function agruparClientes(pedidos: Venda[]): ClienteReuniao[] {
  const mapa = new Map<string, { nome: string; valor: number; pedidos: number; ultima: string | null; condicoes: Map<string, number> }>();
  for (const pedido of pedidos) {
    const chave = normChave(pedido.razaoSocial);
    if (!chave) continue;
    const atual = mapa.get(chave) ?? { nome: pedido.razaoSocial, valor: 0, pedidos: 0, ultima: null, condicoes: new Map() };
    atual.valor += pedido.total;
    atual.pedidos += 1;
    if (pedido.data && (!atual.ultima || pedido.data > atual.ultima)) atual.ultima = pedido.data;
    atual.condicoes.set(pedido.condicao || 'Sem condição', (atual.condicoes.get(pedido.condicao || 'Sem condição') ?? 0) + 1);
    mapa.set(chave, atual);
  }
  const total = soma([...mapa.values()].map((item) => item.valor));
  return [...mapa.values()]
    .map((item) => ({
      razaoSocial: item.nome,
      valor: item.valor,
      pedidos: item.pedidos,
      ticket: item.pedidos ? item.valor / item.pedidos : 0,
      participacao: total > 0 ? (item.valor / total) * 100 : 0,
      ultimaData: item.ultima,
      condicao: [...item.condicoes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
    }))
    .sort((a, b) => b.valor - a.valor || a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'));
}

function maioresSemEle(pedidos: Venda[], chave: string): ContaSemEle[] {
  const mapa = new Map<string, { nome: string; valor: number; pedidos: number; vendedores: Map<string, { nome: string; n: number }> }>();
  const comEle = new Set<string>();
  for (const pedido of pedidos) {
    const cliente = normChave(pedido.razaoSocial);
    if (!cliente) continue;
    if (normChave(pedido.vendedor) === chave) {
      comEle.add(cliente);
      continue;
    }
    const atual = mapa.get(cliente) ?? { nome: pedido.razaoSocial, valor: 0, pedidos: 0, vendedores: new Map() };
    atual.valor += pedido.total;
    atual.pedidos += 1;
    const vend = normChave(pedido.vendedor);
    const cont = atual.vendedores.get(vend) ?? { nome: pedido.vendedor, n: 0 };
    cont.n += 1;
    atual.vendedores.set(vend, cont);
    mapa.set(cliente, atual);
  }
  const total = soma(pedidos.map((p) => p.total));
  return [...mapa.entries()]
    .filter(([cliente]) => !comEle.has(cliente))
    .map(([, item]) => ({
      razaoSocial: item.nome,
      valor: item.valor,
      pedidos: item.pedidos,
      vendedor: [...item.vendedores.values()].sort((a, b) => b.n - a.n)[0]?.nome ?? '—',
      participacao: total > 0 ? (item.valor / total) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);
}

function carteiraDele(linhas: ClienteCarteira[], pedidos: Venda[], chave: string): { esfriando: ClienteEsfriando[]; semCompra: ClienteEsfriando[] } {
  const modal = new Map<string, Map<string, { nome: string; n: number }>>();
  const atendidos = new Set<string>();
  for (const pedido of pedidos) {
    const cliente = normChave(pedido.razaoSocial);
    if (!cliente) continue;
    if (normChave(pedido.vendedor) === chave) atendidos.add(cliente);
    const porVend = modal.get(cliente) ?? new Map();
    const vend = normChave(pedido.vendedor);
    const atual = porVend.get(vend) ?? { nome: pedido.vendedor, n: 0 };
    atual.n += 1;
    porVend.set(vend, atual);
    modal.set(cliente, porVend);
  }
  const pedidoPorId = new Map<string, Venda>();
  for (const pedido of pedidos) {
    const id = normChave(pedido.pedido);
    if (id) pedidoPorId.set(`${normChave(pedido.razaoSocial)}|${id}`, pedido);
  }

  const esfriando: ClienteEsfriando[] = [];
  const semCompra: ClienteEsfriando[] = [];
  for (const cliente of linhas) {
    const idCliente = normChave(cliente.razaoSocial);
    const dono = [...(modal.get(idCliente)?.values() ?? [])].sort((a, b) => b.n - a.n)[0];
    const ultimo = pedidoPorId.get(`${idCliente}|${normChave(cliente.ultimoPedido)}`);
    const ehDele = (dono && normChave(dono.nome) === chave) || (ultimo && normChave(ultimo.vendedor) === chave);
    if (!ehDele) continue;
    const servido = atendidos.has(idCliente);
    const ativo = normCabecalho(cliente.situacao) === 'ativo';
    const passou = ativo && cliente.cicloMedio != null && cliente.cicloMedio > 0 && cliente.diasSemComprar > cliente.cicloMedio;
    if (servido && passou) {
      esfriando.push({
        razaoSocial: cliente.razaoSocial,
        situacao: cliente.situacao,
        diasSemComprar: cliente.diasSemComprar,
        cicloMedio: cliente.cicloMedio,
        valorUltimoPedido: cliente.valorUltimoPedido,
        dataUltimoPedido: cliente.dataUltimoPedido,
        leitura: `${formatNum(cliente.diasSemComprar, 0)} dias sem comprar, ciclo de ${formatNum(cliente.cicloMedio ?? 0, 0)}`,
      });
    } else if (!servido) {
      semCompra.push({
        razaoSocial: cliente.razaoSocial,
        situacao: cliente.situacao,
        diasSemComprar: cliente.diasSemComprar,
        cicloMedio: cliente.cicloMedio,
        valorUltimoPedido: cliente.valorUltimoPedido,
        dataUltimoPedido: cliente.dataUltimoPedido,
        leitura: cliente.situacao.trim() ? `${cliente.situacao}, sem pedido neste período` : 'Sem pedido neste período',
      });
    }
  }
  esfriando.sort((a, b) => (b.valorUltimoPedido ?? 0) - (a.valorUltimoPedido ?? 0));
  semCompra.sort((a, b) => (b.valorUltimoPedido ?? 0) - (a.valorUltimoPedido ?? 0) || b.diasSemComprar - a.diasSemComprar);
  return { esfriando, semCompra };
}

function evoluir(
  pedidos: Venda[],
  chave: string,
  chaveLider: string,
  tamanhoEquipe: number,
): { data: string; dele: number; lider: number; media: number }[] {
  const dias = new Map<string, { dele: number; lider: number; total: number }>();
  for (const pedido of pedidos) {
    if (!pedido.data) continue;
    const atual = dias.get(pedido.data) ?? { dele: 0, lider: 0, total: 0 };
    const deQuem = normChave(pedido.vendedor);
    atual.total += pedido.total;
    if (deQuem === chave) atual.dele += pedido.total;
    if (deQuem === chaveLider) atual.lider += pedido.total;
    dias.set(pedido.data, atual);
  }
  const pessoas = Math.max(tamanhoEquipe, 1);
  return [...dias.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, valor]) => ({ data, dele: valor.dele, lider: valor.lider, media: valor.total / pessoas }));
}

function agruparCondicao(pedidos: Venda[]): { condicao: string; valor: number }[] {
  const mapa = new Map<string, number>();
  for (const pedido of pedidos) {
    const nome = pedido.condicao || 'Sem condição';
    mapa.set(nome, (mapa.get(nome) ?? 0) + pedido.total);
  }
  return [...mapa.entries()]
    .map(([condicao, valor]) => ({ condicao, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function topProdutos(itens: ProdutoVendido[]): ProdutoEmpresa[] {
  return [...itens]
    .filter((item) => item.valor1 > 0)
    .sort((a, b) => b.valor1 - a.valor1)
    .slice(0, 8)
    .map((item) => ({ nome: item.nome, valor: item.valor1, qtd: item.qtd1, participacao: item.partValor1 }));
}

function montarPontos(ctx: {
  nome: string;
  semMeta: boolean;
  atingimento: number | null;
  falta: number | null;
  previsaoAtingimento: number | null;
  participacao: number | null;
  posicao: number;
  tamanhoEquipe: number;
  melhor: ClienteReuniao | null;
  esfriando: ClienteEsfriando | null;
  esfriandoQtd: number;
  conta: ContaSemEle | null;
  orcamentos: number | null;
  ticket: number | null;
  ticketMedia: number | null;
  ticketLider: number | null;
  prazo: number | null;
  prazoMedia: number | null;
  prazoLider: number | null;
  ehLider: boolean;
  mediaValor: number | null;
  valorLider: number | null;
}): PontoReuniao[] {
  const pontos: PontoReuniao[] = [];
  if (ctx.semMeta) {
    pontos.push({ id: 'meta', titulo: 'Meta', detalhe: `${ctx.nome} está sem meta neste ranking. Dá para combinar um número antes de cobrar ritmo.`, tom: 'alerta' });
  } else if (ctx.atingimento != null && ctx.atingimento >= 100) {
    pontos.push({ id: 'meta', titulo: 'Meta', detalhe: `Já passou da meta, em ${formatPct(ctx.atingimento, 0)}. Vale reconhecer o que segurou esse resultado.`, tom: 'bom' });
  } else if (ctx.falta != null && ctx.falta > 0) {
    const previsao = ctx.previsaoAtingimento == null ? '' : ` A previsão fecha em ${formatPct(ctx.previsaoAtingimento, 0)}.`;
    pontos.push({ id: 'meta', titulo: 'Meta', detalhe: `Faltam ${formatBRL(ctx.falta)} para a meta.${previsao}`, tom: 'ruim' });
  } else if (ctx.atingimento != null) {
    pontos.push({ id: 'meta', titulo: 'Meta', detalhe: `O atingimento está em ${formatPct(ctx.atingimento, 0)}.`, tom: 'neutro' });
  }
  if (ctx.participacao != null) {
    const referencia = ctx.ehLider
      ? `É o 1º lugar. A média por vendedor é ${formatBRL(ctx.mediaValor ?? 0)}.`
      : `O 1º lugar vendeu ${formatBRL(ctx.valorLider ?? 0)}. A média por vendedor é ${formatBRL(ctx.mediaValor ?? 0)}.`;
    pontos.push({
      id: 'contribuicao',
      titulo: 'Contribuição',
      detalhe: `${formatPct(ctx.participacao, 0)} do faturamento da equipe. ${ctx.posicao}º de ${ctx.tamanhoEquipe}. ${referencia}`,
      tom: 'neutro',
    });
  }
  if (ctx.melhor) {
    pontos.push({
      id: 'cliente',
      titulo: 'Melhor cliente',
      detalhe: `${ctx.melhor.razaoSocial} soma ${formatBRL(ctx.melhor.valor)}, ${formatPct(ctx.melhor.participacao, 0)} do que ele vendeu.`,
      tom: 'bom',
    });
  }
  if (ctx.esfriando) {
    pontos.push({
      id: 'ciclo',
      titulo: 'Cliente esfriando',
      detalhe: `${ctx.esfriando.razaoSocial} está em ${ctx.esfriando.leitura}. ${ctx.esfriandoQtd === 1 ? 'É 1 cliente dele nessa situação.' : `São ${ctx.esfriandoQtd} clientes dele nessa situação.`}`,
      tom: 'alerta',
    });
  }
  if (ctx.conta) {
    pontos.push({
      id: 'contas',
      titulo: 'Conta que comprou sem ele',
      detalhe: `${ctx.conta.razaoSocial} comprou ${formatBRL(ctx.conta.valor)} com ${ctx.conta.vendedor}.`,
      tom: 'alerta',
    });
  }
  if (ctx.orcamentos != null && ctx.orcamentos > 0) {
    pontos.push({ id: 'orcamentos', titulo: 'Orçamento parado', detalhe: `${formatBRL(ctx.orcamentos)} em orçamentos em aberto. É valor, não quantidade de propostas.`, tom: 'alerta' });
  }
  if (ctx.ticket != null && ctx.ticketMedia != null && Math.abs(ctx.ticket - ctx.ticketMedia) / Math.max(ctx.ticketMedia, 1) >= 0.15) {
    const contraLider = ctx.ticketLider == null ? '' : ` O 1º lugar está em ${formatBRL(ctx.ticketLider)}.`;
    pontos.push({
      id: 'ticket',
      titulo: 'Ticket',
      detalhe: `O pedido médio dele é ${formatBRL(ctx.ticket)}, contra ${formatBRL(ctx.ticketMedia)} na média dos vendedores.${contraLider}`,
      tom: ctx.ticket >= ctx.ticketMedia ? 'bom' : 'alerta',
    });
  }
  if (ctx.prazo != null && ctx.prazoMedia != null && Math.abs(ctx.prazo - ctx.prazoMedia) >= 5) {
    const contraLider = ctx.prazoLider == null ? '' : ` O 1º lugar está em ${formatNum(ctx.prazoLider, 0)} dias.`;
    pontos.push({
      id: 'prazo',
      titulo: 'Prazo',
      detalhe: `O prazo médio dele é ${formatNum(ctx.prazo, 0)} dias, contra ${formatNum(ctx.prazoMedia, 0)} na média.${contraLider}`,
      tom: ctx.prazo > ctx.prazoMedia + 5 ? 'alerta' : 'neutro',
    });
  }
  return pontos.slice(0, 6);
}
