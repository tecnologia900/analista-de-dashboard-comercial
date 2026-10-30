import { RELATORIOS, formatData } from '@dash/shared';
import type { TipoRelatorio } from '@dash/shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { abrirHistorico, abrirPastaHistorico, apagarHistorico, listarHistorico, salvarHistorico } from './api';
import type { ItemHistorico } from './api';
import { usePainel } from './store';

const ROTULOS: Record<TipoRelatorio, string> = {
  vendas: 'Vendas',
  carteira: 'Carteira',
  ranking: 'Ranking',
  estoque: 'Estoque',
  produtos: 'Produtos',
};

function hojeLocal(): string {
  const data = new Date();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function horaLocal(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function SalvarAnalise({ completo = false }: { completo?: boolean }) {
  const relatorios = usePainel((s) => s.relatorios);
  const algum = Object.values(relatorios).some(Boolean);
  const [dia, setDia] = useState(hojeLocal);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!algum) return null;

  async function salvar() {
    setOcupado(true);
    setMensagem(null);
    setErro(null);
    const json = await salvarHistorico(dia, usePainel.getState().relatorios);
    setOcupado(false);
    if (!json.ok) {
      setErro(json.mensagem ?? 'Não consegui salvar a análise.');
      return;
    }
    const quando = formatData(dia);
    setMensagem(
      json.substituiu
        ? `A análise de ${quando} foi atualizada neste computador.`
        : `Análise de ${quando} salva neste computador. Dá para abrir de novo pela tela inicial.`,
    );
    window.dispatchEvent(new Event('historico-atualizado'));
  }

  return (
    <section className={completo ? 'card mt-6 p-4' : 'mt-3 flex flex-wrap items-end gap-3'}>
      {completo && (
        <div>
          <h2 className="font-semibold">Salvar no histórico</h2>
          <p className="mt-1 text-sm text-muted">
            Grava o que já foi lido, com o dia desta análise, numa pasta deste computador. Na próxima vez, abra esse dia sem enviar as planilhas de novo.
            Salvar outra vez no mesmo dia atualiza aquele registro.
          </p>
        </div>
      )}
      <div className={completo ? 'mt-3 flex flex-wrap items-end gap-3' : 'contents'}>
        <label className="text-sm">
          <span className="text-muted">Dia da análise</span>
          <input
            type="date"
            className="campo mt-1"
            style={{ width: '11.5rem' }}
            min="2000-01-01"
            max="2100-12-31"
            value={dia}
            onChange={(e) => {
              setDia(e.target.value);
              setMensagem(null);
              setErro(null);
            }}
          />
        </label>
        <button type="button" className="btn" disabled={ocupado || !dia} onClick={() => void salvar()}>
          {ocupado ? 'Salvando…' : 'Salvar no histórico'}
        </button>
      </div>
      {mensagem && <p className={completo ? 'ok mt-3' : 'ok'}>{mensagem}</p>}
      {erro && <p className={completo ? 'erro mt-3' : 'erro'}>{erro}</p>}
    </section>
  );
}

export function Historico() {
  const navigate = useNavigate();
  const substituir = usePainel((s) => s.substituir);
  const limparFiltros = usePainel((s) => s.limparFiltros);
  const [itens, setItens] = useState<ItemHistorico[]>([]);
  const [pasta, setPasta] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);

  async function carregar() {
    try {
      const json = await listarHistorico();
      if (!json.ok) {
        setErro(json.mensagem ?? 'Não consegui ler o histórico.');
        return;
      }
      setErro(null);
      setItens(json.itens ?? []);
      setPasta(json.pasta ?? '');
    } catch {
      setErro('Não consegui ler o histórico neste computador.');
    } finally {
      setCarregado(true);
    }
  }

  useEffect(() => {
    void carregar();
    const atualizar = () => void carregar();
    window.addEventListener('historico-atualizado', atualizar);
    return () => window.removeEventListener('historico-atualizado', atualizar);
  }, []);

  useEffect(() => {
    if (window.location.hash !== '#historico') return;
    document.getElementById('historico')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [itens]);

  async function abrir(dia: string) {
    setOcupado(dia);
    setErro(null);
    const json = await abrirHistorico(dia);
    setOcupado(null);
    if (!json.ok || !json.relatorios) {
      setErro(json.mensagem ?? 'Não consegui abrir essa análise.');
      return;
    }
    substituir(json.relatorios);
    limparFiltros();
    navigate('/executivo');
  }

  async function apagar(dia: string) {
    const quando = formatData(dia);
    if (!window.confirm(`Apagar a análise de ${quando}? O arquivo sai deste computador.`)) return;
    setOcupado(dia);
    const json = await apagarHistorico(dia);
    setOcupado(null);
    if (!json.ok) {
      setErro(json.mensagem ?? 'Não consegui apagar essa análise.');
      return;
    }
    setItens((atual) => atual.filter((item) => item.dia !== dia));
  }

  return (
    <section id="historico" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Histórico</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Análises salvas neste computador. Abra um dia para ver o painel sem enviar as planilhas outra vez.
          </p>
        </div>
        {pasta && (
          <button type="button" className="btn-sec" onClick={() => void abrirPastaHistorico()}>
            Abrir pasta
          </button>
        )}
      </div>
      {pasta && <p className="mt-2 break-all text-xs text-muted">{pasta}</p>}
      {erro && <p className="erro mt-3">{erro}</p>}
      {!carregado && <p className="mt-4 text-sm text-muted">Carregando histórico…</p>}
      {carregado && !itens.length && !erro && (
        <p className="mt-4 text-sm text-muted">Nenhuma análise salva ainda. Depois de enviar as planilhas, use Salvar no histórico.</p>
      )}
      <div className="mt-4 space-y-3">
        {itens.map((item) => (
          <article key={item.dia} className="card flex flex-wrap items-start justify-between gap-4 p-4">
            <div className="min-w-[16rem] flex-1">
              <h3 className="text-lg font-semibold">{formatData(item.dia)}</h3>
              <p className="text-sm text-muted">Atualizada às {horaLocal(item.atualizadoEm)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.arquivos.map((tipo) => (
                  <span key={tipo} className="chip">
                    {ROTULOS[tipo] ?? RELATORIOS[tipo].titulo}
                  </span>
                ))}
              </div>
              {item.resumo && <p className="mt-2 text-sm text-muted">{item.resumo}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn" disabled={ocupado === item.dia} onClick={() => void abrir(item.dia)}>
                {ocupado === item.dia ? 'Abrindo…' : 'Abrir'}
              </button>
              <button type="button" className="btn-sec" disabled={ocupado === item.dia} onClick={() => void apagar(item.dia)}>
                Apagar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
