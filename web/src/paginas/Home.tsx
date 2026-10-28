import { OBJETIVOS, RELATORIOS } from '@dash/shared';
import { Link } from 'react-router-dom';
import { usePainel } from '../store';

export function Home() {
  const tema = usePainel((s) => s.tema);
  const definirTema = usePainel((s) => s.definirTema);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5">
        <p className="text-sm font-semibold">Painel do Gerente</p>
        <button type="button" className="btn-sec" onClick={() => definirTema(tema === 'claro' ? 'escuro' : 'claro')}>
          {tema === 'claro' ? 'Tema escuro' : 'Tema claro'}
        </button>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Comercial</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-semibold leading-tight">O que você quer analisar hoje?</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Escolha o objetivo. A ferramenta pede só as planilhas daquele assunto e aponta o que fazer com o número na frente.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {OBJETIVOS.map((objetivo, indice) => (
            <Link key={objetivo.id} to={`/carregar/${objetivo.id}`} className="card block p-5">
              <p className="text-xs font-semibold text-muted">{String(indice + 1).padStart(2, '0')}</p>
              <h2 className="mt-2 text-xl font-semibold">{objetivo.titulo}</h2>
              <p className="mt-1 text-[var(--ink)]">{objetivo.pergunta}</p>
              <p className="mt-2 text-sm text-muted">{objetivo.detalhe}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {objetivo.relatorios.map((tipo) => (
                  <span key={tipo} className="chip">
                    {RELATORIOS[tipo].titulo}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">O que baixar?</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            No ERP, abra Relatórios e exporte os cinco itens marcados. São esses arquivos que o painel lê.
          </p>
          <img
            src="/o-que-baixar.png"
            alt="Menu de relatórios do ERP com os itens a exportar: Vendas detalhadas, Ranking de vendedor / Meta, Situação da carteira de clientes, Produtos mais vendidos e Estoque."
            className="mt-4 w-full rounded-xl border border-[var(--line)] bg-white"
          />
        </section>
        <p className="mt-8 max-w-2xl text-sm text-muted">
          Os arquivos ficam na memória desta sessão, por cerca de duas horas sem uso. Nada é gravado em disco, em banco ou enviado para fora.
        </p>
      </main>
    </div>
  );
}
