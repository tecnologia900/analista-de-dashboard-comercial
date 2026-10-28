import { RELATORIOS, objetivoPorId } from '@dash/shared';
import type { TipoRelatorio } from '@dash/shared';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { enviarArquivo } from '../api';
import { usePainel } from '../store';

export function Upload() {
  const { objetivo: id = '' } = useParams();
  const objetivo = objetivoPorId(id);
  const relatorios = usePainel((s) => s.relatorios);
  const salvar = usePainel((s) => s.salvar);
  const [lendo, setLendo] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [pendente, setPendente] = useState<{ arquivo: File; mensagem: string; detectado: TipoRelatorio } | null>(null);

  if (!objetivo) return <Navigate to="/" replace />;

  async function enviar(arquivo: File, slot: TipoRelatorio | 'auto') {
    setLendo(slot);
    setErros((atual) => ({ ...atual, [slot]: '' }));
    const json = await enviarArquivo(arquivo, slot, false);
    setLendo(null);
    if (json.codigo === 'slot_incorreto' && json.detectado) {
      setPendente({ arquivo, mensagem: json.mensagem ?? 'Arquivo em outro slot.', detectado: json.detectado });
      return;
    }
    if (!json.ok || !json.relatorio) {
      setErros((atual) => ({ ...atual, [slot]: json.mensagem ?? 'Não consegui ler o arquivo.' }));
      return;
    }
    salvar(json.relatorio);
    setPendente(null);
  }

  async function mover() {
    if (!pendente) return;
    setLendo(pendente.detectado);
    const json = await enviarArquivo(pendente.arquivo, pendente.detectado, true);
    setLendo(null);
    if (!json.ok || !json.relatorio) {
      setErros((atual) => ({ ...atual, geral: json.mensagem ?? 'Não consegui mover o arquivo.' }));
      return;
    }
    salvar(json.relatorio);
    setPendente(null);
  }

  const prontos = objetivo.relatorios.every((tipo) => relatorios[tipo]);
  const algum = objetivo.relatorios.some((tipo) => relatorios[tipo]);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="text-sm font-semibold">
          ← Objetivos
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">{objetivo.titulo}</p>
        <h1 className="mt-2 text-3xl font-semibold">{objetivo.pergunta}</h1>
        <p className="mt-2 text-muted">{objetivo.detalhe}</p>
        {erros.geral && <p className="erro mt-4">{erros.geral}</p>}
        {pendente && (
          <div className="aviso mt-4 flex flex-wrap items-center justify-between gap-3">
            <p>{pendente.mensagem}</p>
            <button type="button" className="btn" onClick={() => void mover()}>
              Mover para {RELATORIOS[pendente.detectado].titulo}
            </button>
          </div>
        )}
        <div className="mt-6 space-y-4">
          {objetivo.relatorios.map((tipo) => (
            <Slot
              key={tipo}
              tipo={tipo}
              lendo={lendo === tipo}
              erro={erros[tipo]}
              onArquivo={(arquivo) => void enviar(arquivo, tipo)}
            />
          ))}
        </div>
        <label
          className="card mt-4 block cursor-pointer border-dashed p-5 text-center text-sm text-muted"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            for (const arquivo of Array.from(e.dataTransfer.files)) void enviar(arquivo, 'auto');
          }}
        >
          Ou solte qualquer um dos relatórios aqui. O tipo é reconhecido pelo conteúdo, não pelo nome do arquivo.
          <input
            className="sr-only"
            type="file"
            accept=".xls,.xlsx"
            multiple
            onChange={(e) => {
              for (const arquivo of Array.from(e.target.files ?? [])) void enviar(arquivo, 'auto');
              e.target.value = '';
            }}
          />
        </label>
        <div className="mt-6 flex flex-wrap gap-3">
          {prontos && (
            <Link to={objetivo.rota} className="btn">
              Ver dashboard
            </Link>
          )}
          {!prontos && algum && (
            <Link to={objetivo.rota} className="btn-sec">
              Abrir com o que já foi lido
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function Slot({
  tipo,
  lendo,
  erro,
  onArquivo,
}: {
  tipo: TipoRelatorio;
  lendo: boolean;
  erro?: string;
  onArquivo: (arquivo: File) => void;
}) {
  const relatorio = usePainel((s) => s.relatorios[tipo]);
  const def = RELATORIOS[tipo];
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{def.titulo}</h2>
          <p className="text-sm text-muted">{def.arquivo}</p>
        </div>
        <span className={relatorio ? 'ok' : lendo ? 'aviso' : 'chip'}>{lendo ? 'Lendo' : relatorio ? 'Lido' : 'Aguardando'}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{def.resumo}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {def.colunas.map((coluna) => (
          <span key={coluna} className="chip">
            {coluna}
          </span>
        ))}
      </div>
      {relatorio && (
        <p className="mt-3 text-sm">
          {relatorio.meta.linhasDados} linhas · {relatorio.meta.origem}
        </p>
      )}
      {erro && <p className="erro mt-3">{erro}</p>}
      <label
        className="mt-3 block cursor-pointer rounded-lg border border-dashed border-[var(--line)] px-3 py-6 text-center text-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const arquivo = e.dataTransfer.files[0];
          if (arquivo) onArquivo(arquivo);
        }}
      >
        Arraste o arquivo ou clique para escolher
        <input
          className="sr-only"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) onArquivo(arquivo);
            e.target.value = '';
          }}
        />
      </label>
    </section>
  );
}
