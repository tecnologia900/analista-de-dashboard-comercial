import {
  OBJETIVOS,
  RELATORIOS,
  agruparSerie,
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
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Grafico, corAtingimento, opcaoBarrasH, opcaoDonut, opcaoLinhas } from '../grafico';
import { usePainel } from '../store';
import { fraseLeitura, leituraCarteira, leituraExecutivo, leituraGiro, leituraVendas, leituraVendedores } from '../leitura';
import { Kpi, Leitura, Moldura, Vazio } from '../ui';

export function Executivo() {
  const relatorios = usePainel((s) => s.relatorios);
  const filtros = usePainel((s) => s.filtros);
  const coberturaMax = usePainel((s) => s.coberturaMax);
  const escuro = usePainel((s) => s.tema) === 'escuro';
  const ctx = useMemo(
    () => ({ ...relatorios, filtros, coberturaMaxDias: coberturaMax }),
    [relatorios, filtros, coberturaMax],
  );
  const acoes = useMemo(() => principaisDoDia(listarOportunidades(ctx), 8), [ctx]);
  const giro = useMemo(() => montarGiro(relatorios.produtos, relatorios.estoque, filtros, { coberturaMaxDias: coberturaMax }), [relatorios, filtros, coberturaMax]);
  const carteira = useMemo(() => montarCarteira(relatorios.carteira, relatorios.vendas, filtros), [relatorios, filtros]);
  const vendedores = useMemo(() => montarVendedores(relatorios.ranking, relatorios.vendas, filtros), [relatorios, filtros]);
  const vendas = useMemo(() => montarVendas(relatorios.vendas, filtros), [relatorios, filtros]);
  const respostas = useMemo(
    () => leituraExecutivo([
      leituraGiro(giro, relatorios.produtos?.itens),
      leituraVendedores(vendedores),
      leituraVendas(vendas),
      leituraCarteira(carteira),
    ]),
    [giro, vendedores, vendas, carteira, relatorios.produtos],
  );
  const algum = Object.values(relatorios).some(Boolean);

  if (!algum) {
    return (
      <Moldura titulo="Visão executiva">
        <Vazio titulo="Nada carregado ainda" detalhe="A visão executiva junta o que cada planilha liberar. Comece pelo objetivo do dia ou suba os cinco arquivos." href="/" />
      </Moldura>
    );
  }

  const serie = agruparSerie(vendas.porDia, 'dia');
  const comMeta = vendedores.equipe.filter((v) => !v.semMeta).slice(0, 8);

  return (
    <Moldura titulo="Visão executiva">
      <Leitura frase={fraseLeitura(respostas)} itens={respostas} />
      <section>
        <h2 className="mb-3 text-[15px] font-semibold">Ações do dia, por impacto</h2>
        {acoes.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma ação com valor estimado neste recorte.</p>
        ) : (
          <ol className="grid gap-3 lg:grid-cols-2">
            {acoes.map((acao, indice) => (
              <li key={acao.id}>
                <Link to={acao.ancora} className={`card sev-${acao.severidade} block p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {indice + 1} · {formatBRL(acao.impacto)}
                  </p>
                  <p className="mt-1 font-semibold">{acao.titulo}</p>
                  <p className="mt-1 text-sm text-muted">{acao.detalhe}</p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {relatorios.vendas && <Kpi rotulo="Faturamento" valor={formatBRL(vendas.kpis.faturamento)} detalhe={vendas.kpis.projecao != null ? `Projeção ${formatBRL(vendas.kpis.projecao)}` : vendas.origem ?? undefined} />}
        {relatorios.ranking && <Kpi rotulo="Atingimento da equipe" valor={vendedores.kpis.atingimentoPonderado == null ? 'Sem meta' : formatPct(vendedores.kpis.atingimentoPonderado, 0)} />}
        {relatorios.estoque && <Kpi rotulo="Parado em estoque" valor={formatBRL(giro.kpis.valorParado)} detalhe={`${giro.kpis.itensParados} itens`} tom={giro.kpis.valorParado > 0 ? 'alerta' : 'bom'} />}
        {relatorios.carteira && <Kpi rotulo="Carteira ativa" valor={carteira.kpis.pctAtivos == null ? '—' : formatPct(carteira.kpis.pctAtivos, 0)} detalhe={`${formatNum(carteira.kpis.ativos, 0)} ativos`} />}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {relatorios.produtos ? (
          <section className="card p-4">
            <h2 className="mb-2 text-[15px] font-semibold">Produtos que puxam o valor</h2>
            <p className="mb-2 text-sm text-muted">{giro.insights.topo}</p>
            <Grafico altura={260} option={opcaoBarrasH(escuro, giro.ranking.slice(0, 5).map((i) => i.nome), giro.ranking.slice(0, 5).map((i) => i.valor), formatBRL)} />
            <Link to="/giro" className="mt-2 inline-block text-sm text-[var(--accent)]">Abrir giro</Link>
          </section>
        ) : (
          <Falta objetivo="giro" />
        )}
        {relatorios.vendas ? (
          <section className="card p-4">
            <h2 className="mb-2 text-[15px] font-semibold">Ritmo das vendas</h2>
            <p className="mb-2 text-sm text-muted">{vendas.insights.evolucao}</p>
            <Grafico option={opcaoLinhas(escuro, serie.map((p) => formatData(p.chave)), [{ nome: 'Faturamento', dados: serie.map((p) => p.valor) }], formatBRL)} altura={260} />
            <Link to="/vendas" className="mt-2 inline-block text-sm text-[var(--accent)]">Abrir vendas</Link>
          </section>
        ) : (
          <Falta objetivo="vendas" />
        )}
        {relatorios.ranking ? (
          <section className="card p-4">
            <h2 className="mb-2 text-[15px] font-semibold">Atingimento</h2>
            <p className="mb-2 text-sm text-muted">{vendedores.insights.meta}</p>
            <Grafico
              altura={260}
              option={opcaoBarrasH(escuro, comMeta.map((v) => v.vendedor), comMeta.map((v) => v.atingimento ?? 0), (n) => formatPct(n, 0), { cores: comMeta.map((v) => corAtingimento(v.atingimento, escuro)) })}
            />
            <Link to="/vendedores" className="mt-2 inline-block text-sm text-[var(--accent)]">Abrir vendedores</Link>
          </section>
        ) : (
          <Falta objetivo="vendedores" />
        )}
        {relatorios.carteira ? (
          <section className="card p-4">
            <h2 className="mb-2 text-[15px] font-semibold">Situação da carteira</h2>
            <p className="mb-2 text-sm text-muted">{carteira.insights.situacao}</p>
            <Grafico option={opcaoDonut(escuro, carteira.porSituacao.map((s) => ({ nome: s.situacao, valor: s.clientes })), (n) => formatNum(n, 0))} altura={260} />
            <Link to="/carteira" className="mt-2 inline-block text-sm text-[var(--accent)]">Abrir carteira</Link>
          </section>
        ) : (
          <Falta objetivo="carteira" />
        )}
      </div>
    </Moldura>
  );
}

function Falta({ objetivo }: { objetivo: 'giro' | 'carteira' | 'vendedores' | 'vendas' }) {
  const def = OBJETIVOS.find((item) => item.id === objetivo);
  return (
    <section className="card p-4">
      <h2 className="font-semibold">{def?.titulo}</h2>
      <p className="mt-1 text-sm text-muted">
        Envie {def?.relatorios.map((tipo) => RELATORIOS[tipo].titulo).join(' e ')} para liberar este bloco.
      </p>
      <Link to={`/carregar/${objetivo}`} className="btn mt-3">
        Enviar
      </Link>
    </section>
  );
}
