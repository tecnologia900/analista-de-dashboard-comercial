import { OBJETIVOS, RELATORIOS } from '@dash/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { limparSessaoRemota } from '../api';
import { Historico, SalvarAnalise } from '../historico';
import { usePainel } from '../store';

export function Home() {
  const tema = usePainel((s) => s.tema);
  const definirTema = usePainel((s) => s.definirTema);
  const limpar = usePainel((s) => s.limpar);
  const navigate = useNavigate();
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function novaAnalise(id: string) {
    if (iniciando) return;
    setIniciando(id);
    setErro(null);
    try {
      await limparSessaoRemota();
      limpar();
      navigate(`/carregar/${id}`);
    } catch {
      setErro('Não consegui abrir uma análise nova. Tente de novo.');
      setIniciando(null);
    }
  }

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
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Cada card começa uma análise nova, com as planilhas em branco. O histórico salvo neste computador continua abaixo.
        </p>
        {erro && <p className="erro mt-4">{erro}</p>}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {OBJETIVOS.map((objetivo, indice) => (
            <button
              key={objetivo.id}
              type="button"
              disabled={iniciando !== null}
              onClick={() => void novaAnalise(objetivo.id)}
              className="card block w-full cursor-pointer p-5 text-left disabled:cursor-default"
            >
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
            </button>
          ))}
        </div>
        <Historico />
        <SalvarAnalise completo />
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
          A sessão aberta fica na memória por cerca de duas horas sem uso. O histórico só é gravado quando você salva, e fica numa pasta deste computador. Nada é enviado para fora.
        </p>
      </main>
    </div>
  );
}
