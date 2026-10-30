import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { CSSProperties, ReactNode } from 'react';
import type { Pacote } from './store';
import { montarRoteiro } from './roteiro';
import type { AcaoDiretoria, Barra, Cartao, FrenteCarteira, FrenteGiro, FrenteTime, FrenteVendas, ItemLista, LinhaTime, RoteiroDiretoria } from './roteiro';

const LARGURA = 1188;
const ALTURA = 840;
const PAPEL = '#f4f1ea';
const TINTA = '#172033';
const MUDO = '#5c6b7c';
const LINHA = '#ddd6c8';
const VERDE = '#0f6e56';
const OURO = '#8a5a00';
const MARINHO = '#101c2e';
const CREME = '#fffdf8';
const FONTE = '"Segoe UI", "Helvetica Neue", sans-serif';

type Miolo = (pagina: string) => ReactNode;

export async function baixarApresentacao(relatorios: Pacote, coberturaMax: number) {
  const roteiro = montarRoteiro(relatorios, coberturaMax);
  const total = contarSlides(roteiro);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;inset:0;z-index:80;';
  document.body.appendChild(host);
  const root = createRoot(host);
  const anterior = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    pdf.setProperties({ title: 'Reunião de diretoria', creator: 'Painel do Gerente' });
    const largura = pdf.internal.pageSize.getWidth();
    const altura = pdf.internal.pageSize.getHeight();
    for (let indice = 0; indice < total; indice += 1) {
      root.render(<SlideDiretoria roteiro={roteiro} indice={indice} />);
      await quadro();
      await quadro();
      const slide = host.querySelector<HTMLElement>('[data-slide]');
      if (!slide) throw new Error('slide');
      const png = await toPng(slide, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: PAPEL,
        width: LARGURA,
        height: ALTURA,
        skipFonts: true,
      });
      if (indice > 0) pdf.addPage();
      pdf.addImage(png, 'PNG', 0, 0, largura, altura, undefined, 'FAST');
    }
    pdf.save(`Reuniao da diretoria ${roteiro.geradoEm.replaceAll('/', '-')}.pdf`);
  } finally {
    document.body.style.overflow = anterior;
    root.unmount();
    host.remove();
  }
}

function contarSlides(roteiro: RoteiroDiretoria) {
  return miolos(roteiro).length + 1;
}

function miolos(roteiro: RoteiroDiretoria): Miolo[] {
  const lista: Miolo[] = [(pagina) => <Leitura roteiro={roteiro} pagina={pagina} />];
  if (roteiro.acoes.length) lista.push((pagina) => <Decisao roteiro={roteiro} pagina={pagina} />);
  if (roteiro.vendas) {
    lista.push((pagina) => <Vendas frente={roteiro.vendas as FrenteVendas} pagina={pagina} />);
    lista.push((pagina) => <Composicao frente={roteiro.vendas as FrenteVendas} pagina={pagina} />);
  }
  if (roteiro.time) lista.push((pagina) => <Time frente={roteiro.time as FrenteTime} pagina={pagina} />);
  if (roteiro.carteira) {
    lista.push((pagina) => <Carteira frente={roteiro.carteira as FrenteCarteira} pagina={pagina} />);
    lista.push((pagina) => <Contas frente={roteiro.carteira as FrenteCarteira} pagina={pagina} />);
  }
  if (roteiro.giro?.temProdutos) lista.push((pagina) => <Giro frente={roteiro.giro as FrenteGiro} pagina={pagina} />);
  if (roteiro.giro?.temEstoque) lista.push((pagina) => <Estoque frente={roteiro.giro as FrenteGiro} pagina={pagina} />);
  lista.push((pagina) => <Fecho roteiro={roteiro} pagina={pagina} />);
  return lista;
}

