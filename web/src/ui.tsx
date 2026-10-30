import { OBJETIVOS, RELATORIOS, avisosDePeriodo, formatBRL } from '@dash/shared';
import type { Filtros, Oportunidade, TipoRelatorio } from '@dash/shared';
import { toPng } from 'html-to-image';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Resposta } from './leitura';
import { baixarApresentacao } from './apresentacao';
import { limparSessaoRemota } from './api';
import { SalvarAnalise } from './historico';
import { usePainel } from './store';

export function Moldura({ titulo, children }: { titulo: string; children: ReactNode }) {
  const location = useLocation();
  const relatorios = usePainel((s) => s.relatorios);
  const tema = usePainel((s) => s.tema);
  const definirTema = usePainel((s) => s.definirTema);
  const coberturaMax = usePainel((s) => s.coberturaMax);
  const limpar = usePainel((s) => s.limpar);
  const [aberto, setAberto] = useState(false);
  const [avisoImg, setAvisoImg] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const periodos = avisosDePeriodo(relatorios);
  const menu = [...OBJETIVOS.filter((objetivo) => objetivo.id !== 'reuniao'), ...OBJETIVOS.filter((objetivo) => objetivo.id === 'reuniao')];

  useEffect(() => {
    const id = location.hash.replace('#', '');
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location]);

  async function imagem() {
    const alvo = document.getElementById('painel');
    if (!alvo) return;
    try {
      const url = await toPng(alvo, {
        cacheBust: true,
        backgroundColor: tema === 'escuro' ? '#0e141b' : '#e7ece8',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.href = url;
      link.download = 'painel-gerente.png';
      link.click();
      setAvisoImg(null);
    } catch {
      setAvisoImg('Não consegui gerar a imagem.');
    }
  }

  async function pdf() {
    if (gerandoPdf) return;
    if (!Object.values(relatorios).some(Boolean)) {
      setAvisoImg('Carregue uma análise para montar a apresentação da diretoria.');
      return;
    }
    setGerandoPdf(true);
    setAvisoImg(null);
    try {
      await baixarApresentacao(relatorios, coberturaMax);
    } catch {
      setAvisoImg('Não consegui gerar o PDF da apresentação.');
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <div className="min-h-screen md:pl-60">
      <aside className={`sidebar fixed inset-y-0 left-0 z-40 w-60 transform transition ${aberto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex h-full flex-col overflow-y-auto p-4">
          <Link to="/" className="mb-6 block" onClick={() => setAberto(false)}>
            <Marca />
          </Link>
          <nav className="flex flex-1 flex-col gap-1 text-sm">
            {menu.map((objetivo) => {
              const prontos = objetivo.relatorios.filter((tipo) => relatorios[tipo]).length;
              const ativo = location.pathname === objetivo.rota;
              return (
                <Link
                  key={objetivo.id}
                  to={objetivo.rota}
                  onClick={() => setAberto(false)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${ativo ? 'ativo' : ''}`}
                >
                  <span>{objetivo.titulo}</span>
                  <Ponto cheio={prontos === objetivo.relatorios.length} parcial={prontos > 0 && prontos < objetivo.relatorios.length} />
                </Link>
              );
            })}
          </nav>
          <Link to="/#historico" onClick={() => setAberto(false)} className="mt-4 rounded-lg px-3 py-2 text-sm">
            Histórico
          </Link>
          <button
            type="button"
            className="btn-ghost mt-2 text-left text-sm text-[var(--sidebar-text)]"
            onClick={() => {
              void limparSessaoRemota().catch(() => undefined);
              limpar();
            }}
          >
            Limpar sessão
          </button>
        </div>
      </aside>
      {aberto && <button type="button" className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-label="Fechar menu" onClick={() => setAberto(false)} />}
      <div className="area-painel min-h-screen">
        <header className="no-print sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" className="btn-sec md:hidden" onClick={() => setAberto(true)}>
                Menu
              </button>
              <h1 className="text-lg font-semibold">{titulo}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-sec" onClick={() => definirTema(tema === 'claro' ? 'escuro' : 'claro')}>
                {tema === 'claro' ? 'Tema escuro' : 'Tema claro'}
              </button>
              <button type="button" className="btn-sec" onClick={() => void telaCheia()}>
                Tela cheia
              </button>
              <button type="button" className="btn-sec" onClick={() => void imagem()}>
                Imagem
              </button>
              <button type="button" className="btn-sec" disabled={gerandoPdf} onClick={() => void pdf()}>
                {gerandoPdf ? 'Gerando…' : 'PDF'}
              </button>
            </div>
          </div>
        </header>
        <main id="painel" className="space-y-4 px-4 py-4 md:px-6">
          <Origens />
          <div className="no-print">
            <SalvarAnalise />
          </div>
          <FiltrosAtivos />
          {periodos.map((texto) => (
            <p key={texto} className="aviso">
              {texto}
            </p>
          ))}
          {avisoImg && <p className="aviso">{avisoImg}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}

function Marca() {
  return (
    <span className="flex items-center gap-2 text-white">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#1c314d" />
        <rect x="6" y="16" width="4" height="10" fill="#2faf90" />
        <rect x="14" y="10" width="4" height="16" fill="#e7ece8" />
        <rect x="22" y="6" width="4" height="20" fill="#c4a15a" />
      </svg>
      <span>
        <span className="block text-sm font-semibold leading-tight">Painel do Gerente</span>
        <span className="block text-xs text-[var(--sidebar-text)]">Decisão comercial</span>
      </span>
    </span>
  );
}

function Ponto({ cheio, parcial }: { cheio: boolean; parcial: boolean }) {
  const cor = cheio ? 'var(--good)' : parcial ? 'var(--warn)' : 'transparent';
  const borda = cheio || parcial ? cor : 'var(--sidebar-text)';
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: cor, boxShadow: `inset 0 0 0 1.5px ${borda}` }} />;
}

