import { formatBRL, formatNum, formatPct, montarGiro, normDesc } from '@dash/shared';
import { useMemo, useState } from 'react';
import { Grafico, opcaoBarrasH, opcaoDivergente, opcaoPareto, opcaoTreemap } from '../grafico';
import { Tabela } from '../tabela';
import type { ColunaTabela } from '../tabela';
import { alternarFiltro, usePainel } from '../store';
import { fraseLeitura, leituraGiro } from '../leitura';
import { Avisos, Bloco, Kpi, Leitura, Moldura, Oportunidades, Selecao, Vazio } from '../ui';

export function Giro() {
  const produtos = usePainel((s) => s.relatorios.produtos);
  const estoque = usePainel((s) => s.relatorios.estoque);
  const filtros = usePainel((s) => s.filtros);
  const setFiltro = usePainel((s) => s.setFiltro);
  const coberturaMax = usePainel((s) => s.coberturaMax);
  const definirCobertura = usePainel((s) => s.definirCobertura);
  const escuro = usePainel((s) => s.tema) === 'escuro';
  const [metrica, setMetrica] = useState<'valor' | 'qtd'>('valor');
  const [topN, setTopN] = useState<10 | 20>(10);
  const [busca, setBusca] = useState('');
  const [faixa, setFaixa] = useState('todas');
  const [baixa, setBaixa] = useState(false);

  const opcoes = useMemo(() => ({ coberturaMaxDias: coberturaMax, vendaBaixaAte: baixa ? 2 : 0 }), [coberturaMax, baixa]);
  const view = useMemo(() => montarGiro(produtos, estoque, filtros, opcoes), [produtos, estoque, filtros, opcoes]);
  const representadas = useMemo(
    () => montarGiro(produtos, estoque, { ...filtros, representada: null }, opcoes).porRepresentada,
    [produtos, estoque, filtros, opcoes],
  );

  const ranking = useMemo(() => {
    const base = view.ranking.filter((item) => !busca || normDesc(item.nome).includes(normDesc(busca)));
    return [...base].sort((a, b) => (metrica === 'valor' ? b.valor - a.valor : b.qtd - a.qtd)).slice(0, topN);
  }, [view.ranking, busca, metrica, topN]);

  const parados = view.parados.filter((item) => naFaixa(item.valor, faixa));
  const respostas = useMemo(() => leituraGiro(view, produtos?.itens), [view, produtos]);
  const abcTopo = view.abc.slice(0, 15);
  const variacao = [...view.cairam].reverse().concat(view.cresceram);

  const colunasParados = useMemo<ColunaTabela<(typeof parados)[number]>[]>(
    () => [
      { id: 'codigo', titulo: 'Código', valor: (l) => l.codigo },
      { id: 'descricao', titulo: 'Descrição', valor: (l) => l.descricao },
      { id: 'representada', titulo: 'Representada', valor: (l) => l.representada },
      { id: 'estoque', titulo: 'Estoque', valor: (l) => l.estoque, tipo: 'num' },
      { id: 'valor', titulo: 'Valor imobilizado', valor: (l) => l.valor, tipo: 'moeda' },
      { id: 'qtd', titulo: 'Qtd vendida', valor: (l) => l.qtdVendida, tipo: 'num' },
      { id: 'cobertura', titulo: 'Cobertura (dias)', valor: (l) => l.cobertura, tipo: 'num', casas: 0 },
    ],
    [],
  );
  const colunasRuptura = useMemo<ColunaTabela<(typeof view.rupturas)[number]>[]>(
    () => [
      { id: 'descricao', titulo: 'Produto', valor: (l) => l.descricao },
      { id: 'qtd', titulo: 'Qtd vendida', valor: (l) => l.qtdVendida, tipo: 'num' },
      { id: 'media', titulo: 'Média diária', valor: (l) => l.mediaDiaria, tipo: 'num', casas: 1 },
      { id: 'estoque', titulo: 'Estoque', valor: (l) => l.estoque, tipo: 'num' },
      { id: 'cobertura', titulo: 'Cobertura (dias)', valor: (l) => l.cobertura, tipo: 'num', casas: 0 },
      { id: 'valor', titulo: 'Valor vendido', valor: (l) => l.valorVendido, tipo: 'moeda' },
      { id: 'motivo', titulo: 'Motivo', valor: (l) => l.motivo },
    ],
    [],
  );

  if (!produtos && !estoque) {
    return (
      <Moldura titulo="Giro de produtos">
        <Vazio titulo="Faltam as planilhas de giro" detalhe="Envie Produtos mais vendidos e Estoque para ver o que sai, o que está parado e onde o estoque pode furar." href="/carregar/giro" />
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Giro de produtos">
      <Avisos itens={view.avisos} />
      <Leitura frase={fraseLeitura(respostas)} itens={respostas} />
      <Oportunidades itens={view.oportunidades} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Valor vendido" valor={formatBRL(view.kpis.valorVendido)} detalhe={produtos ? produtos.periodo1.rotulo : 'Falta produtos mais vendidos'} />
        <Kpi rotulo="Quantidade" valor={formatNum(view.kpis.quantidade, 0)} detalhe={view.kpis.ticketMedio != null ? `Ticket ${formatBRL(view.kpis.ticketMedio)}` : undefined} />
        <Kpi rotulo="Valor em estoque" valor={formatBRL(view.kpis.valorEstoque)} detalhe={`${view.kpis.itensComEstoque} itens com saldo`} />
        <Kpi rotulo="Parado" valor={formatBRL(view.kpis.valorParado)} detalhe={`${view.kpis.itensParados} itens sem giro`} tom={view.kpis.valorParado > 0 ? 'alerta' : 'bom'} />
      </div>
      <div className="no-print flex flex-wrap gap-3">
        <Selecao rotulo="Categoria" valor={filtros.categoria} opcoes={unicos(produtos?.itens.map((i) => i.categoria) ?? [])} aoMudar={(v) => setFiltro('categoria', v)} />
        <Selecao rotulo="Representada" valor={filtros.representada} opcoes={unicos(estoque?.linhas.map((i) => i.representada) ?? [])} aoMudar={(v) => setFiltro('representada', v)} />
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Ruptura abaixo de (dias)</span>
          <input className="campo w-28" type="number" min={1} value={coberturaMax} onChange={(e) => definirCobertura(Number(e.target.value) || 15)} />
        </label>
      </div>
      {!produtos ? (
        <Vazio titulo="Falta Produtos mais vendidos" detalhe="Esse arquivo libera ranking, curva ABC, crescimento e o cruzamento com o estoque." href="/carregar/giro" />
      ) : (
        <>
          <Bloco
            id="ranking"
            titulo={`Top ${topN} por ${metrica === 'valor' ? 'valor' : 'quantidade'}`}
            insight={view.insights.topo}
            extra={
              <div className="no-print flex flex-wrap gap-2">
                <input className="campo w-48" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <button type="button" className="btn-sec" onClick={() => setMetrica(metrica === 'valor' ? 'qtd' : 'valor')}>
                  {metrica === 'valor' ? 'Ver quantidade' : 'Ver valor'}
                </button>
                <button type="button" className="btn-sec" onClick={() => setTopN(topN === 10 ? 20 : 10)}>
                  Top {topN === 10 ? 20 : 10}
                </button>
              </div>
            }
          >
            <Grafico
              altura={Math.max(240, ranking.length * 28)}
              option={opcaoBarrasH(
                escuro,
                ranking.map((i) => i.nome),
                ranking.map((i) => (metrica === 'valor' ? i.valor : i.qtd)),
                metrica === 'valor' ? formatBRL : (n) => formatNum(n, 0),
                { destaque: filtros.produto },
              )}
              aoClicar={(nome) => alternarFiltro('produto', nome)}
            />
          </Bloco>
          {view.categorias.length > 0 && (
            <Bloco titulo="Valor por categoria" insight="As categorias saem das linhas de subtotal quando o relatório vem agrupado.">
              <Grafico
                altura={Math.max(220, view.categorias.length * 32)}
                option={opcaoBarrasH(escuro, view.categorias.map((c) => c.nome), view.categorias.map((c) => c.valor), formatBRL, { destaque: filtros.categoria })}
                aoClicar={(nome) => alternarFiltro('categoria', nome)}
              />
            </Bloco>
          )}
          <Bloco titulo="Crescimento e queda" insight={view.insights.variacao}>
            {variacao.length === 0 ? (
              <p className="text-sm text-muted">Sem base de comparação neste recorte.</p>
            ) : (
              <Grafico
                altura={Math.max(240, variacao.length * 28)}
                option={opcaoDivergente(escuro, variacao.map((i) => i.nome), variacao.map((i) => i.variacao), (n) => formatPct(n, 0))}
                aoClicar={(nome) => alternarFiltro('produto', nome)}
              />
            )}
          </Bloco>
          <Bloco titulo="Curva ABC" insight={view.insights.abc}>
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              {view.abcResumo.map((classe) => (
                <p key={classe.classe} className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm">
                  <strong>Classe {classe.classe}</strong> · {classe.itens} itens · {formatPct(classe.participacao, 0)}
                </p>
              ))}
            </div>
            <Grafico
              option={opcaoPareto(escuro, abcTopo.map((i) => i.nome), abcTopo.map((i) => i.valor), abcTopo.map((i) => i.acumulado), formatBRL)}
              aoClicar={(nome) => alternarFiltro('produto', nome)}
            />
          </Bloco>
        </>
      )}
      {!estoque ? (
        <Vazio titulo="Falta o relatório de estoque" detalhe="Com o estoque dá para ver valor imobilizado, itens parados, cobertura e ruptura." href="/carregar/giro" />
      ) : (
        <>
          <Bloco
            id="parados"
            titulo="Itens parados"
            insight={view.insights.parados}
            extra={
              <div className="no-print flex flex-wrap items-center gap-2">
                <select className="campo w-auto" value={faixa} onChange={(e) => setFaixa(e.target.value)}>
                  <option value="todas">Todas as faixas</option>
                  <option value="ate1">Até R$ 1 mil</option>
                  <option value="1a10">R$ 1 a 10 mil</option>
                  <option value="10a50">R$ 10 a 50 mil</option>
                  <option value="acima">Acima de R$ 50 mil</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={baixa} onChange={(e) => setBaixa(e.target.checked)} />
                  Incluir venda de até 2 un.
                </label>
              </div>
            }
          >
            {!produtos ? (
              <p className="text-sm text-muted">Envie Produtos mais vendidos para separar o que está parado do que está girando.</p>
            ) : (
              <Tabela linhas={parados} colunas={colunasParados} nomeArquivo="itens-parados" />
            )}
          </Bloco>
          <Bloco id="ruptura" titulo="Risco de ruptura" insight={view.insights.ruptura}>
            <Tabela linhas={view.rupturas} colunas={colunasRuptura} nomeArquivo="risco-ruptura" />
          </Bloco>
          <Bloco titulo="Estoque por representada" insight={view.insights.representada}>
            {representadas.length === 0 ? (
              <p className="text-sm text-muted">Sem valor de estoque neste recorte.</p>
            ) : (
              <Grafico option={opcaoTreemap(escuro, representadas.map((r) => ({ nome: r.nome, valor: r.valor })), filtros.representada)} altura={340} aoClicar={(nome) => alternarFiltro('representada', nome)} />
            )}
          </Bloco>
          {view.pares.length > 0 && (
            <Bloco titulo="Pares direta e indireta" insight="O código depois de IMP DIR ou IMP IND liga as duas variantes do mesmo item.">
              <Tabela
                linhas={view.pares}
                nomeArquivo="pares-dir-ind"
                colunas={[
                  { id: 'base', titulo: 'Item', valor: (l) => l.base },
                  { id: 'dirE', titulo: 'Estoque DIR', valor: (l) => l.dir?.estoque ?? null, tipo: 'num' },
                  { id: 'dirV', titulo: 'Venda DIR', valor: (l) => l.dir?.valorVendido ?? null, tipo: 'moeda' },
                  { id: 'indE', titulo: 'Estoque IND', valor: (l) => l.ind?.estoque ?? null, tipo: 'num' },
                  { id: 'indV', titulo: 'Venda IND', valor: (l) => l.ind?.valorVendido ?? null, tipo: 'moeda' },
                ]}
              />
            </Bloco>
          )}
          <Bloco id="qualidade" titulo="Qualidade dos dados" insight={view.negativos.length || view.duplicados.length ? 'Estoque negativo não entra no valor imobilizado.' : 'Nenhum estoque negativo ou código duplicado neste recorte.'}>
            {view.negativos.length > 0 && (
              <Tabela
                linhas={view.negativos}
                nomeArquivo="estoque-negativo"
                colunas={[
                  { id: 'codigo', titulo: 'Código', valor: (l) => l.codigo },
                  { id: 'descricao', titulo: 'Descrição', valor: (l) => l.descricao },
                  { id: 'estoque', titulo: 'Estoque', valor: (l) => l.estoque, tipo: 'num' },
                  { id: 'valor', titulo: 'Valor', valor: (l) => l.valorTotal, tipo: 'moeda' },
                ]}
              />
            )}
            {view.duplicados.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {view.duplicados.map((dup) => (
                  <li key={dup.codigo}>
                    Código {dup.codigo}: {dup.descricoes.join(' · ')}
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        </>
      )}
    </Moldura>
  );
}

function naFaixa(valor: number, faixa: string): boolean {
  if (faixa === 'ate1') return valor <= 1000;
  if (faixa === '1a10') return valor > 1000 && valor <= 10000;
  if (faixa === '10a50') return valor > 10000 && valor <= 50000;
  if (faixa === 'acima') return valor > 50000;
  return true;
}

function unicos(valores: Array<string | null | undefined>): string[] {
  return [...new Set(valores.filter((valor): valor is string => !!valor))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
