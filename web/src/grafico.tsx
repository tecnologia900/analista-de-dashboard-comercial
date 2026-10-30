import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';

export function Grafico({
  option,
  altura = 320,
  aoClicar,
}: {
  option: EChartsOption;
  altura?: number;
  aoClicar?: (nome: string) => void;
}) {
  return (
    <ReactECharts
      option={option}
      style={{ height: altura, width: '100%' }}
      notMerge
      opts={{ renderer: 'canvas' }}
      onEvents={
        aoClicar
          ? {
              click: (params: { name?: string; seriesName?: string; seriesType?: string; data?: { name?: string } }) => {
                const nome = params.seriesType === 'line' ? params.seriesName : params.name || params.data?.name;
                if (nome && nome !== 'Outros') aoClicar(nome);
              },
            }
          : undefined
      }
    />
  );
}

export interface Cores {
  ink: string;
  muted: string;
  line: string;
  good: string;
  bad: string;
  warn: string;
  accent: string;
  blue: string;
  series: string[];
}

export function paleta(escuro: boolean): Cores {
  return escuro
    ? {
        ink: '#e6edf5',
        muted: '#93a1b3',
        line: '#2a3848',
        good: '#3dbe86',
        bad: '#f07167',
        warn: '#e2b340',
        accent: '#2faf90',
        blue: '#8eb6e0',
        series: ['#8eb6e0', '#2faf90', '#e2b340', '#d08a6a', '#7f9a78', '#c47b7b'],
      }
    : {
        ink: '#172033',
        muted: '#5c6b7c',
        line: '#d5ddd8',
        good: '#0d7a45',
        bad: '#b42318',
        warn: '#8a5a00',
        accent: '#0f6e56',
        blue: '#1d4e89',
        series: ['#1d4e89', '#0f6e56', '#8a5a00', '#8c4a32', '#3f6b4e', '#8d4d4d'],
      };
}

function moeda(valor: number): string {
  const centavos = Math.round((valor + Number.EPSILON) * 100) / 100;
  return centavos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function moedaEscala(valor: number): string {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1000) return `R$ ${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return moeda(valor);
}

function rotuloEixo(formato: (n: number) => string, valor: number): string {
  const cheio = formato(valor);
  if (cheio.includes('%') || cheio.endsWith(' d')) return cheio;
  const abs = Math.abs(valor);
  const moeda = cheio.includes('R$');
  const prefixo = moeda ? 'R$\u00a0' : '';
  if (abs >= 1_000_000) {
    return `${prefixo}${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  if (abs >= 1000 && (moeda || abs >= 10_000)) {
    return `${prefixo}${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: abs >= 10_000 ? 0 : 1 })} mil`;
  }
  return cheio;
}

function dica(escuro: boolean) {
  const c = paleta(escuro);
  return {
    backgroundColor: escuro ? '#17202b' : '#fbfbf9',
    borderColor: c.line,
    textStyle: { color: c.ink, fontSize: 12 },
  };
}

export function corAtingimento(valor: number | null, escuro: boolean): string {
  const c = paleta(escuro);
  if (valor == null) return c.muted;
  if (valor >= 100) return c.good;
  if (valor >= 70) return c.warn;
  return c.bad;
}

export function opcaoBarrasH(
  escuro: boolean,
  categorias: string[],
  valores: number[],
  formato: (n: number) => string,
  opcoes?: { cores?: string[]; destaque?: string | null },
): EChartsOption {
  const c = paleta(escuro);
  const cats = [...categorias].reverse();
  const vals = [...valores].reverse();
  const cores = opcoes?.cores ? [...opcoes.cores].reverse() : undefined;
  return {
    backgroundColor: 'transparent',
    tooltip: { ...dica(escuro), trigger: 'axis', valueFormatter: (v) => formato(Number(v)) },
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: c.muted, hideOverlap: true, formatter: (v: number) => rotuloEixo(formato, v) },
      splitLine: { lineStyle: { color: c.line } },
    },
    yAxis: {
      type: 'category',
      data: cats,
      axisLabel: { color: c.ink, width: 160, overflow: 'truncate' },
      axisLine: { lineStyle: { color: c.line } },
    },
    series: [
      {
        type: 'bar',
        cursor: 'pointer',
        barMaxWidth: 18,
        data: vals.map((valor, i) => ({
          value: valor,
          itemStyle: {
            color: cores?.[i] ?? c.blue,
            opacity: opcoes?.destaque && cats[i] !== opcoes.destaque ? 0.35 : 1,
            borderRadius: [0, 4, 4, 0],
          },
        })),
      },
    ],
  };
}

