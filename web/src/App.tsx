import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { usePainel } from './store';
import type { Pacote } from './store';
import { Carteira } from './paginas/Carteira';
import { Executivo } from './paginas/Executivo';
import { Giro } from './paginas/Giro';
import { Home } from './paginas/Home';
import { Upload } from './paginas/Upload';
import { Vendas } from './paginas/Vendas';
import { Vendedores } from './paginas/Vendedores';

export function App() {
  const tema = usePainel((s) => s.tema);
  const pronto = usePainel((s) => s.pronto);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await usePainel.persist.rehydrate();
      } catch {
        /* sessionStorage pode estar bloqueado */
      }
      document.documentElement.classList.toggle('dark', usePainel.getState().tema === 'escuro');
      try {
        const resposta = await fetch('/api/sessao/dados');
        if (resposta.ok) {
          const json = (await resposta.json()) as { relatorios?: Record<string, unknown> };
          const qtd = json.relatorios ? Object.values(json.relatorios).filter(Boolean).length : 0;
          if (vivo && qtd > 0 && json.relatorios) {
            usePainel.getState().substituir(json.relatorios as unknown as Pacote);
          }
        }
      } catch {
        /* sem servidor, a tela reabre com o sessionStorage */
      }
      if (vivo) usePainel.getState().marcarPronto();
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
  }, [tema]);

  if (!pronto) {
    return <div className="grid min-h-screen place-items-center text-muted">Abrindo a sessão…</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/carregar/:objetivo" element={<Upload />} />
        <Route path="/giro" element={<Giro />} />
        <Route path="/carteira" element={<Carteira />} />
        <Route path="/vendedores" element={<Vendedores />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/executivo" element={<Executivo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
