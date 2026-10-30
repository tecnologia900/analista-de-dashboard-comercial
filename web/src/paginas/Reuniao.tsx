import { formatBRL, formatData, formatNum, formatPct, listarVendedores, montarReuniao } from '@dash/shared';
import type { ComparativoLinha, ReuniaoView } from '@dash/shared';
import { useMemo, useState } from 'react';
import { Grafico, opcaoBarrasH, opcaoDonut, opcaoLinhas } from '../grafico';
import { Tabela } from '../tabela';
import { usePainel } from '../store';
import { Avisos, Bloco, Kpi, Moldura, Vazio } from '../ui';

export function Reuniao() {
  const ranking = usePainel((s) => s.relatorios.ranking);
  const vendas = usePainel((s) => s.relatorios.vendas);
  const carteira = usePainel((s) => s.relatorios.carteira);
  const produtos = usePainel((s) => s.relatorios.produtos);
  const vendedorInicial = usePainel((s) => s.filtros.vendedor);
  const escuro = usePainel((s) => s.tema) === 'escuro';
  const nomes = useMemo(() => listarVendedores(ranking, vendas), [ranking, vendas]);
  const [vendedor, setVendedor] = useState<string | null>(vendedorInicial);
  const view = useMemo(
    () => montarReuniao(ranking, vendas, carteira, produtos, vendedor),
    [ranking, vendas, carteira, produtos, vendedor],
  );

  if (!ranking && !vendas) {
    return (
      <Moldura titulo="Reunião com o vendedor">
        <Vazio
          titulo="Faltam as planilhas da reunião"
          detalhe="Envie o Ranking de vendedores e as Vendas detalhadas. A carteira libera quem passou do ciclo."
          href="/carregar/reuniao"
        />
      </Moldura>
    );
  }

  return (
    <Moldura titulo={view ? `Reunião · ${view.vendedor}` : 'Reunião com o vendedor'}>
      <section className="card no-print p-4">
        <h2 className="text-[15px] font-semibold">Com quem é a reunião?</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Escolha o vendedor. A pauta usa o que ele vendeu, a meta, o 1º lugar e a média dos vendedores. O nome de quem lidera não aparece.
        </p>
        <select className="campo mt-3 max-w-md text-base" value={vendedor ?? ''} onChange={(e) => setVendedor(e.target.value || null)}>
          <option value="">Escolha o vendedor</option>
          {nomes.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </section>

      {!vendedor && <p className="text-sm text-muted">A pauta aparece depois da escolha.</p>}
      {vendedor && !view && <p className="aviso">Não encontrei esse vendedor nas planilhas carregadas.</p>}
      {view && <Pauta view={view} escuro={escuro} />}
    </Moldura>
  );
}

function Pauta({ view, escuro }: { view: ReuniaoView; escuro: boolean }) {
  const tomMeta = view.semMeta ? 'neutro' : view.atingimento != null && view.atingimento >= 100 ? 'bom' : view.atingimento != null && view.atingimento >= 70 ? 'alerta' : 'ruim';
  const barras = barrasAtingimento(view);
  return (
    <>
      <Avisos itens={view.avisos} />
      <section className="card p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Pauta {view.periodo ? `· ${view.periodo}` : ''}</p>
        <p className="mt-2 max-w-4xl text-lg leading-relaxed">{view.frase}</p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Valor vendido" valor={formatBRL(view.valor)} detalhe={view.participacao == null ? undefined : `${formatPct(view.participacao, 0)} da equipe`} />
        <Kpi rotulo="Posição na equipe" valor={`${view.posicao}º`} detalhe={`de ${view.tamanhoEquipe} vendedores`} />
        <Kpi
          rotulo="Atingimento da meta"
          valor={view.semMeta || view.atingimento == null ? 'Sem meta' : formatPct(view.atingimento, 0)}
          detalhe={view.previsaoAtingimento == null ? undefined : `Previsão ${formatPct(view.previsaoAtingimento, 0)}`}
          tom={tomMeta}
        />
        <Kpi
          rotulo="Para a meta"
          valor={view.semMeta || view.falta == null ? '—' : view.falta > 0 ? formatBRL(view.falta) : 'Meta coberta'}
          detalhe={view.meta == null ? undefined : `Meta ${formatBRL(view.meta)}`}
          tom={view.falta != null && view.falta > 0 ? 'alerta' : view.falta != null ? 'bom' : 'neutro'}
        />
        <Kpi rotulo="Ticket médio" valor={view.ticket == null ? '—' : formatBRL(view.ticket)} detalhe={`${formatNum(view.clientes, 0)} clientes nos pedidos`} />
        <Kpi rotulo="Prazo médio" valor={view.prazo == null ? '—' : `${formatNum(view.prazo, 0)} dias`} />
        <Kpi
          rotulo="Orçamentos em aberto"
          valor={view.orcamentosAbertos == null ? '—' : formatBRL(view.orcamentosAbertos)}
          detalhe={view.qtdOrcamentos == null ? 'Valor em R$' : `${formatNum(view.qtdOrcamentos, 0)} orçamentos`}
          tom={view.orcamentosAbertos != null && view.orcamentosAbertos > 0 ? 'alerta' : 'neutro'}
        />
        <Kpi rotulo="Pedidos no período" valor={formatNum(view.comparativo.find((l) => l.id === 'pedidos')?.dele ?? 0, 0)} />
      </div>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold">Para abrir a conversa</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3">
          {view.pontos.map((ponto) => (
            <a key={ponto.id} href={`#${ponto.id}`} className={`leitura tom-${ponto.tom} block px-4 py-3`}>
              <p className="text-sm text-muted">{ponto.titulo}</p>
              <p className="mt-1 text-[15px] font-semibold leading-snug">{ponto.detalhe}</p>
            </a>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco id="meta" titulo="Como está a meta" insight={view.semMeta ? 'Sem meta cadastrada, a barra mostra só o que foi vendido.' : 'Vendido, meta e previsão saem do ranking. A previsão vazia usa o ritmo do mês quando o período ainda está aberto.'}>
          <Grafico
            altura={220}
            option={opcaoBarrasH(
              escuro,
              view.semMeta ? ['Vendido'] : ['Vendido', 'Meta', 'Previsão'],
              view.semMeta ? [view.valor] : [view.valor, view.meta ?? 0, view.previsao ?? 0],
              formatBRL,
            )}
          />
        </Bloco>
        <Bloco titulo="Atingimento contra o 1º lugar e a média" insight="O 1º lugar é quem mais vendeu, sem o nome. A média é o atingimento de cada vendedor com meta.">
          {barras.categorias.length < 2 ? (
            <p className="text-sm text-muted">Sem atingimento de meta para comparar.</p>
          ) : (
            <Grafico altura={220} option={opcaoBarrasH(escuro, barras.categorias, barras.valores, (n) => formatPct(n, 0))} />
          )}
        </Bloco>
      </div>

      <Bloco id="contribuicao" titulo="Comparativo com o 1º lugar e a média" insight="O 1º lugar é o maior valor vendido, sem o nome da pessoa. A média é por vendedor, para ver se ele ficou na média, acima ou abaixo.">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Ele</th>
                <th>1º lugar</th>
                <th>Média</th>
                <th>Leitura</th>
              </tr>
            </thead>
            <tbody>
              {view.comparativo.map((linha) => (
                <tr key={linha.id}>
                  <td>{linha.rotulo}</td>
                  <td className="num">{formatar(linha, linha.dele)}</td>
                  <td className="num">{formatar(linha, linha.lider)}</td>
                  <td className="num">{formatar(linha, linha.media)}</td>
                  <td>{linha.leitura}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>

      {view.evolucao.length > 0 && (
        <Bloco
          titulo="Evolução no período"
          insight={
            view.ehLider
              ? 'Ele é o 1º lugar em valor. A outra linha é a média por vendedor em cada dia.'
              : 'A linha dele, a do 1º lugar em valor e a média por vendedor no dia. O nome de quem lidera não entra no gráfico.'
          }
        >
          <Grafico
            option={opcaoLinhas(
              escuro,
              view.evolucao.map((d) => formatData(d.data)),
              [
                { nome: view.vendedor, dados: view.evolucao.map((d) => d.dele) },
                ...(view.ehLider ? [] : [{ nome: '1º lugar', dados: view.evolucao.map((d) => d.lider) }]),
                { nome: 'Média por vendedor', dados: view.evolucao.map((d) => d.media) },
              ],
              formatBRL,
            )}
          />
        </Bloco>
      )}

      <Bloco id="cliente" titulo="Melhores clientes dele" insight="Quem comprou com ele neste período, do maior valor para o menor.">
        {view.melhoresClientes.length === 0 ? (
          <p className="text-sm text-muted">Não há pedidos no nome dele nas vendas carregadas.</p>
        ) : (
          <Tabela
            nomeArquivo={`clientes-${view.vendedor}`}
            linhas={view.melhoresClientes}
            colunas={[
              { id: 'cliente', titulo: 'Cliente', valor: (l) => l.razaoSocial },
              { id: 'valor', titulo: 'Valor', valor: (l) => l.valor, tipo: 'moeda' },
              { id: 'part', titulo: 'Parte do que ele vendeu', valor: (l) => l.participacao, tipo: 'pct', casas: 0 },
              { id: 'pedidos', titulo: 'Pedidos', valor: (l) => l.pedidos, tipo: 'num' },
              { id: 'ticket', titulo: 'Ticket', valor: (l) => l.ticket, tipo: 'moeda' },
              { id: 'ultima', titulo: 'Última compra', valor: (l) => formatData(l.ultimaData) },
              { id: 'condicao', titulo: 'Condição mais usada', valor: (l) => l.condicao },
            ]}
          />
        )}
      </Bloco>

      <Bloco id="ciclo" titulo="Clientes dele que já passaram do ciclo" insight="Ele vendeu para esses clientes, e a carteira mostra que o intervalo já passou do ciclo médio. É a lista para cobrar retorno.">
        {!view.temCarteira ? (
          <p className="text-sm text-muted">Envie a carteira para ver quem passou do ciclo.</p>
        ) : view.esfriando.length === 0 ? (
          <p className="text-sm text-muted">Nenhum cliente atribuído a ele está ativo e além do ciclo.</p>
        ) : (
          <Tabela
            nomeArquivo={`ciclo-${view.vendedor}`}
            linhas={view.esfriando}
            colunas={[
              { id: 'cliente', titulo: 'Cliente', valor: (l) => l.razaoSocial },
              { id: 'situacao', titulo: 'Situação', valor: (l) => l.situacao },
              { id: 'dias', titulo: 'Dias sem comprar', valor: (l) => l.diasSemComprar, tipo: 'num' },
              { id: 'ciclo', titulo: 'Ciclo', valor: (l) => l.cicloMedio, tipo: 'num' },
              { id: 'ultimo', titulo: 'Último pedido', valor: (l) => l.valorUltimoPedido, tipo: 'moeda' },
              { id: 'leitura', titulo: 'Leitura', valor: (l) => l.leitura },
            ]}
          />
        )}
      </Bloco>

      <Bloco titulo="Clientes dele sem compra neste período" insight="A carteira não traz o nome do vendedor. O cliente só entra como dele quando algum pedido carregado está no nome dele. Quem está só na carteira, sem esse pedido, não dá para atribuir.">
        {!view.temCarteira ? (
          <p className="text-sm text-muted">Envie a carteira para cruzar com os pedidos.</p>
        ) : view.semCompra.length === 0 ? (
          <p className="text-sm text-muted">
            {view.melhoresClientes.length === 0
              ? 'Ele não tem pedido neste período. A carteira não informa o vendedor, então não dá para saber quais clientes ficaram sem atendimento.'
              : 'Com estes arquivos, todo cliente atribuído a ele tem pedido no período. Quem não comprou agora continua sem vendedor identificado.'}
          </p>
        ) : (
          <Tabela
            nomeArquivo={`sem-compra-${view.vendedor}`}
            linhas={view.semCompra}
            colunas={[
              { id: 'cliente', titulo: 'Cliente', valor: (l) => l.razaoSocial },
              { id: 'situacao', titulo: 'Situação', valor: (l) => l.situacao },
              { id: 'dias', titulo: 'Dias sem comprar', valor: (l) => l.diasSemComprar, tipo: 'num' },
              { id: 'ultimo', titulo: 'Último pedido', valor: (l) => l.valorUltimoPedido, tipo: 'moeda' },
              { id: 'quando', titulo: 'Data', valor: (l) => formatData(l.dataUltimoPedido) },
              { id: 'leitura', titulo: 'Leitura', valor: (l) => l.leitura },
            ]}
          />
        )}
      </Bloco>

      <Bloco id="contas" titulo="Maiores contas que compraram sem ele" insight="Clientes com pedido no período, nenhum no nome dele. O vendedor é quem mais vendeu para essa conta.">
        {view.contasSemEle.length === 0 ? (
          <p className="text-sm text-muted">Não há cliente do período comprando só com os outros.</p>
        ) : (
          <Tabela
            nomeArquivo={`sem-ele-${view.vendedor}`}
            linhas={view.contasSemEle}
            colunas={[
              { id: 'cliente', titulo: 'Cliente', valor: (l) => l.razaoSocial },
              { id: 'valor', titulo: 'Valor na empresa', valor: (l) => l.valor, tipo: 'moeda' },
              { id: 'part', titulo: 'Parte da empresa', valor: (l) => l.participacao, tipo: 'pct', casas: 0 },
              { id: 'pedidos', titulo: 'Pedidos', valor: (l) => l.pedidos, tipo: 'num' },
              { id: 'vendedor', titulo: 'Quem vendeu', valor: (l) => l.vendedor },
            ]}
          />
        )}
      </Bloco>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco id="prazo" titulo="Condição de pagamento dele" insight="O número no centro é o prazo médio dos pedidos dele.">
          {view.condicoes.length === 0 ? (
            <p className="text-sm text-muted">Sem pedidos para montar o mix de pagamento.</p>
          ) : (
            <Grafico
              altura={view.condicoes.length > 6 ? 380 : 320}
              option={opcaoDonut(
                escuro,
                view.condicoes.map((c) => ({ nome: c.condicao, valor: c.valor })),
                formatBRL,
                null,
                view.prazo == null ? null : { valor: formatNum(view.prazo, 0), legenda: 'dias' },
              )}
            />
          )}
        </Bloco>
        <Bloco titulo="Maiores pedidos dele" insight="Os cinco maiores pedidos no nome dele.">
          {view.maioresPedidos.length === 0 ? (
            <p className="text-sm text-muted">Sem pedidos carregados.</p>
          ) : (
            <Tabela
              nomeArquivo={`pedidos-${view.vendedor}`}
              tamanho={5}
              linhas={view.maioresPedidos}
              colunas={[
                { id: 'pedido', titulo: 'Pedido', valor: (l) => l.pedido },
                { id: 'cliente', titulo: 'Cliente', valor: (l) => l.razaoSocial },
                { id: 'data', titulo: 'Data', valor: (l) => formatData(l.data) },
                { id: 'total', titulo: 'Valor', valor: (l) => l.total, tipo: 'moeda' },
                { id: 'condicao', titulo: 'Condição', valor: (l) => l.condicao },
              ]}
            />
          )}
        </Bloco>
      </div>

      <Bloco id="produtos" titulo="Produtos na pauta" insight="Produtos mais vendidos é da empresa inteira. A venda detalhada fecha no total do pedido e não abre o item, então não dá para listar o que ele vendeu nem o que o resto vendeu no lugar dele.">
        {!view.temProdutos ? (
          <p className="text-sm text-muted">Envie Produtos mais vendidos para ter a pauta do que a empresa vendeu. Mesmo assim o arquivo não separa o vendedor.</p>
        ) : (
          <Tabela
            nomeArquivo="produtos-empresa"
            linhas={view.produtosEmpresa}
            colunas={[
              { id: 'produto', titulo: 'Produto da empresa', valor: (l) => l.nome },
              { id: 'qtd', titulo: 'Quantidade', valor: (l) => l.qtd, tipo: 'num' },
              { id: 'valor', titulo: 'Valor', valor: (l) => l.valor, tipo: 'moeda' },
              { id: 'part', titulo: 'Parte do valor', valor: (l) => l.participacao, tipo: 'pct', casas: 0 },
            ]}
          />
        )}
      </Bloco>
    </>
  );
}

function barrasAtingimento(view: ReuniaoView): { categorias: string[]; valores: number[] } {
  const meta = view.comparativo.find((linha) => linha.id === 'meta');
  const categorias: string[] = [];
  const valores: number[] = [];
  if (view.atingimento != null) {
    categorias.push(view.vendedor);
    valores.push(view.atingimento);
  }
  if (!view.ehLider && meta?.lider != null) {
    categorias.push('1º lugar');
    valores.push(meta.lider);
  }
  if (meta?.media != null) {
    categorias.push('Média');
    valores.push(meta.media);
  }
  return { categorias, valores };
}

function formatar(linha: ComparativoLinha, valor: number | null): string {
  if (valor == null) return '—';
  if (linha.unidade === 'moeda') return formatBRL(valor);
  if (linha.unidade === 'pct') return formatPct(valor, 0);
  if (linha.unidade === 'dias') return `${formatNum(valor, 0)} dias`;
  return formatNum(valor, Number.isInteger(valor) ? 0 : 1);
}
