import { filtrosVazios } from '@dash/shared';
import type {
  Filtros,
  Relatorio,
  RelatorioCarteira,
  RelatorioEstoque,
  RelatorioProdutos,
  RelatorioRanking,
  RelatorioVendas,
  TipoRelatorio,
} from '@dash/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Tema = 'claro' | 'escuro';

export interface Pacote {
  vendas: RelatorioVendas | null;
  carteira: RelatorioCarteira | null;
  ranking: RelatorioRanking | null;
  estoque: RelatorioEstoque | null;
  produtos: RelatorioProdutos | null;
}

interface Estado {
  tema: Tema;
  coberturaMax: number;
  pronto: boolean;
  filtros: Filtros;
  relatorios: Pacote;
  definirTema: (tema: Tema) => void;
  definirCobertura: (dias: number) => void;
  setFiltro: (chave: keyof Filtros, valor: string | null) => void;
  limparFiltros: () => void;
  salvar: (relatorio: Relatorio) => void;
  remover: (tipo: TipoRelatorio) => void;
  limpar: () => void;
  substituir: (relatorios: Pacote) => void;
  marcarPronto: () => void;
}

const pacoteVazio = (): Pacote => ({
  vendas: null,
  carteira: null,
  ranking: null,
  estoque: null,
  produtos: null,
});

export const usePainel = create<Estado>()(
  persist(
    (set) => ({
      tema: 'claro',
      coberturaMax: 15,
      pronto: false,
      filtros: { ...filtrosVazios },
      relatorios: pacoteVazio(),
      definirTema: (tema) => set({ tema }),
      definirCobertura: (coberturaMax) => set({ coberturaMax }),
      setFiltro: (chave, valor) => set((estado) => ({ filtros: { ...estado.filtros, [chave]: valor } })),
      limparFiltros: () => set({ filtros: { ...filtrosVazios } }),
      salvar: (relatorio) =>
        set((estado) => ({ relatorios: { ...estado.relatorios, [relatorio.tipo]: relatorio } })),
      remover: (tipo) => set((estado) => ({ relatorios: { ...estado.relatorios, [tipo]: null } })),
      limpar: () => set({ relatorios: pacoteVazio(), filtros: { ...filtrosVazios } }),
      substituir: (relatorios) => set({ relatorios }),
      marcarPronto: () => set({ pronto: true }),
    }),
    {
      name: 'painel-gerente',
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (estado) => ({
        tema: estado.tema,
        coberturaMax: estado.coberturaMax,
        relatorios: estado.relatorios,
      }),
    },
  ),
);

export function alternarFiltro(chave: keyof Filtros, valor: string) {
  const atual = usePainel.getState().filtros[chave];
  const mesmo = atual != null && atual.localeCompare(valor, 'pt-BR', { sensitivity: 'accent' }) === 0;
  usePainel.getState().setFiltro(chave, mesmo ? null : valor);
}