export function opcaoBarrasGrupo(
  escuro: boolean,
  categorias: string[],
  series: { nome: string; dados: number[] }[],
  formato: (n: number) => string,
): EChartsOption {
  const c = paleta(escuro);
  return {
    backgroundColor: 'transparent',
    tooltip: { ...dica(escuro), trigger: 'axis', valueFormatter: (v) => formato(Number(v)) },
    legend: { textStyle: { color: c.muted }, top: 0 },
    grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: categorias,
      axisLabel: { color: c.ink, interval: 0, rotate: categorias.length > 4 ? 24 : 0, width: 90, overflow: 'truncate' },
      axisLine: { lineStyle: { color: c.line } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: c.muted, hideOverlap: true, formatter: (v: number) => rotuloEixo(formato, v) },
      splitLine: { lineStyle: { color: c.line } },
    },
    series: series.map((serie, i) => ({
      name: serie.nome,
      type: 'bar' as const,
      cursor: 'pointer',
      data: serie.dados,
      itemStyle: { color: c.series[i % c.series.length], borderRadius: [3, 3, 0, 0] },
    })),
  };
}

export function opcaoLinhas(
  escuro: boolean,
  categorias: string[],
  series: { nome: string; dados: number[] }[],
  formato: (n: number) => string,
): EChartsOption {
  const c = paleta(escuro);
  return {
    backgroundColor: 'transparent',
    tooltip: { ...dica(escuro), trigger: 'axis', valueFormatter: (v) => formato(Number(v)) },
    legend: { textStyle: { color: c.muted }, type: 'scroll' },
    grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: categorias, axisLabel: { color: c.muted }, axisLine: { lineStyle: { color: c.line } } },
    yAxis: {
      type: 'value',
      axisLabel: { color: c.muted, hideOverlap: true, formatter: (v: number) => rotuloEixo(formato, v) },
      splitLine: { lineStyle: { color: c.line } },
    },
    series: series.map((serie, i) => ({
      name: serie.nome,
      type: 'line' as const,
      smooth: true,
      showSymbol: false,
      cursor: 'pointer',
      data: serie.dados,
      itemStyle: { color: c.series[i % c.series.length] },
    })),
  };
}

export function opcaoDivergente(
  escuro: boolean,
  categorias: string[],
  valores: number[],
  formato: (n: number) => string,
): EChartsOption {
  const c = paleta(escuro);
  const cats = [...categorias].reverse();
  const vals = [...valores].reverse();
  return {
    backgroundColor: 'transparent',
    tooltip: { ...dica(escuro), trigger: 'axis', valueFormatter: (v) => formato(Number(v)) },
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: c.muted, hideOverlap: true, formatter: (v: number) => rotuloEixo(formato, v) },
      splitLine: { lineStyle: { color: c.line } },
    },
    yAxis: {
      type: 'category',
      data: cats,
      axisLabel: { color: c.ink, width: 160, overflow: 'truncate' },
      axisLine: { lineStyle: { color: c.line } },
    },
    series: [
      {
        type: 'bar',
        cursor: 'pointer',
        barMaxWidth: 16,
        data: vals.map((valor) => ({
          value: valor,
          itemStyle: { color: valor >= 0 ? c.good : c.bad, borderRadius: valor >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] },
        })),
      },
    ],
  };
}

