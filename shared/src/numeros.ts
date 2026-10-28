import type { Filtros } from './tipos.js';

export function parseNumero(valor: unknown): number | null {
  if (valor == null) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'boolean') return null;
  if (valor instanceof Date) return null;
  let s = String(valor).trim();
  if (!s || s === '-' || s === '–' || s === '—') return null;
  s = s.replace(/\s/g, '').replace(/r\$/gi, '').replace(/%/g, '');
  if (!s) return null;
  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');
  if (temVirgula && temPonto) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (temVirgula) {
    s = s.replace(',', '.');
  }
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseData(valor: unknown): string | null {
  if (valor == null || valor === '') return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return isoLocal(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  }
  if (typeof valor === 'number' && valor > 20000 && valor < 80000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000);
    return utc.toISOString().slice(0, 10);
  }
  const s = String(valor).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return isoLocal(Number(br[3]), Number(br[2]), Number(br[1]));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function isoLocal(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Média dos prazos. "A vista" e "À vista" valem 0. "30/60/90" vale 60. */
export function prazoMedioCondicao(condicao: string): number {
  const n = semAcentoSimples(condicao).toLowerCase().trim();
  if (!n || n.includes('vista')) return 0;
  const partes = n.split(/[/|+,;]/).map((p) => p.trim()).filter(Boolean);
  const dias = partes
    .map((p) => {
      const m = p.match(/(\d+(?:[.,]\d+)?)/);
      return m ? Number(m[1].replace(',', '.')) : Number.NaN;
    })
    .filter((x) => Number.isFinite(x));
  if (!dias.length) return 0;
  return dias.reduce((a, b) => a + b, 0) / dias.length;
}

function semAcentoSimples(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function soma(nums: Array<number | null | undefined>): number {
  return nums.reduce<number>((a, b) => a + (typeof b === 'number' && Number.isFinite(b) ? b : 0), 0);
}

export function mediana(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const meio = Math.floor(a.length / 2);
  return a.length % 2 ? a[meio] : (a[meio - 1] + a[meio]) / 2;
}

export function diasInclusivos(inicio: string, fim: string): number {
  const a = dataLocal(inicio);
  const b = dataLocal(fim);
  if (!a || !b || b < a) return 1;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function fimDoMes(iso: string): string {
  const [ano, mes] = iso.split('-').map(Number);
  const dt = new Date(ano, mes, 0);
  return isoLocal(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function inicioDoMes(iso: string): string {
  const [ano, mes] = iso.split('-');
  return `${ano}-${mes}-01`;
}

export function diasNoMes(iso: string): number {
  const [ano, mes] = iso.split('-').map(Number);
  return new Date(ano, mes, 0).getDate();
}

export function dataLocal(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function diffDias(inicio: string, fim: string): number {
  const a = dataLocal(inicio);
  const b = dataLocal(fim);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function inicioSemana(iso: string): string {
  const dt = dataLocal(iso);
  if (!dt) return iso;
  const dia = dt.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  dt.setDate(dt.getDate() + diff);
  return isoLocal(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function diaSemanaIndice(iso: string): number {
  const dt = dataLocal(iso);
  if (!dt) return 0;
  return (dt.getDay() + 6) % 7;
}

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

export type RelacaoPeriodo = 'separado' | 'sobrepoe' | 'contem' | 'contido';

export function relacaoPeriodos(
  a: { inicio: string; fim: string },
  b: { inicio: string; fim: string },
): RelacaoPeriodo {
  if (a.fim < b.inicio || b.fim < a.inicio) return 'separado';
  const aContemB = a.inicio <= b.inicio && a.fim >= b.fim;
  const bContemA = b.inicio <= a.inicio && b.fim >= a.fim;
  if (aContemB && bContemA) return 'sobrepoe';
  if (bContemA) return 'contido';
  if (aContemB) return 'contem';
  return 'sobrepoe';
}

export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatNum(valor: number, casas = 0): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatPct(valor: number, casas = 1): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function formatData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function quaseIgual(a: number, b: number): boolean {
  const tol = Math.max(0.05, Math.abs(b) * 0.001);
  return Math.abs(a - b) <= tol;
}

export const filtrosVazios: Filtros = {
  vendedor: null,
  cliente: null,
  categoria: null,
  representada: null,
  situacao: null,
  condicao: null,
  produto: null,
};
