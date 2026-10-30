import { formatBRL, formatData, formatNum, formatPct, montarVendedores } from '@dash/shared';
import { useMemo } from 'react';
import { Grafico, corAtingimento, opcaoBarrasGrupo, opcaoBarrasH, opcaoDispersao, opcaoDonut, opcaoLinhas } from '../grafico';
import { Tabela } from '../tabela';
import { alternarFiltro, usePainel } from '../store';
import { fraseLeitura, leituraVendedores } from '../leitura';
import { Avisos, Bloco, Kpi, Leitura, Moldura, Oportunidades, Selecao, Vazio } from '../ui';

export function Vendedores() {
  const ranking = usePainel((s) => s.relatorios.ranking);
  const vendas = usePainel((s) => s.relatorios.vendas);
  const filtros = usePainel((s) => s.filtros);
  const setFiltro = usePainel((s) => s.setFiltro);
  const escuro = usePainel((s) => s.tema) === 'escuro';
  const view = useMemo(() => montarVendedores(ranking, vendas, filtros), [ranking, vendas, filtros]);
  const respostas = useMemo(() => leituraVendedores(view), [view]);

  const comMeta = view.equipe.filter((v) => !v.semMeta);
  const evolucao = useMemo(() => pivotar(view.evolucao), [view.evolucao]);

  if (!ranking && !vendas) {
    return (
      <Moldura titulo="Desempenho de vendedores">
        <Vazio titulo="Faltam as planilhas de vendedores" detalhe="Envie o Ranking de vendedores e as Vendas detalhadas para ver meta, ticket, positivação e orçamento parado." href="/carregar/vendedores" />
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Desempenho de vendedores">
      <Avisos itens={view.avisos} />
      <Leitura frase={fraseLeitura(respostas)} itens={respostas} />
      <Oportunidades itens={view.oportunidades} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Valor vendido" valor={formatBRL(view.kpis.valorVendido)} detalhe={ranking?.meta.origem} />
        <Kpi
          rotulo="Atingimento ponderado"
          valor={view.kpis.atingimentoPonderado == null ? 'Sem meta' : formatPct(view.kpis.atingimentoPonderado, 0)}
          tom={view.kpis.atingimentoPonderado == null ? 'neutro' : view.kpis.atingimentoPonderado >= 100 ? 'bom' : view.kpis.atingimentoPonderado >= 70 ? 'alerta' : 'ruim'}
        />
        <Kpi rotulo="Ticket médio" valor={view.kpis.ticketMedio == null ? '—' : formatBRL(view.kpis.ticketMedio)} detalhe={`${formatNum(view.kpis.clientesPositivados, 0)} clientes positivados`} />
        <Kpi rotulo="Orçamentos em aberto" valor={formatBRL(view.kpis.orcamentosAbertos)} detalhe={view.kpis.faltaEquipe > 0 ? `Faltam ${formatBRL(view.kpis.faltaEquipe)} na projeção` : 'Valor em R$, não quantidade'} tom={view.kpis.orcamentosAbertos > 0 ? 'alerta' : 'neutro'} />
      </div>
      <div className="no-print">
        <Selecao rotulo="Vendedor" valor={filtros.vendedor} opcoes={view.equipe.map((v) => v.vendedor)} aoMudar={(v) => setFiltro('vendedor', v)} />
      </div>
      {!ranking ? (
        <Vazio titulo="Falta o ranking de vendedores" detalhe="Meta, previsão, positivação oficial e orçamentos em aberto vêm desse arquivo." href="/carregar/vendedores" />
      ) : (
        <>
          <Bloco id="meta" titulo="Atingimento de meta" insight={view.insights.meta}>
            <Grafico
              altura={Math.max(240, comMeta.length * 32)}
              option={opcaoBarrasH(
                escuro,
                comMeta.map((v) => v.vendedor),
                comMeta.map((v) => v.atingimento ?? 0),
                (n) => formatPct(n, 0),
                { cores: comMeta.map((v) => corAtingimento(v.atingimento, escuro)), destaque: filtros.vendedor },
              )}
              aoClicar={(nome) => alternarFiltro('vendedor', nome)}
            />
          </Bloco>
          <Bloco titulo="Meta, vendido e previsão" insight="A previsão vazia no ERP não entra na conta. Quem não tem meta fica no grupo separado.">
            <Grafico
              option={opcaoBarrasGrupo(
                escuro,
                comMeta.map((v) => v.vendedor),
                [
                  { nome: 'Meta', dados: comMeta.map((v) => v.meta ?? 0) },
                  { nome: 'Vendido', dados: comMeta.map((v) => v.valorVendido) },
                  { nome: 'Previsão', dados: comMeta.map((v) => v.previsaoVendas ?? 0) },
                ],
                formatBRL,
              )}
              aoClicar={(nome) => alternarFiltro('vendedor', nome)}
            />
          </Bloco>
          <Bloco id="previsao" titulo="Projetados abaixo da meta" insight="A conta usa a previsão do ranking. Se ela vier vazia e o mês estiver aberto, o ritmo das vendas completa a projeção.">
            <Tabela
              linhas={view.abaixo}
              nomeArquivo="abaixo-da-meta"
              colunas={[
                { id: 'vendedor', titulo: 'Vendedor', valor: (l) => l.vendedor },
                { id: 'meta', titulo: 'Meta', valor: (l) => l.meta, tipo: 'moeda' },
                { id: 'vendido', titulo: 'Vendido', valor: (l) => l.valorVendido, tipo: 'moeda' },
                { id: 'previsao', titulo: 'Previsão', valor: (l) => l.previsaoVendas, tipo: 'moeda' },
                { id: 'ating', titulo: 'Previsão de atingimento', valor: (l) => l.previsaoAtingimento, tipo: 'pct' },
                { id: 'falta', titulo: 'Falta', valor: (l) => l.falta, tipo: 'moeda' },
              ]}
            />
          </Bloco>
          <Bloco titulo="Sem meta cadastrada" insight="Estes vendedores ficam fora do atingimento. Venda sem meta não vira zero nem erro.">
            <Tabela
              linhas={view.semMeta}
              nomeArquivo="vendedores-sem-meta"
              colunas={[
                { id: 'vendedor', titulo: 'Vendedor', valor: (l) => l.vendedor },
                { id: 'vendido', titulo: 'Valor vendido', valor: (l) => l.valorVendido, tipo: 'moeda' },
                { id: 'ticket', titulo: 'Ticket', valor: (l) => l.ticketMedio, tipo: 'moeda' },
                { id: 'clientes', titulo: 'Clientes', valor: (l) => l.clientesPositivados, tipo: 'num' },
              ]}
            />
          </Bloco>
          <Bloco id="orcamentos" titulo="Orçamentos em aberto" insight={view.insights.orcamentos}>
            <Grafico
              altura={Math.max(220, view.equipe.length * 30)}
              option={opcaoBarrasH(
                escuro,
                view.equipe.map((v) => v.vendedor),
                view.equipe.map((v) => v.orcamentosAbertos ?? 0),
                formatBRL,
                { destaque: filtros.vendedor },
              )}
              aoClicar={(nome) => alternarFiltro('vendedor', nome)}
            />
          </Bloco>
          <Bloco id="dispersao" titulo="Ticket × clientes positivados" insight={view.insights.dispersao}>
            <Grafico
              option={opcaoDispersao(
                escuro,
                view.dispersao.map((p) => ({ nome: p.vendedor, x: p.clientes, y: p.ticket, tamanho: p.valor })),
                filtros.vendedor,
              )}
              altura={360}
              aoClicar={(nome) => alternarFiltro('vendedor', nome)}
            />
          </Bloco>
        </>
      )}
      {!vendas ? (
        <Vazio titulo="Falta Vendas detalhadas" detalhe="A evolução diária, o mix de pagamento e o prazo médio por vendedor saem dos pedidos." href="/carregar/vendedores" />
      ) : (
        <>
          <Bloco titulo="Evolução diária" insight="Cada linha é um vendedor. Clique na legenda do gráfico ou no nome para isolar.">
            {evolucao.datas.length === 0 ? (
              <p className="text-sm text-muted">Sem datas neste recorte.</p>
            ) : (
              <Grafico
                option={opcaoLinhas(escuro, evolucao.datas.map((d) => formatData(d)), evolucao.series, formatBRL)}
                aoClicar={(nome) => alternarFiltro('vendedor', nome)}
              />
            )}
          </Bloco>
          <div className="grid gap-4 lg:grid-cols-2">
            <Bloco titulo="Condição de pagamento" insight="O clique filtra a evolução. O gráfico continua mostrando todas as condições.">
              <Grafico
                option={opcaoDonut(
                  escuro,
                  view.condicoes.map((c) => ({ nome: c.condicao, valor: c.valor })),
                  formatBRL,
                  filtros.condicao,
                  view.prazoMedio == null ? null : { valor: formatNum(view.prazoMedio, 0), legenda: 'dias' },
                )}
                aoClicar={(nome) => alternarFiltro('condicao', nome)}
              />
            </Bloco>
            <Bloco titulo="Prazo médio concedido" insight={view.insights.prazo}>
              <Grafico
                altura={Math.max(220, view.prazoPorVendedor.length * 30)}
                option={opcaoBarrasH(escuro, view.prazoPorVendedor.map((v) => v.vendedor), view.prazoPorVendedor.map((v) => v.prazo), (n) => `${formatNum(n, 0)} d`, { destaque: filtros.vendedor })}
                aoClicar={(nome) => alternarFiltro('vendedor', nome)}
              />
            </Bloco>
          </div>
        </>
      )}
    </Moldura>
  );
}

function pivotar(linhas: { data: string; vendedor: string; valor: number }[]) {
  const totais = new Map<string, number>();
  for (const linha of linhas) totais.set(linha.vendedor, (totais.get(linha.vendedor) ?? 0) + linha.valor);
  const nomes = [...totais.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nome]) => nome);
  const datas = [...new Set(linhas.map((l) => l.data))].sort();
  const indice = new Map<string, number>();
  linhas.forEach((linha) => indice.set(`${linha.data}|${linha.vendedor}`, (indice.get(`${linha.data}|${linha.vendedor}`) ?? 0) + linha.valor));
  return {
    datas,
    series: nomes.map((nome) => ({ nome, dados: datas.map((data) => indice.get(`${data}|${nome}`) ?? 0) })),
  };
}