function SlideDiretoria({ roteiro, indice }: { roteiro: RoteiroDiretoria; indice: number }) {
  const blocos = miolos(roteiro);
  const total = String(blocos.length + 1).padStart(2, '0');
  const pagina = `${String(indice + 1).padStart(2, '0')} / ${total}`;
  const slide = indice === 0 ? <Capa roteiro={roteiro} /> : blocos[indice - 1]?.(pagina);
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          display: 'grid',
          placeItems: 'center',
          background: MARINHO,
          color: PAPEL,
          fontFamily: FONTE,
          fontSize: 22,
        }}
      >
        Gerando a apresentação…
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, zIndex: 1 }}>{slide}</div>
    </>
  );
}

function Capa({ roteiro }: { roteiro: RoteiroDiretoria }) {
  return (
    <section data-slide style={{ ...base, padding: 0, display: 'grid', gridTemplateColumns: '460px 1fr', background: PAPEL }}>
      <div style={{ background: MARINHO, color: PAPEL, padding: '44px 40px', display: 'flex', flexDirection: 'column' }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#9eb0c6' }}>Painel do Gerente</p>
        <h1 style={{ margin: '22px 0 0', fontSize: 44, lineHeight: 1.05, fontWeight: 650, letterSpacing: '-0.03em' }}>Reunião de diretoria</h1>
        <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.4, color: '#d5deea' }}>{roteiro.periodo}</p>
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
          {roteiro.numeros.slice(0, 4).map((numero) => (
            <div key={numero.rotulo}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9eb0c6' }}>{numero.rotulo}</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 650, letterSpacing: '-0.02em' }}>{numero.valor}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9eb0c6' }}>{numero.apoio}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 'auto', marginBottom: 0, fontSize: 14, color: '#9eb0c6' }}>Gerado em {roteiro.geradoEm}</p>
      </div>
      <div style={{ padding: '40px 44px', display: 'flex', flexDirection: 'column' }}>
        <p style={kicker}>O que a sala vai ver</p>
        <p style={{ margin: '10px 0 0', fontSize: 18, lineHeight: 1.4 }}>Números da empresa inteira, na ordem em que a diretoria decide.</p>
        <div style={{ marginTop: 22 }}>
          {roteiro.secoes.map((secao, indice) => (
            <div key={secao} style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 8, alignItems: 'baseline', padding: '9px 0', borderTop: `1px solid ${LINHA}` }}>
              <span style={{ fontSize: 13, color: VERDE, fontWeight: 700 }}>{String(indice + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: 16 }}>{secao}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto' }}>
          {roteiro.origens.slice(0, 4).map((origem) => (
            <p key={origem} style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.35, color: MUDO }}>
              {origem}
            </p>
          ))}
          {roteiro.avisos.map((aviso) => (
            <p key={aviso} style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.35, color: OURO }}>
              {aviso}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Leitura({ roteiro, pagina }: { roteiro: RoteiroDiretoria; pagina: string }) {
  return (
    <Folha etapa="Leitura" titulo="O que o período está dizendo" pagina={pagina}>
      <p style={{ margin: 0, fontSize: 18, lineHeight: 1.35, fontWeight: 650 }}>{roteiro.frase}</p>
      <div style={{ flex: 1, minHeight: 0, marginTop: 16, display: 'grid', gridTemplateColumns: '1.35fr 0.72fr', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {roteiro.abertura.length === 0 ? (
            <VazioFrente texto="Os arquivos carregados ainda não fecham uma leitura. Os blocos seguintes mostram o que cada um liberou." />
          ) : (
            roteiro.abertura.map((cartao) => (
              <div key={cartao.rotulo} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: `1px solid ${LINHA}`, padding: '6px 0' }}>
                <p style={{ ...kicker, margin: 0 }}>{cartao.rotulo}</p>
                <p style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 650, lineHeight: 1.25 }}>{cartao.valor}</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.3, color: MUDO }}>{cartao.apoio}</p>
              </div>
            ))
          )}
        </div>
        <div style={{ background: CREME, border: `1px solid ${LINHA}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Números do período</p>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 6 }}>
            {roteiro.numeros.map((numero) => (
              <div key={numero.rotulo} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: `1px solid ${LINHA}` }}>
                <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUDO, fontWeight: 700 }}>{numero.rotulo}</p>
                <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 650 }}>{numero.valor}</p>
                <p style={{ margin: 0, fontSize: 12, color: MUDO }}>{numero.apoio}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Folha>
  );
}

function Decisao({ roteiro, pagina }: { roteiro: RoteiroDiretoria; pagina: string }) {
  const meio = Math.ceil(roteiro.acoes.length / 2);
  const colunas = roteiro.acoes.length <= 3 ? [roteiro.acoes] : [roteiro.acoes.slice(0, meio), roteiro.acoes.slice(meio)];
  return (
    <Folha etapa="Decisão" titulo="Onde está o valor em aberto" pagina={pagina}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${colunas.length}, 1fr)`, gap: 28 }}>
        {colunas.map((coluna, colunaIndice) => (
          <div key={colunaIndice} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {coluna.map((acao, indice) => (
              <AcaoVisual key={`${acao.titulo}-${indice}`} acao={acao} indice={colunaIndice * meio + indice} />
            ))}
          </div>
        ))}
      </div>
    </Folha>
  );
}