export function opcaoPareto(
  escuro: boolean,
  categorias: string[],
  valores: number[],
  acumulado: number[],
  formato: (n: number) => string,
): EChartsOption {
  const c = paleta(escuro);
  return {
    backgroundColor: 'transparent',
    tooltip: { ...dica(escuro), trigger: 'axis' },
    legend: { textStyle: { color: c.muted } },
    grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: categorias,
      axisLabel: { color: c.ink, interval: 0, rotate: 28, width: 80, overflow: 'truncate' },
    },
    yAxis: [
      { type: 'value', axisLabel: { color: c.muted, hideOverlap: true, formatter: (v: number) => rotuloEixo(formato, v) }, splitLine: { lineStyle: { color: c.line } } },
      { type: 'value', min: 0, max: 100, axisLabel: { color: c.muted, formatter: '{value}%' }, splitLine: { show: false } },
    ],
    series: [
      { name: 'Valor', type: 'bar', data: valores, itemStyle: { color: c.blue, borderRadius: [3, 3, 0, 0] }, cursor: 'pointer' },
      { name: 'Acumulado', type: 'line', yAxisIndex: 1, data: acumulado, itemStyle: { color: c.warn }, showSymbol: false },
    ],
  };
}

export function opcaoDonut(
  escuro: boolean,
  itens: { nome: string; valor: number; cor?: string }[],
  formato: (n: number) => string,
  destaque?: string | null,
  centro?: { valor: string; legenda: string } | null,
): EChartsOption {
  const c = paleta(escuro);
  const muitos = itens.length > 6;
  const centroPizza = muitos ? ['34%', '50%'] : ['50%', '46%'];
  const margem = { top: 8, bottom: muitos ? 8 : 36, right: muitos ? 148 : 0 };
  return {
    backgroundColor: 'transparent',
    tooltip: {
      ...dica(escuro),
      trigger: 'item',
      formatter: (p: unknown) => {
        const item = p as { name?: string; value?: number; percent?: number };
        const pct = item.percent == null ? '' : `${item.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
        return `${item.name ?? ''}<br/>${formato(Number(item.value))}${pct ? `<br/>${pct}` : ''}`;
      },
    },
    legend: muitos
      ? {
          type: 'scroll',
          orient: 'vertical',
          right: 0,
          top: 8,
          bottom: 8,
          textStyle: { color: c.muted, fontSize: 11, width: 128, overflow: 'truncate' },
          pageIconColor: c.ink,
          pageTextStyle: { color: c.muted },
        }
      : {
          type: 'scroll',
          bottom: 0,
          left: 8,
          right: 8,
          textStyle: { color: c.muted, fontSize: 11 },
          pageIconColor: c.ink,
          pageTextStyle: { color: c.muted },
        },
    series: [
      {
        type: 'pie',
        radius: muitos ? ['46%', '72%'] : ['46%', '68%'],
        center: centroPizza,
        ...margem,
        cursor: 'pointer',
        avoidLabelOverlap: true,
        data: itens.map((item, i) => ({
          name: item.nome,
          value: item.valor,
          itemStyle: {
            color: item.cor ?? c.series[i % c.series.length],
            opacity: destaque && item.nome !== destaque ? 0.35 : 1,
          },
        })),
        label: { show: !muitos, color: c.ink, formatter: '{b}\n{d}%' },
        labelLine: { show: !muitos, length: 8, length2: 6 },
      },
      ...(centro
        ? [
            {
              type: 'pie' as const,
              radius: ['0%', '42%'],
              center: centroPizza,
              ...margem,
              silent: true,
              animation: false,
              tooltip: { show: false },
              labelLine: { show: false },
              label: {
                show: true,
                position: 'center' as const,
                formatter: `{valor|${centro.valor}}\n{legenda|${centro.legenda}}`,
                rich: {
                  valor: { fontSize: 26, fontWeight: 700, color: c.ink, lineHeight: 30, align: 'center' as const, fontFamily: 'Segoe UI, sans-serif' },
                  legenda: { fontSize: 12, color: c.muted, lineHeight: 16, align: 'center' as const, fontFamily: 'Segoe UI, sans-serif' },
                },
              },
              data: [{ value: 1, name: '', itemStyle: { color: 'transparent' } }],
            },
          ]
        : []),
    ],
  };
}

const DIAS_CALOR = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function opcaoCalor(escuro: boolean, semanas: string[], dados: [number, number, number][]): EChartsOption {
  const c = paleta(escuro);
  const max = Math.max(1, ...dados.map((d) => d[2]));
  return {
    backgroundColor: 'transparent',
    tooltip: {
      ...dica(escuro),
      position: 'top',
      formatter: (p: unknown) => {
        const item = p as { name?: string; value?: number | [number, number, number] };
        if (!Array.isArray(item.value)) return `${item.name ?? ''}<br/>${moeda(Number(item.value))}`;
        const [coluna, linha, valor] = item.value;
        const semana = semanas[coluna] ?? '';
        const dia = DIAS_CALOR[linha] ?? '';
        return `${dia}${semana ? ` · ${semana}` : ''}<br/>${moeda(valor)}`;
      },
    },
    grid: { left: 40, right: 16, top: 8, bottom: 78, containLabel: false },
    xAxis: { type: 'category', data: semanas, axisLabel: { color: c.muted, hideOverlap: true, margin: 10 }, splitArea: { show: true } },
    yAxis: {
      type: 'category',
      data: DIAS_CALOR,
      axisLabel: { color: c.ink, margin: 8 },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemWidth: 10,
      itemHeight: 120,
      text: [moedaEscala(max), 'R$ 0'],
      textGap: 8,
      textStyle: { color: c.muted, fontSize: 11 },
      inRange: { color: escuro ? ['#1a2836', '#1d4e89', '#2faf90'] : ['#e7eef2', '#8eb0cf', '#0f6e56'] },
    },
    series: [{ type: 'heatmap', data: dados, label: { show: false } }],
  };
}

export function opcaoDispersao(
  escuro: boolean,
  pontos: { nome: string; x: number; y: number; tamanho: number }[],
  destaque?: string | null,
): EChartsOption {
  const c = paleta(escuro);
  const max = Math.max(1, ...pontos.map((p) => p.tamanho));
  return {
    backgroundColor: 'transparent',
    tooltip: {
      ...dica(escuro),
      trigger: 'item',
      formatter: (p: unknown) => {
        const item = p as { name?: string; value?: number[] };
        const valor = item.value ?? [];
        return `${item.name}<br/>Clientes: ${valor[0]}<br/>Ticket: ${Number(valor[1]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
      },
    },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: { name: 'Clientes positivados', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: c.muted }, axisLabel: { color: c.muted }, splitLine: { lineStyle: { color: c.line } } },
    yAxis: { name: 'Ticket médio', nameTextStyle: { color: c.muted }, axisLabel: { color: c.muted }, splitLine: { lineStyle: { color: c.line } } },
    series: [
      {
        type: 'scatter',
        cursor: 'pointer',
        data: pontos.map((ponto) => ({
          name: ponto.nome,
          value: [ponto.x, ponto.y],
          symbolSize: 12 + (ponto.tamanho / max) * 28,
          itemStyle: { color: c.accent, opacity: destaque && ponto.nome !== destaque ? 0.35 : 0.9 },
        })),
      },
    ],
  };
}

export function opcaoTreemap(escuro: boolean, itens: { nome: string; valor: number }[], destaque?: string | null): EChartsOption {
  const c = paleta(escuro);
  return {
    backgroundColor: 'transparent',
    tooltip: { ...dica(escuro), valueFormatter: (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    series: [
      {
        type: 'treemap',
        roam: false,
        breadcrumb: { show: false },
        cursor: 'pointer',
        label: { color: '#fbfbf9' },
        data: itens.map((item, i) => ({
          name: item.nome,
          value: item.valor,
          itemStyle: { color: c.series[i % c.series.length], opacity: destaque && item.nome !== destaque ? 0.45 : 1 },
        })),
      },
    ],
  };
}
