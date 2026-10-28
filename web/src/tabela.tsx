import { formatBRL, formatNum, formatPct } from '@dash/shared';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';

export interface ColunaTabela<T> {
  id: string;
  titulo: string;
  valor: (linha: T) => string | number | null;
  tipo?: 'texto' | 'moeda' | 'pct' | 'num';
  casas?: number;
  barra?: (linha: T) => { pct: number; cor: 'bom' | 'alerta' | 'ruim' } | null;
}

const COR: Record<'bom' | 'alerta' | 'ruim', string> = {
  bom: 'var(--good)',
  alerta: 'var(--warn)',
  ruim: 'var(--bad)',
};

function exibir<T>(coluna: ColunaTabela<T>, linha: T): string {
  const valor = coluna.valor(linha);
  if (valor == null || valor === '') return '—';
  if (typeof valor === 'number') {
    if (coluna.tipo === 'moeda') return formatBRL(valor);
    if (coluna.tipo === 'pct') return formatPct(valor, coluna.casas ?? 1);
    return formatNum(valor, coluna.casas ?? (Number.isInteger(valor) ? 0 : 1));
  }
  return valor;
}

export function Tabela<T>({
  linhas,
  colunas,
  nomeArquivo,
  tamanho = 8,
}: {
  linhas: T[];
  colunas: ColunaTabela<T>[];
  nomeArquivo: string;
  tamanho?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [busca, setBusca] = useState('');
  const columns = useMemo<ColumnDef<T>[]>(
    () =>
      colunas.map((coluna) => ({
        id: coluna.id,
        header: coluna.titulo,
        accessorFn: (linha: T) => coluna.valor(linha),
        cell: ({ row }) => {
          const texto = exibir(coluna, row.original);
          const barra = coluna.barra?.(row.original);
          if (!barra) return texto;
          return (
            <span className="relative block min-w-24">
              <span
                className="absolute inset-y-0.5 left-0 rounded-sm opacity-25"
                style={{ width: `${Math.max(0, Math.min(100, barra.pct))}%`, background: COR[barra.cor] }}
              />
              <span className="relative num">{texto}</span>
            </span>
          );
        },
        sortingFn: (a, b) => {
          const va = coluna.valor(a.original);
          const vb = coluna.valor(b.original);
          if (typeof va === 'number' && typeof vb === 'number') return va - vb;
          return String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { numeric: true });
        },
      })),
    [colunas],
  );

  const table = useReactTable({
    data: linhas,
    columns,
    state: { sorting, globalFilter: busca },
    initialState: { pagination: { pageSize: tamanho } },
    onSortingChange: setSorting,
    onGlobalFilterChange: setBusca,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _id, filter) => {
      const texto = colunas.map((coluna) => String(coluna.valor(row.original) ?? '')).join(' ').toLowerCase();
      return texto.includes(String(filter).toLowerCase());
    },
  });

  const exportarLinhas = table.getFilteredRowModel().rows.map((row) => row.original);

  return (
    <div>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <input className="campo max-w-xs" placeholder="Buscar na tabela" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button type="button" className="btn-sec" onClick={() => baixarCsv(exportarLinhas, colunas, nomeArquivo)}>
          CSV
        </button>
        <button type="button" className="btn-sec" onClick={() => void baixarXlsx(exportarLinhas, colunas, nomeArquivo)}>
          Excel
        </button>
        <span className="text-sm text-muted">
          {table.getFilteredRowModel().rows.length === 1 ? '1 linha' : `${table.getFilteredRowModel().rows.length} linhas`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="tabela">
          <thead>
            {table.getHeaderGroups().map((grupo) => (
              <tr key={grupo.id}>
                {grupo.headers.map((header) => (
                  <th key={header.id}>
                    <button type="button" className="font-semibold" onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={colunas.length} className="text-muted">
                  Nenhuma linha neste recorte.
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="no-print mt-3 flex items-center justify-between text-sm">
        <span className="text-muted">
          Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
        </span>
        <div className="flex gap-2">
          <button type="button" className="btn-sec" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            Anterior
          </button>
          <button type="button" className="btn-sec" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

function baixarCsv<T>(linhas: T[], colunas: ColunaTabela<T>[], nome: string) {
  const cabeca = colunas.map((coluna) => coluna.titulo).join(';');
  const corpo = linhas.map((linha) =>
    colunas
      .map((coluna) => {
        const valor = coluna.valor(linha);
        if (typeof valor === 'number') return valor.toLocaleString('pt-BR');
        return `"${String(valor ?? '').replace(/"/g, '""')}"`;
      })
      .join(';'),
  );
  const blob = new Blob([`\uFEFF${[cabeca, ...corpo].join('\n')}`], { type: 'text/csv;charset=utf-8' });
  disparar(blob, `${nome}.csv`);
}

async function baixarXlsx<T>(linhas: T[], colunas: ColunaTabela<T>[], nome: string) {
  const XLSX = await import('xlsx');
  const dados = linhas.map((linha) => {
    const registro: Record<string, string | number | null> = {};
    for (const coluna of colunas) registro[coluna.titulo] = coluna.valor(linha);
    return registro;
  });
  const folha = XLSX.utils.json_to_sheet(dados);
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, folha, 'Dados');
  XLSX.writeFile(pasta, `${nome}.xlsx`);
}

function disparar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