function Vendas({ frente, pagina }: { frente: FrenteVendas; pagina: string }) {
  return (
    <Folha etapa="Vendas" titulo="O ritmo do faturamento" pagina={pagina}>
      <Faixa cartoes={frente.kpis} />
      <div style={{ flex: 1, minHeight: 0, marginTop: 8, display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 26 }}>
        <div>
          <p style={texto}>{frente.evolucao}</p>
          <p style={texto}>{frente.semana}</p>
          <p style={{ ...kicker, marginTop: 12 }}>Dia da semana</p>
          <Barras itens={frente.dias} />
          <p style={{ ...kicker, marginTop: 12 }}>Tamanho do pedido</p>
          <Barras itens={frente.faixas} rotulo={108} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Maiores pedidos</p>
          <Lista itens={frente.pedidos} vazio="Sem pedidos neste recorte." estica />
        </div>
      </div>
    </Folha>
  );
}

function Composicao({ frente, pagina }: { frente: FrenteVendas; pagina: string }) {
  return (
    <Folha etapa="Vendas" titulo="Quem concentra a venda" pagina={pagina}>
      <p style={{ ...texto, marginTop: 0 }}>{frente.clientesFrase}</p>
      <p style={texto}>{frente.condicao}</p>
      <div style={{ flex: 1, minHeight: 0, marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 0.9fr', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Clientes</p>
          <Lista itens={frente.clientes} vazio="Sem clientes neste recorte." estica />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Condição de pagamento</p>
          <Lista itens={frente.condicoes} vazio="Sem condição neste recorte." estica />
        </div>
        <div>
          <p style={kicker}>Vendedores</p>
          <Barras itens={frente.vendedores} rotulo={128} />
        </div>
      </div>
    </Folha>
  );
}

function Time({ frente, pagina }: { frente: FrenteTime; pagina: string }) {
  return (
    <Folha etapa="Time" titulo="Meta, previsão e orçamento" pagina={pagina}>
      <Faixa cartoes={frente.kpis} />
      <p style={texto}>{frente.meta}</p>
      <Tabela linhas={frente.linhas} />
      <p style={texto}>{frente.orcamentos}</p>
      <p style={texto}>{frente.semMeta}</p>
      <p style={texto}>{frente.dispersao}</p>
      <p style={texto}>{frente.prazo}</p>
      {frente.demais && <p style={texto}>{frente.demais}</p>}
    </Folha>
  );
}

function Carteira({ frente, pagina }: { frente: FrenteCarteira; pagina: string }) {
  return (
    <Folha etapa="Carteira" titulo="A saúde da carteira" pagina={pagina}>
      <Faixa cartoes={frente.kpis} />
      <div style={{ flex: 1, minHeight: 0, marginTop: 6, display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 26 }}>
        <div>
          <p style={kicker}>Situação</p>
          <Barras itens={frente.situacao} rotulo={118} />
          <p style={{ ...kicker, marginTop: 12 }}>Dias sem comprar</p>
          <Barras itens={frente.faixas} rotulo={72} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Quem mais faturou</p>
          <Lista itens={frente.topo} vazio="Sem vendas para ordenar a carteira." estica />
        </div>
      </div>
      <p style={texto}>{frente.mistura}</p>
      <p style={texto}>{frente.concentracao}</p>
    </Folha>
  );
}

function Contas({ frente, pagina }: { frente: FrenteCarteira; pagina: string }) {
  return (
    <Folha etapa="Carteira" titulo="Contas para ligar e reativar" pagina={pagina}>
      <p style={{ ...texto, marginTop: 0 }}>{frente.risco}</p>
      <div style={{ flex: 1, minHeight: 0, marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Além do ciclo</p>
          <Lista itens={frente.ligar} vazio="Nenhum ativo passou do próprio ciclo." estica />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Reativar primeiro</p>
          <Lista itens={frente.reativar} vazio="Não há inativo recente neste recorte." estica />
        </div>
      </div>
      {frente.distante && <p style={texto}>{frente.distante}</p>}
    </Folha>
  );
}

function Giro({ frente, pagina }: { frente: FrenteGiro; pagina: string }) {
  const ambos = frente.cresceram.length > 0 && frente.cairam.length > 0;
  const quedaNaColuna = !ambos && frente.cairam.length > 0;
  const altaNaColuna = !ambos && frente.cresceram.length > 0;
  return (
    <Folha etapa="Giro" titulo="O que puxa o faturamento" pagina={pagina}>
      <Faixa cartoes={frente.kpis} />
      <div style={{ flex: 1, minHeight: 0, marginTop: 6, display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Produtos</p>
          <Lista itens={frente.produtos} vazio="Sem produtos neste recorte." estica />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Curva ABC</p>
          <p style={texto}>{frente.abc}</p>
          <Barras itens={frente.classes} />
          {frente.categorias.length > 0 && (
            <>
              <p style={{ ...kicker, marginTop: 10 }}>Categorias</p>
              <Barras itens={frente.categorias} rotulo={108} />
            </>
          )}
          {quedaNaColuna && (
            <>
              <p style={{ ...kicker, marginTop: 12 }}>Caíram</p>
              <Lista itens={frente.cairam} vazio="" estica />
            </>
          )}
          {altaNaColuna && (
            <>
              <p style={{ ...kicker, marginTop: 12 }}>Cresceram</p>
              <Lista itens={frente.cresceram} vazio="" estica />
            </>
          )}
        </div>
      </div>
      {ambos && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginTop: 8 }}>
          <div>
            <p style={kicker}>Cresceram</p>
            <Lista itens={frente.cresceram} vazio="" />
          </div>
          <div>
            <p style={kicker}>Caíram</p>
            <Lista itens={frente.cairam} vazio="" />
          </div>
        </div>
      )}
      <p style={texto}>{frente.variacao}</p>
    </Folha>
  );
}

function Estoque({ frente, pagina }: { frente: FrenteGiro; pagina: string }) {
  return (
    <Folha etapa="Estoque" titulo="O que está parado e o que pode furar" pagina={pagina}>
      <Faixa cartoes={frente.kpis} />
      <div style={{ flex: 1, minHeight: 0, marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Maior valor parado</p>
          <p style={texto}>{frente.parado}</p>
          <Lista itens={frente.parados} vazio="Nenhum item parado neste recorte." estica />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <p style={kicker}>Risco de ruptura</p>
          <p style={texto}>{frente.ruptura}</p>
          <Lista itens={frente.rupturas} vazio="Nenhum líder com cobertura curta." estica />
          <p style={{ ...kicker, marginTop: 8 }}>Representadas</p>
          <p style={texto}>{frente.representada}</p>
          <Barras itens={frente.representadas} rotulo={168} />
        </div>
      </div>
    </Folha>
  );
}

function Fecho({ roteiro, pagina }: { roteiro: RoteiroDiretoria; pagina: string }) {
  return (
    <Folha etapa="Fechamento" titulo="O que sai com dono e data" pagina={pagina}>
      {roteiro.numeros.length > 0 && <Faixa cartoes={roteiro.numeros.slice(0, 4)} />}
      {roteiro.acoes.length === 0 ? (
        <VazioFrente texto="Não houve ação com valor para atribuir neste recorte." />
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {roteiro.acoes.map((acao, indice) => (
            <div key={`${acao.titulo}-${indice}`} style={{ flex: 1, display: 'grid', gridTemplateColumns: '28px 1fr 180px 140px', gap: 12, alignItems: 'center', borderBottom: `1px solid ${LINHA}` }}>
              <span style={{ color: VERDE, fontWeight: 700 }}>{indice + 1}</span>
              <div>
                <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUDO, fontWeight: 700 }}>{acao.area}</p>
                <p style={{ margin: '1px 0 0', fontSize: 14, fontWeight: 650, lineHeight: 1.25 }}>{acao.titulo}</p>
                {impactoForaDoTitulo(acao) && <p style={{ margin: '1px 0 0', fontSize: 12, color: VERDE, fontWeight: 700 }}>{acao.impacto}</p>}
              </div>
              <Campo rotulo="Dono" />
              <Campo rotulo="Até" />
            </div>
          ))}
        </div>
      )}
      <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.4, color: MUDO }}>
        A conversa seguinte, com cada vendedor, usa a meta, o 1º lugar sem citar o nome e a média. Estes arquivos não separam produto por vendedor.
      </p>
    </Folha>
  );
}

function Folha({ etapa, titulo, pagina, children }: { etapa: string; titulo: string; pagina: string; children: ReactNode }) {
  return (
    <section data-slide style={base}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <p style={kicker}>{etapa}</p>
        <p style={kicker}>{pagina}</p>
      </div>
      <h1 style={{ margin: '6px 0 0', fontSize: 28, lineHeight: 1.12, fontWeight: 650, letterSpacing: '-0.03em' }}>{titulo}</h1>
      <div style={{ flex: 1, minHeight: 0, marginTop: 12, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  );
}

function Faixa({ cartoes }: { cartoes: Cartao[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(cartoes.length, 1)}, 1fr)`, gap: 12 }}>
      {cartoes.map((cartao) => (
        <div key={cartao.rotulo}>
          <p style={{ ...kicker, margin: 0 }}>{cartao.rotulo}</p>
          <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 650, letterSpacing: '-0.02em' }}>{cartao.valor}</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: MUDO, lineHeight: 1.3 }}>{cartao.apoio}</p>
        </div>
      ))}
    </div>
  );
}

function AcaoVisual({ acao, indice }: { acao: AcaoDiretoria; indice: number }) {
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, alignItems: 'center', borderTop: `1px solid ${LINHA}` }}>
      <span style={{ color: VERDE, fontWeight: 700 }}>{indice + 1}</span>
      <div>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUDO, fontWeight: 700 }}>
          {acao.area}
          {impactoForaDoTitulo(acao) ? ` · ${acao.impacto}` : ''}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 650, lineHeight: 1.25 }}>{acao.titulo}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, lineHeight: 1.3, color: MUDO }}>{acao.detalhe}</p>
      </div>
    </div>
  );
}

function Lista({ itens, vazio, estica = false }: { itens: ItemLista[]; vazio: string; estica?: boolean }) {
  if (itens.length === 0) return <p style={texto}>{vazio}</p>;
  return (
    <div style={estica ? { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } : undefined}>
      {itens.map((item, indice) => (
        <div key={`${item.titulo}-${indice}`} style={{ flex: estica ? 1 : undefined, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 0', borderTop: `1px solid ${LINHA}` }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 650, lineHeight: 1.25 }}>{item.titulo}</p>
          <p style={{ margin: '1px 0 0', fontSize: 12, color: MUDO, lineHeight: 1.3 }}>{item.detalhe}</p>
        </div>
      ))}
    </div>
  );
}

function Barras({ itens, rotulo = 72 }: { itens: Barra[]; rotulo?: number }) {
  const topo = Math.max(...itens.map((item) => item.valor), 1);
  if (itens.length === 0) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {itens.map((item) => (
        <div key={`${item.rotulo}-${item.texto}`} style={{ display: 'grid', gridTemplateColumns: `${rotulo}px 1fr auto`, gap: 8, alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 12, color: MUDO, lineHeight: 1.2 }}>{item.rotulo}</span>
          <span style={{ position: 'relative', display: 'block', height: 7, background: '#e7e0d4', borderRadius: 99 }}>
            <span style={{ display: 'block', width: `${Math.min(100, (item.valor / topo) * 100)}%`, height: '100%', background: VERDE, borderRadius: 99 }} />
          </span>
          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{item.texto}</span>
        </div>
      ))}
    </div>
  );
}

function Tabela({ linhas }: { linhas: LinhaTime[] }) {
  const grade = '1.35fr 0.95fr 0.9fr 0.55fr 0.62fr 0.95fr 0.85fr 0.48fr';
  const cabecalhos = ['Vendedor', 'Vendido', 'Meta', 'Ating.', 'Previsão', 'Orçamentos', 'Ticket', 'Clientes'];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: grade, gap: 8, paddingBottom: 4 }}>
        {cabecalhos.map((cabecalho) => (
          <span key={cabecalho} style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUDO, fontWeight: 700 }}>
            {cabecalho}
          </span>
        ))}
      </div>
      {linhas.map((linha) => (
        <div key={linha.nome} style={{ flex: 1, display: 'grid', gridTemplateColumns: grade, gap: 8, alignItems: 'center', borderTop: `1px solid ${LINHA}`, fontSize: 12 }}>
          <span style={{ fontWeight: 650 }}>{linha.nome}</span>
          <span>{linha.vendido}</span>
          <span>{linha.meta}</span>
          <span style={{ color: linha.tom === 'acima' ? VERDE : linha.tom === 'abaixo' ? OURO : TINTA, fontWeight: 700 }}>{linha.atingimento}</span>
          <span>{linha.previsao}</span>
          <span>{linha.orcamentos}</span>
          <span>{linha.ticket}</span>
          <span>{linha.clientes}</span>
        </div>
      ))}
    </div>
  );
}

function impactoForaDoTitulo(acao: AcaoDiretoria) {
  return acao.impacto !== 'Sem valor' && !acao.titulo.includes(acao.impacto);
}

function Campo({ rotulo }: { rotulo: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUDO }}>{rotulo}</p>
      <div style={{ marginTop: 14, borderBottom: `1px solid ${TINTA}` }} />
    </div>
  );
}

function VazioFrente({ texto }: { texto: string }) {
  return <p style={{ margin: 0, maxWidth: 760, fontSize: 20, lineHeight: 1.4 }}>{texto}</p>;
}

function quadro() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
}

const base: CSSProperties = {
  width: LARGURA,
  height: ALTURA,
  boxSizing: 'border-box',
  padding: '26px 40px 20px',
  background: PAPEL,
  color: TINTA,
  fontFamily: FONTE,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const kicker: CSSProperties = {
  margin: 0,
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: MUDO,
  fontWeight: 700,
};

const texto: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 13,
  lineHeight: 1.35,
};
