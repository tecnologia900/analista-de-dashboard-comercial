import { agruparSerie, formatBRL, formatData, formatNum, montarVendas } from '@dash/shared';
import { useMemo, useState } from 'react';
import { Grafico, opcaoBarrasH, opcaoCalor, opcaoDonut, opcaoLinhas } from '../grafico';
import { Tabela } from '../tabela';
import { alternarFiltro, usePainel } from '../store';
import { fraseLeitura, leituraVendas } from '../leitura';
import { Avisos, Bloco, Kpi, Leitura, Moldura, Oportunidades, Selecao, Vazio } from '../ui';

export function Vendas() {
  const relatorio = usePainel((s) => s.relatorios.vendas);
  const filtros = usePainel((s) => s.filtros);
  const setFiltro = usePainel((s) => s.setFiltro);
  const escuro = usePainel((s) => s.tema) === 'escuro';
  const [modo, setModo] = useState<'dia' | 'semana' | 'mes'>('dia');
  const view = useMemo(() => montarVendas(relatorio, filtros), [relatorio, filtros]);
  const serie = useMemo(() => agruparSerie(view.porDia, modo), [view.porDia, modo]);
  const semanas = useMemo(() => [...new Set(view.heatmap.map((c) => c.semana))].sort(), [view.heatmap]);
  const respostas = useMemo(() => leituraVendas(view), [view]);

  if (!relatorio) {
    return (
      <Moldura titulo="Visão geral de vendas">
        <Vazio titulo="Falta Vendas detalhadas" detalhe="Esse único arquivo libera faturamento, ritmo, dia da semana, condição de pagamento e os maiores pedidos." href="/carregar/vendas" />
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Visão geral de vendas">
      <Avisos itens={view.avisos} />
      <Leitura frase={fraseLeitura(respostas)} itens={respostas} />
      <Oportunidades itens={view.oportunidades} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi rotulo="Faturamento" valor={formatBRL(view.kpis.faturamento)} detalhe={view.origem ?? undefined} />
        <Kpi rotulo="Pedidos" valor={formatNum(view.kpis.pedidos, 0)} detalhe={view.kpis.ticketMedio != null ? `Ticket ${formatBRL(view.kpis.ticketMedio)}` : undefined} />
        <Kpi rotulo="Clientes" valor={formatNum(view.kpis.clientes, 0)} detalhe={view.kpis.prazoMedio != null ? `Prazo médio ${formatNum(view.kpis.prazoMedio, 0)} dias` : undefined} />
        <Kpi
          rotulo="Projeção do mês"
          valor={view.kpis.projecao == null ? 'Mês fechado' : formatBRL(view.kpis.projecao)}
          detalhe={view.kpis.incompleto ? `${view.kpis.diasDecorridos} de ${view.kpis.diasMes} dias no ritmo atual` : 'O período cobre o mês inteiro'}
        />
      </div>
      <div className="no-print flex flex-wrap gap-3">
        <Selecao rotulo="Vendedor" valor={filtros.vendedor} opcoes={[...new Set(relatorio.linhas.map((l) => l.vendedor))].sort((a, b) => a.localeCompare(b, 'pt-BR'))} aoMudar={(v) => setFiltro('vendedor', v)} />
        <Selecao rotulo="Condição" valor={filtros.condicao} opcoes={[...new Set(relatorio.linhas.map((l) => l.condicao))].sort((a, b) => a.localeCompare(b, 'pt-BR'))} aoMudar={(v) => setFiltro('condicao', v)} />
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Agrupar evolução</span>
          <select className="campo" value={modo} onChange={(e) => setModo(e.target.value as 'dia' | 'semana' | 'mes')}>
            <option value="dia">Dia</option>
            <option value="semana">Semana</option>
            <option value="mes">Mês</option>
          </select>
        </label>
      </div>
      <Bloco titulo="Evolução" insight={view.insights.evolucao}>
        <Grafico option={opcaoLinhas(escuro, serie.map((p) => p.rotulo), [{ nome: 'Faturamento', dados: serie.map((p) => p.valor) }], formatBRL)} />
      </Bloco>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco id="semana" titulo="Mapa de calor por dia da semana" insight={view.insights.calor}>
          <Grafico
            option={opcaoCalor(
              escuro,
              semanas.map((s) => formatData(s)),
              view.heatmap.map((c) => [semanas.indexOf(c.semana), c.dia, c.valor]),
            )}
            altura={360}
          />
        </Bloco>
        <Bloco id="condicao" titulo="Condição de pagamento" insight={view.insights.condicao}>
          <Grafico altura={view.porCondicao.length > 6 ? 380 : 320} option={opcaoDonut(escuro, view.porCondicao.map((c) => ({ nome: c.condicao, valor: c.valor })), formatBRL, filtros.condicao)} aoClicar={(nome) => alternarFiltro('condicao', nome)} />
        </Bloco>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco id="vendedores" titulo="Vendedores" insight="Clique num nome para filtrar o restante do painel.">
          <Grafico
            altura={Math.max(220, Math.min(view.porVendedor.length, 12) * 28)}
            option={opcaoBarrasH(escuro, view.porVendedor.slice(0, 12).map((v) => v.nome), view.porVendedor.slice(0, 12).map((v) => v.valor), formatBRL, { destaque: filtros.vendedor })}
            aoClicar={(nome) => alternarFiltro('vendedor', nome)}
          />
        </Bloco>
        <Bloco id="clientes" titulo="Clientes" insight={view.insights.clientes}>
          <Grafico
            altura={Math.max(220, Math.min(view.porCliente.length, 12) * 28)}
            option={opcaoBarrasH(escuro, view.porCliente.slice(0, 12).map((v) => v.nome), view.porCliente.slice(0, 12).map((v) => v.valor), formatBRL, { destaque: filtros.cliente })}
            aoClicar={(nome) => alternarFiltro('cliente', nome)}
          />
        </Bloco>
      </div>
      <Bloco titulo="Distribuição do valor dos pedidos" insight="Cada faixa mostra quantos pedidos caíram naquele tamanho.">
        <Grafico option={opcaoBarrasH(escuro, view.faixas.map((f) => f.rotulo), view.faixas.map((f) => f.pedidos), (n) => formatNum(n, 0))} altura={260} />
      </Bloco>
      <Bloco id="pedidos" titulo="Maiores pedidos" insight="Os oito maiores do recorte, para achar concentração em poucos pedidos.">
        <Tabela
          linhas={view.maiores}
          nomeArquivo="maiores-pedidos"
          colunas={[
            { id: 'data', titulo: 'Data', valor: (l) => formatData(l.data) },
            { id: 'pedido', titulo: 'Pedido', valor: (l) => l.pedido },
            { id: 'cliente', titulo: 'Cliente', valor: (l) => l.razaoSocial },
            { id: 'vendedor', titulo: 'Vendedor', valor: (l) => l.vendedor },
            { id: 'condicao', titulo: 'Condição', valor: (l) => l.condicao },
            { id: 'prazo', titulo: 'Prazo médio', valor: (l) => l.prazoMedio, tipo: 'num', casas: 0 },
            { id: 'total', titulo: 'Total', valor: (l) => l.total, tipo: 'moeda' },
          ]}
        />
      </Bloco>
    </Moldura>
  );
}
