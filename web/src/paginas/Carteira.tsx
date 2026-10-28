import { formatBRL, formatData, formatNum, formatPct, montarCarteira } from '@dash/shared';
import { useMemo } from 'react';
import { Grafico, opcaoBarrasH, opcaoDonut, paleta } from '../grafico';
import { Tabela } from '../tabela';
import type { ColunaTabela } from '../tabela';
import { alternarFiltro, usePainel } from '../store';
import { fraseLeitura, leituraCarteira } from '../leitura';
import { Avisos, Bloco, Kpi, Leitura, Moldura, Oportunidades, Selecao, Vazio } from '../ui';

const CORES: Record<string, string> = {
  Ativo: '#0d7a45',
  'Inativo recente': '#8a5a00',
  'Inativo antigo': '#b42318',
};

export function Carteira() {
  const carteira = usePainel((s) => s.relatorios.carteira);
  const vendas = usePainel((s) => s.relatorios.vendas);
  const filtros = usePainel((s) => s.filtros);
  const setFiltro = usePainel((s) => s.setFiltro);
  const escuro = usePainel((s) => s.tema) === 'escuro';
  const view = useMemo(() => montarCarteira(carteira, vendas, filtros), [carteira, vendas, filtros]);
  const respostas = useMemo(() => leituraCarteira(view), [view]);
  const c = paleta(escuro);

  const colunasRisco = useMemo<ColunaTabela<(typeof view.risco)[number]>[]>(
    () => [
      { id: 'razao', titulo: 'Razão social', valor: (l) => l.razaoSocial },
      { id: 'dias', titulo: 'Dias sem comprar', valor: (l) => l.diasSemComprar, tipo: 'num' },
      { id: 'ciclo', titulo: 'Ciclo médio', valor: (l) => l.cicloMedio, tipo: 'num' },
      {
        id: 'razaoCiclo',
        titulo: 'Dias / ciclo',
        valor: (l) => l.razao,
        tipo: 'num',
        casas: 1,
        barra: (l) => ({ pct: Math.min(100, (l.razao / 3) * 100), cor: l.destaque ? 'ruim' : 'alerta' }),
      },
      { id: 'valor', titulo: 'Último pedido', valor: (l) => l.valorUltimoPedido, tipo: 'moeda' },
      { id: 'potencial', titulo: 'Potencial', valor: (l) => l.potencial, tipo: 'moeda' },
      { id: 'vendedor', titulo: 'Vendedor', valor: (l) => l.vendedor ?? 'Não identificado nas vendas' },
      { id: 'pedido', titulo: 'Pedido', valor: (l) => l.ultimoPedido },
      { id: 'data', titulo: 'Data', valor: (l) => formatData(l.dataUltimoPedido) },
    ],
    [],
  );

  if (!carteira && !vendas) {
    return (
      <Moldura titulo="Saúde da carteira">
        <Vazio titulo="Faltam as planilhas da carteira" detalhe="Envie a Carteira detalhada de clientes e as Vendas detalhadas para ver quem está esfriando e quem concentrar a ligação." href="/carregar/carteira" />
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Saúde da carteira">
      <Avisos itens={view.avisos} />
      <Leitura frase={fraseLeitura(respostas)} itens={respostas} />
      <Oportunidades itens={view.oportunidades} />
      {!carteira ? (
        <Vazio titulo="Falta a carteira detalhada" detalhe="Ela libera situação, dias sem comprar, ciclo e a lista de reativação." href="/carregar/carteira" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi rotulo="Ativos" valor={formatNum(view.kpis.ativos, 0)} detalhe={view.kpis.pctAtivos != null ? `${formatPct(view.kpis.pctAtivos, 0)} da carteira` : undefined} tom="bom" />
            <Kpi rotulo="Inativos recentes" valor={formatNum(view.kpis.inativosRecentes, 0)} tom="alerta" />
            <Kpi rotulo="Inativos antigos" valor={formatNum(view.kpis.inativosAntigos, 0)} />
            <Kpi rotulo="Ciclo mediano" valor={view.kpis.cicloMediano == null ? '—' : `${formatNum(view.kpis.cicloMediano, 0)} dias`} detalhe={view.kpis.valorMedioUltimo != null ? `Último pedido médio ${formatBRL(view.kpis.valorMedioUltimo)}` : 'Sem ciclo suficiente em parte da base'} />
          </div>
          <div className="no-print flex flex-wrap gap-3">
            <Selecao rotulo="Situação" valor={filtros.situacao} opcoes={view.porSituacao.map((s) => s.situacao)} aoMudar={(v) => setFiltro('situacao', v)} />
            <Selecao
              rotulo="Vendedor"
              valor={filtros.vendedor}
              opcoes={[...new Set(vendas?.linhas.map((l) => l.vendedor) ?? [])].sort((a, b) => a.localeCompare(b, 'pt-BR'))}
              aoMudar={(v) => setFiltro('vendedor', v)}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Bloco titulo="Carteira por situação" insight={view.insights.situacao}>
              <Grafico
                option={opcaoDonut(
                  escuro,
                  view.porSituacao.map((s) => ({ nome: s.situacao, valor: s.clientes, cor: CORES[s.situacao] ?? c.blue })),
                  (n) => formatNum(n, 0),
                  filtros.situacao,
                )}
                aoClicar={(nome) => alternarFiltro('situacao', nome)}
              />
            </Bloco>
            <Bloco titulo="Dias sem comprar" insight={view.insights.faixas}>
              <Grafico
                option={opcaoBarrasH(escuro, view.faixas.map((f) => f.rotulo), view.faixas.map((f) => f.clientes), (n) => formatNum(n, 0))}
                altura={280}
              />
            </Bloco>
          </div>
          <Bloco id="risco" titulo="Clientes em risco de esfriar" insight={view.insights.risco}>
            <Tabela linhas={view.risco} colunas={colunasRisco} nomeArquivo="clientes-em-risco" />
          </Bloco>
          <Bloco id="reativacao" titulo="Reativação — inativos recentes" insight="Ordene pela coluna de valor e comece a ligação por quem comprou mais da última vez.">
            <Tabela
              linhas={view.reativacao}
              nomeArquivo="reativacao"
              colunas={[
                { id: 'razao', titulo: 'Razão social', valor: (l) => l.razaoSocial },
                { id: 'valor', titulo: 'Último pedido', valor: (l) => l.valorUltimoPedido, tipo: 'moeda' },
                { id: 'dias', titulo: 'Dias sem comprar', valor: (l) => l.diasSemComprar, tipo: 'num' },
                { id: 'data', titulo: 'Data', valor: (l) => formatData(l.dataUltimoPedido) },
                { id: 'vendedor', titulo: 'Vendedor', valor: (l) => l.vendedor ?? 'Não identificado nas vendas' },
              ]}
            />
          </Bloco>
        </>
      )}
      {!vendas ? (
        <Vazio titulo="Falta Vendas detalhadas" detalhe="Com as vendas dá para ver faturamento, concentração, clientes novos e quem está comprando menos que o histórico." href="/carregar/carteira" />
      ) : (
        <>
          <Bloco id="faturamento" titulo="Maiores clientes" insight={view.insights.concentracao}>
            <Grafico
              altura={Math.max(240, view.topClientes.length * 28)}
              option={opcaoBarrasH(escuro, view.topClientes.map((c) => c.razaoSocial), view.topClientes.map((c) => c.valor), formatBRL, { destaque: filtros.cliente })}
              aoClicar={(nome) => alternarFiltro('cliente', nome)}
            />
          </Bloco>
          <div className="grid gap-4 lg:grid-cols-2">
            <Bloco titulo="Novos e recorrentes" insight="Recorrente tem dois ou mais pedidos no período ou ciclo médio preenchido na carteira. Os demais entram como novos.">
              <Grafico
                option={opcaoDonut(escuro, [
                  { nome: 'Recorrentes', valor: view.recorrentes, cor: c.accent },
                  { nome: 'Novos', valor: view.novos, cor: c.blue },
                ], (n) => formatNum(n, 0))}
                altura={280}
              />
            </Bloco>
            <Bloco titulo="Pedidos menores que o histórico" insight="A média do período ficou abaixo de 70% do valor do último pedido usado como referência.">
              <Tabela
                linhas={view.menoresQueHistorico}
                nomeArquivo="pedidos-menores"
                colunas={[
                  { id: 'razao', titulo: 'Razão social', valor: (l) => l.razaoSocial },
                  { id: 'media', titulo: 'Média no período', valor: (l) => l.mediaPeriodo, tipo: 'moeda' },
                  { id: 'ref', titulo: 'Referência', valor: (l) => l.referencia, tipo: 'moeda' },
                  { id: 'pedidos', titulo: 'Pedidos', valor: (l) => l.pedidos, tipo: 'num' },
                ]}
              />
            </Bloco>
          </div>
        </>
      )}
    </Moldura>
  );
}