export function Origens() {
  const relatorios = usePainel((s) => s.relatorios);
  const itens = (Object.keys(relatorios) as TipoRelatorio[])
    .map((tipo) => relatorios[tipo])
    .filter((relatorio): relatorio is NonNullable<typeof relatorio> => !!relatorio);
  if (!itens.length) return <p className="text-sm text-muted">Nenhuma planilha carregada nesta sessão.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {itens.map((relatorio) => (
        <span key={relatorio.tipo} className="chip">
          {RELATORIOS[relatorio.tipo].titulo}: {relatorio.meta.origem}
        </span>
      ))}
    </div>
  );
}

const ROTULOS: Record<keyof Filtros, string> = {
  vendedor: 'Vendedor',
  cliente: 'Cliente',
  categoria: 'Categoria',
  representada: 'Representada',
  situacao: 'Situação',
  condicao: 'Condição',
  produto: 'Produto',
};

export function FiltrosAtivos() {
  const filtros = usePainel((s) => s.filtros);
  const setFiltro = usePainel((s) => s.setFiltro);
  const limparFiltros = usePainel((s) => s.limparFiltros);
  const ativos = (Object.entries(filtros) as [keyof Filtros, string | null][]).filter((entrada): entrada is [keyof Filtros, string] => !!entrada[1]);
  if (!ativos.length) return null;
  return (
    <div className="no-print mt-3 flex flex-wrap items-center gap-2">
      {ativos.map(([chave, valor]) => (
        <button key={chave} type="button" className="chip" onClick={() => setFiltro(chave, null)}>
          {ROTULOS[chave]}: {valor} ×
        </button>
      ))}
      <button type="button" className="btn-ghost text-sm" onClick={limparFiltros}>
        Limpar filtros
      </button>
    </div>
  );
}

export function Kpi({ rotulo, valor, detalhe, tom = 'neutro' }: { rotulo: string; valor: string; detalhe?: string; tom?: 'neutro' | 'bom' | 'alerta' | 'ruim' }) {
  const cor = tom === 'bom' ? 'text-good' : tom === 'alerta' ? 'text-warn' : tom === 'ruim' ? 'text-bad' : '';
  return (
    <article className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{rotulo}</p>
      <p className={`num mt-2 text-2xl font-semibold ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-sm text-muted">{detalhe}</p>}
    </article>
  );
}

export function Bloco({
  id,
  titulo,
  insight,
  extra,
  children,
}: {
  id?: string;
  titulo: string;
  insight?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="card scroll-mt-28 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
          {insight && <p className="mt-1 max-w-3xl text-sm text-muted">{insight}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function Vazio({ titulo, detalhe, href }: { titulo: string; detalhe: string; href: string }) {
  return (
    <div className="card p-6">
      <h2 className="font-semibold">{titulo}</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">{detalhe}</p>
      <Link to={href} className="btn mt-4">
        Enviar planilha
      </Link>
    </div>
  );
}

const ROTULO_SEV: Record<Oportunidade['severidade'], string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export function Leitura({ frase, itens }: { frase?: string | null; itens: Resposta[] }) {
  if (!itens.length) return null;
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3">
        <h2 className="text-[15px] font-semibold">Leitura do recorte</h2>
        {frase && <p className="mt-1 max-w-4xl text-[15px] leading-relaxed">{frase}</p>}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3">
        {itens.map((item) => (
          <Link key={item.id} to={item.href} className={`leitura tom-${item.tom} block min-w-0 px-4 py-3`} title={item.resposta}>
            <p className="text-sm text-muted">{item.pergunta}</p>
            <p className="clamp-2 mt-1 text-lg font-semibold leading-snug">{item.resposta}</p>
            <p className="mt-1 text-sm text-muted">{item.apoio}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Oportunidades({ itens }: { itens: Oportunidade[] }) {
  if (!itens.length) return null;
  const topo = itens.slice(0, 3);
  const resto = itens.slice(3, 8);
  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold">O que fazer agora</h2>
      <div className="grid gap-3 lg:grid-cols-3">
        {topo.map((item, indice) => (
          <Link key={item.id} to={item.ancora} className={`card sev-${item.severidade} block p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {indice + 1} · {ROTULO_SEV[item.severidade]}
              {item.impacto > 0 ? ` · ${formatBRL(item.impacto)}` : ''}
            </p>
            <p className="mt-2 font-semibold">{item.titulo}</p>
            <p className="mt-1 text-sm text-muted">{item.detalhe}</p>
          </Link>
        ))}
      </div>
      {resto.length > 0 && (
        <ul className="mt-3 space-y-2">
          {resto.map((item) => (
            <li key={item.id}>
              <Link to={item.ancora} className="text-sm underline-offset-2 hover:underline">
                {item.titulo}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Selecao({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: string | null;
  opcoes: string[];
  aoMudar: (valor: string | null) => void;
}) {
  return (
    <label className="block min-w-40 text-sm">
      <span className="mb-1 block text-muted">{rotulo}</span>
      <select className="campo" value={valor ?? ''} onChange={(e) => aoMudar(e.target.value || null)}>
        <option value="">Todos</option>
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Avisos({ itens }: { itens: string[] }) {
  if (!itens.length) return null;
  return (
    <div className="space-y-2">
      {itens.map((texto) => (
        <p key={texto} className="aviso">
          {texto}
        </p>
      ))}
    </div>
  );
}

function telaCheia() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}
