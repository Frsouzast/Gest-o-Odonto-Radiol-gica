import { useState, useEffect, useCallback } from "react";
import {
  Wallet, LayoutGrid, ArrowDownCircle, ArrowUpCircle, Building2, FileWarning,
  ScrollText, TrendingUp as TrendingUpIcon, Plus, Trash2, ChevronLeft, ChevronRight, Loader2,
  PackageCheck, Landmark,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const brl = (n) => (isFinite(n) ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
const pct = (n) => (isFinite(n) ? `${(Number(n) * 100).toFixed(1)}%` : "—");
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);

function Input({ value, onChange, type = "text", placeholder, className = "", disabled }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
      className={`w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--accent-text)] outline-none text-sm rounded-md px-2.5 py-1.5 disabled:opacity-50 ${className}`}
    />
  );
}

function Select({ value, onChange, children, className = "", disabled }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--accent-text)] outline-none text-sm rounded-md px-2.5 py-1.5 disabled:opacity-50 ${className}`}
    >
      {children}
    </select>
  );
}

function Botao({ onClick, children, variante = "primario", disabled, className = "" }) {
  const estilos = {
    primario: "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white",
    fantasma: "text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 text-xs rounded-md px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${estilos[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

function Cartao({ titulo, valor, cor, sub }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5">
      <div className="text-[11px] text-[var(--text-faint)] mb-1">{titulo}</div>
      <div className={`text-xl font-semibold font-mono tabular-nums ${cor || "text-[var(--text)]"}`}>{valor}</div>
      {sub && <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{sub}</div>}
    </div>
  );
}

const STATUS_RECEBER = {
  aberto: { label: "Em aberto", cor: "bg-[var(--bg-alt-strong)] text-[var(--text-secondary)]" },
  recebido: { label: "Recebido", cor: "bg-[var(--accent-soft-bg-strong)] text-[var(--accent-text)]" },
  vencido: { label: "Vencido", cor: "bg-[var(--danger-bg-strong)] text-[var(--danger)]" },
  parcial: { label: "Parcial", cor: "bg-[var(--warning-bg-strong)] text-[var(--warning)]" },
  cancelado: { label: "Cancelado", cor: "bg-[var(--bg-alt-strong)] text-[var(--text-faint)]" },
};
const STATUS_PAGAR = {
  aberto: { label: "Em aberto", cor: "bg-[var(--bg-alt-strong)] text-[var(--text-secondary)]" },
  pago: { label: "Pago", cor: "bg-[var(--accent-soft-bg-strong)] text-[var(--accent-text)]" },
  vencido: { label: "Vencido", cor: "bg-[var(--danger-bg-strong)] text-[var(--danger)]" },
  cancelado: { label: "Cancelado", cor: "bg-[var(--bg-alt-strong)] text-[var(--text-faint)]" },
};
const STATUS_GLOSA = {
  glosada: { label: "Glosada", cor: "bg-[var(--danger-bg-strong)] text-[var(--danger)]" },
  em_recurso: { label: "Em recurso", cor: "bg-[var(--warning-bg-strong)] text-[var(--warning)]" },
  recuperada: { label: "Recuperada", cor: "bg-[var(--accent-soft-bg-strong)] text-[var(--accent-text)]" },
  perdida: { label: "Perdida", cor: "bg-[var(--bg-alt-strong)] text-[var(--text-faint)]" },
};

export default function FinanceiroModule({ api, somenteLeitura, avisar, procedimentos, insumos }) {
  const [secao, setSecao] = useState("dashboard");
  const [mes, setMes] = useState(mesAtual());

  const secoes = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "receber", label: "Contas a receber", icon: ArrowDownCircle },
    { id: "pagar", label: "Contas a pagar", icon: ArrowUpCircle },
    { id: "convenios", label: "Convênios", icon: Building2 },
    { id: "lotes", label: "Lotes de faturamento", icon: PackageCheck },
    { id: "glosas", label: "Glosas", icon: FileWarning },
    { id: "conciliacao", label: "Conciliação bancária", icon: Landmark },
    { id: "dre", label: "DRE gerencial", icon: ScrollText },
    { id: "rentabilidade", label: "Rentabilidade", icon: TrendingUpIcon },
  ];

  const mudarMes = (delta) => {
    const [a, m] = mes.split("-").map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6">
      <div>
        <div className="flex items-center gap-1.5 mb-4 text-[var(--accent-text)]">
          <Wallet size={16} />
          <span className="text-sm font-medium">Financeiro</span>
        </div>
        <div className="space-y-0.5">
          {secoes.map((s) => {
            const Icon = s.icon;
            const ativo = secao === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSecao(s.id)}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  ativo ? "bg-[var(--accent-soft-bg)] text-[var(--accent-text)] font-medium" : "text-[var(--text-secondary)] hover:bg-[var(--bg-alt-strong)]"
                }`}
              >
                <Icon size={14} /> {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {["dashboard", "receber", "pagar", "dre", "rentabilidade", "conciliacao"].includes(secao) && (
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => mudarMes(-1)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
              <ChevronLeft size={16} />
            </button>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="border border-[var(--border)] rounded-md px-2.5 py-1 text-sm bg-[var(--surface)]"
            />
            <button onClick={() => mudarMes(1)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {secao === "dashboard" && <PainelDashboard api={api} mes={mes} avisar={avisar} />}
        {secao === "receber" && <PainelContasReceber api={api} mes={mes} avisar={avisar} somenteLeitura={somenteLeitura} procedimentos={procedimentos} />}
        {secao === "pagar" && <PainelContasPagar api={api} mes={mes} avisar={avisar} somenteLeitura={somenteLeitura} />}
        {secao === "convenios" && <PainelConvenios api={api} avisar={avisar} somenteLeitura={somenteLeitura} procedimentos={procedimentos} />}
        {secao === "lotes" && <PainelLotes api={api} avisar={avisar} somenteLeitura={somenteLeitura} />}
        {secao === "glosas" && <PainelGlosas api={api} avisar={avisar} somenteLeitura={somenteLeitura} />}
        {secao === "conciliacao" && <PainelConciliacao api={api} mes={mes} avisar={avisar} somenteLeitura={somenteLeitura} />}
        {secao === "dre" && <PainelDRE api={api} mes={mes} avisar={avisar} />}
        {secao === "rentabilidade" && <PainelRentabilidade api={api} mes={mes} avisar={avisar} />}
      </div>
    </div>
  );
}

// ---------------- Dashboard ----------------
function PainelDashboard({ api, mes, avisar }) {
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api(`/financeiro/resumo?mes=${mes}`)
      .then(setResumo)
      .catch(avisar)
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  if (carregando) return <Loader2 className="animate-spin text-[var(--accent-text)]" size={18} />;
  if (!resumo) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Cartao titulo="Receitas do mês" valor={brl(resumo.receitas)} cor="text-[var(--accent-text)]" />
        <Cartao titulo="Despesas pagas" valor={brl(resumo.despesas)} />
        <Cartao titulo="Resultado" valor={brl(resumo.resultado)} cor={resumo.resultado >= 0 ? "text-[var(--accent-text)]" : "text-[var(--danger)]"} />
        <Cartao titulo="A receber" valor={brl(resumo.aReceber)} />
        <Cartao titulo="A pagar" valor={brl(resumo.aPagar)} />
        <Cartao titulo="Inadimplência" valor={brl(resumo.inadimplencia)} cor={resumo.inadimplencia > 0 ? "text-[var(--danger)]" : undefined} />
      </div>

      {resumo.receitaPorOrigem.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Receita por origem</h3>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resumo.receitaPorOrigem} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <YAxis type="category" dataKey="origem" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => brl(v)} />
                <Bar dataKey="valor" fill="#0f766e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Contas a Receber ----------------
function PainelContasReceber({ api, mes, avisar, somenteLeitura, procedimentos }) {
  const [lista, setLista] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [novo, setNovo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    setCarregando(true);
    Promise.all([api(`/contas-receber?mes=${mes}`), api("/convenios")])
      .then(([l, c]) => { setLista(l); setConvenios(c); })
      .catch(avisar)
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);
  useEffect(carregar, [carregar]);

  const criar = async () => {
    try {
      await api("/contas-receber", { method: "POST", body: JSON.stringify(novo) });
      setNovo(null);
      carregar();
    } catch (e) {
      avisar(e);
    }
  };

  const marcarRecebido = async (id, valorFaturado) => {
    try {
      await api(`/contas-receber/${id}`, { method: "PUT", body: JSON.stringify({ status: "recebido", valorPago: valorFaturado, dataRecebimento: hoje() }) });
      carregar();
    } catch (e) {
      avisar(e);
    }
  };

  const excluir = async (id) => {
    try {
      await api(`/contas-receber/${id}`, { method: "DELETE" });
      carregar();
    } catch (e) {
      avisar(e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!novo && (
          <Botao onClick={() => setNovo({ pacienteNome: "", procedimentoId: "", convenioId: "", dataExame: hoje(), vencimento: hoje(), valorFaturado: "" })}>
            <Plus size={13} /> Novo lançamento
          </Botao>
        )}
      </div>

      {novo && (
        <div className="bg-[var(--surface)] border border-[var(--accent-soft-border)] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end">
          <div className="col-span-2">
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Paciente</label>
            <Input value={novo.pacienteNome} onChange={(v) => setNovo((n) => ({ ...n, pacienteNome: v }))} />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Procedimento</label>
            <Select value={novo.procedimentoId} onChange={(v) => setNovo((n) => ({ ...n, procedimentoId: v }))}>
              <option value="">—</option>
              {procedimentos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Convênio</label>
            <Select value={novo.convenioId} onChange={(v) => setNovo((n) => ({ ...n, convenioId: v, valorFaturado: "" }))}>
              <option value="">Particular</option>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Data do exame</label>
            <Input type="date" value={novo.dataExame} onChange={(v) => setNovo((n) => ({ ...n, dataExame: v }))} />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Valor {novo.convenioId && "(vazio = usar tabela)"}</label>
            <Input type="number" value={novo.valorFaturado} onChange={(v) => setNovo((n) => ({ ...n, valorFaturado: v }))} placeholder={novo.convenioId ? "auto" : "0"} />
          </div>
          <div className="col-span-2 sm:col-span-6 flex gap-2 justify-end pt-1">
            <Botao variante="fantasma" onClick={() => setNovo(null)}>cancelar</Botao>
            <Botao onClick={criar} disabled={!novo.pacienteNome || !novo.dataExame}>salvar</Botao>
          </div>
        </div>
      )}

      {carregando ? (
        <Loader2 className="animate-spin text-[var(--accent-text)]" size={18} />
      ) : lista.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)] text-center py-8">Nenhum lançamento neste mês.</p>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border-subtle)]">
          {lista.map((l) => {
            const st = STATUS_RECEBER[l.status] || STATUS_RECEBER.aberto;
            return (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text)] truncate">{l.paciente_nome || "—"}</div>
                  <div className="text-[11px] text-[var(--text-faint)] truncate">
                    {l.procedimento_nome || "sem procedimento"} · {l.convenio_nome || "Particular"} · {new Date(l.data_exame + "T00:00:00").toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <span className="font-mono text-sm text-[var(--text-secondary)] shrink-0">{brl(l.valor_faturado)}</span>
                <span className={`text-[11px] rounded-full px-2 py-0.5 shrink-0 ${st.cor}`}>{st.label}</span>
                {l.status === "aberto" && !somenteLeitura && (
                  <Botao variante="fantasma" onClick={() => marcarRecebido(l.id, l.valor_faturado)}>receber</Botao>
                )}
                {!somenteLeitura && (
                  <button onClick={() => excluir(l.id)} className="text-[var(--text-faint)] hover:text-[var(--danger)] shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------- Contas a Pagar ----------------
function PainelContasPagar({ api, mes, avisar, somenteLeitura }) {
  const [lista, setLista] = useState([]);
  const [recorrentes, setRecorrentes] = useState([]);
  const [novo, setNovo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    setCarregando(true);
    Promise.all([api(`/contas-pagar?mes=${mes}`), api("/despesas-recorrentes")])
      .then(([l, r]) => { setLista(l); setRecorrentes(r); })
      .catch(avisar)
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);
  useEffect(carregar, [carregar]);

  const criar = async () => {
    try {
      await api("/contas-pagar", { method: "POST", body: JSON.stringify(novo) });
      setNovo(null);
      carregar();
    } catch (e) {
      avisar(e);
    }
  };
  const marcarPago = async (id) => {
    try {
      await api(`/contas-pagar/${id}`, { method: "PUT", body: JSON.stringify({ status: "pago", dataPagamento: hoje() }) });
      carregar();
    } catch (e) {
      avisar(e);
    }
  };
  const excluir = async (id) => {
    try {
      await api(`/contas-pagar/${id}`, { method: "DELETE" });
      carregar();
    } catch (e) {
      avisar(e);
    }
  };
  const gerarRecorrentes = async () => {
    try {
      const r = await api("/despesas-recorrentes/gerar", { method: "POST", body: JSON.stringify({ mes }) });
      avisar(`${r.gerados} lançamento(s) gerado(s) para ${mes}.`);
      carregar();
    } catch (e) {
      avisar(e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-[var(--text-faint)]">{recorrentes.length} despesa(s) recorrente(s) cadastrada(s)</p>
        <div className="flex gap-2">
          {!somenteLeitura && recorrentes.length > 0 && (
            <Botao variante="fantasma" onClick={gerarRecorrentes}>gerar lançamentos do mês</Botao>
          )}
          {!novo && !somenteLeitura && (
            <Botao onClick={() => setNovo({ descricao: "", categoria: "", fornecedor: "", valor: "", vencimento: hoje() })}>
              <Plus size={13} /> Nova conta
            </Botao>
          )}
        </div>
      </div>

      {novo && (
        <div className="bg-[var(--surface)] border border-[var(--accent-soft-border)] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
          <div>
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Descrição</label>
            <Input value={novo.descricao} onChange={(v) => setNovo((n) => ({ ...n, descricao: v }))} />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Categoria</label>
            <Input value={novo.categoria} onChange={(v) => setNovo((n) => ({ ...n, categoria: v }))} placeholder="aluguel, materiais..." />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Fornecedor</label>
            <Input value={novo.fornecedor} onChange={(v) => setNovo((n) => ({ ...n, fornecedor: v }))} />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Valor</label>
            <Input type="number" value={novo.valor} onChange={(v) => setNovo((n) => ({ ...n, valor: v }))} />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-faint)] block mb-1">Vencimento</label>
            <Input type="date" value={novo.vencimento} onChange={(v) => setNovo((n) => ({ ...n, vencimento: v }))} />
          </div>
          <div className="col-span-2 sm:col-span-5 flex gap-2 justify-end pt-1">
            <Botao variante="fantasma" onClick={() => setNovo(null)}>cancelar</Botao>
            <Botao onClick={criar} disabled={!novo.descricao || !novo.valor}>salvar</Botao>
          </div>
        </div>
      )}

      {carregando ? (
        <Loader2 className="animate-spin text-[var(--accent-text)]" size={18} />
      ) : lista.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)] text-center py-8">Nenhuma conta neste mês.</p>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border-subtle)]">
          {lista.map((l) => {
            const st = STATUS_PAGAR[l.status] || STATUS_PAGAR.aberto;
            return (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text)] truncate">{l.descricao}</div>
                  <div className="text-[11px] text-[var(--text-faint)] truncate">
                    {l.categoria || "sem categoria"} · vence {new Date(l.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <span className="font-mono text-sm text-[var(--text-secondary)] shrink-0">{brl(l.valor)}</span>
                <span className={`text-[11px] rounded-full px-2 py-0.5 shrink-0 ${st.cor}`}>{st.label}</span>
                {l.status === "aberto" && !somenteLeitura && <Botao variante="fantasma" onClick={() => marcarPago(l.id)}>pagar</Botao>}
                {!somenteLeitura && (
                  <button onClick={() => excluir(l.id)} className="text-[var(--text-faint)] hover:text-[var(--danger)] shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------- Convênios ----------------
function PainelConvenios({ api, avisar, somenteLeitura, procedimentos }) {
  const [lista, setLista] = useState([]);
  const [novo, setNovo] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [precos, setPrecos] = useState([]);
  const [novoPreco, setNovoPreco] = useState(null);

  const carregar = useCallback(() => {
    api("/convenios").then(setLista).catch(avisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(carregar, [carregar]);

  useEffect(() => {
    if (selecionado) api(`/convenios/${selecionado}/precos`).then(setPrecos).catch(avisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado]);

  const criar = async () => {
    try {
      await api("/convenios", { method: "POST", body: JSON.stringify(novo) });
      setNovo(null);
      carregar();
    } catch (e) {
      avisar(e);
    }
  };
  const excluir = async (id) => {
    try {
      await api(`/convenios/${id}`, { method: "DELETE" });
      if (selecionado === id) setSelecionado(null);
      carregar();
    } catch (e) {
      avisar(e);
    }
  };
  const adicionarPreco = async () => {
    try {
      await api(`/convenios/${selecionado}/precos`, { method: "POST", body: JSON.stringify(novoPreco) });
      setNovoPreco(null);
      const p = await api(`/convenios/${selecionado}/precos`);
      setPrecos(p);
    } catch (e) {
      avisar(e);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-5">
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-[var(--text-secondary)]">Convênios cadastrados</h3>
          {!somenteLeitura && !novo && (
            <button onClick={() => setNovo({ nome: "", cnpj: "", telefone: "", responsavel: "", prazoMedioDias: 30 })} className="text-[var(--accent-text)]">
              <Plus size={14} />
            </button>
          )}
        </div>
        {novo && (
          <div className="bg-[var(--surface)] border border-[var(--accent-soft-border)] rounded-xl p-3 space-y-2 mb-3">
            <Input value={novo.nome} onChange={(v) => setNovo((n) => ({ ...n, nome: v }))} placeholder="Nome do convênio" />
            <Input value={novo.responsavel} onChange={(v) => setNovo((n) => ({ ...n, responsavel: v }))} placeholder="Responsável" />
            <Input type="number" value={novo.prazoMedioDias} onChange={(v) => setNovo((n) => ({ ...n, prazoMedioDias: v }))} placeholder="Prazo médio (dias)" />
            <div className="flex gap-2 justify-end">
              <Botao variante="fantasma" onClick={() => setNovo(null)}>cancelar</Botao>
              <Botao onClick={criar} disabled={!novo.nome}>salvar</Botao>
            </div>
          </div>
        )}
        <div className="space-y-1">
          {lista.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelecionado(c.id)}
              className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-md text-sm ${
                selecionado === c.id ? "bg-[var(--accent-soft-bg)] text-[var(--accent-text)] font-medium" : "text-[var(--text-secondary)] hover:bg-[var(--bg-alt-strong)]"
              }`}
            >
              <span>{c.nome}</span>
              <span className="text-[11px] text-[var(--text-faint)]">{c.prazo_medio_dias}d</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        {!selecionado ? (
          <p className="text-sm text-[var(--text-faint)]">Selecione um convênio para ver a tabela de preços.</p>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-[var(--text)]">Tabela de preços</h3>
              <div className="flex gap-2">
                {!somenteLeitura && (
                  <Botao variante="fantasma" onClick={() => setNovoPreco({ procedimentoId: "", valor: "", vigenciaInicio: hoje() })}>
                    <Plus size={12} /> nova vigência
                  </Botao>
                )}
                {!somenteLeitura && <button onClick={() => excluir(selecionado)} className="text-[var(--text-faint)] hover:text-[var(--danger)]"><Trash2 size={14} /></button>}
              </div>
            </div>

            {novoPreco && (
              <div className="grid grid-cols-3 gap-2 mb-3 items-end bg-[var(--bg)] rounded-lg p-2.5">
                <Select value={novoPreco.procedimentoId} onChange={(v) => setNovoPreco((n) => ({ ...n, procedimentoId: v }))}>
                  <option value="">Procedimento</option>
                  {procedimentos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Select>
                <Input type="number" value={novoPreco.valor} onChange={(v) => setNovoPreco((n) => ({ ...n, valor: v }))} placeholder="Valor" />
                <div className="flex gap-1">
                  <Input type="date" value={novoPreco.vigenciaInicio} onChange={(v) => setNovoPreco((n) => ({ ...n, vigenciaInicio: v }))} />
                  <Botao onClick={adicionarPreco} disabled={!novoPreco.procedimentoId || !novoPreco.valor}>ok</Botao>
                </div>
              </div>
            )}

            {precos.length === 0 ? (
              <p className="text-xs text-[var(--text-faint)]">Nenhum preço cadastrado ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-[var(--text-faint)] text-left">
                    <th className="font-normal pb-1">Procedimento</th>
                    <th className="font-normal pb-1 text-right">Valor</th>
                    <th className="font-normal pb-1 text-right">Vigente desde</th>
                  </tr>
                </thead>
                <tbody>
                  {precos.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--border-subtle)]">
                      <td className="py-1.5">{p.procedimento_nome}</td>
                      <td className="py-1.5 text-right font-mono">{brl(p.valor)}</td>
                      <td className="py-1.5 text-right text-[var(--text-faint)]">{new Date(p.vigencia_inicio + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Glosas ----------------
function PainelGlosas({ api, avisar, somenteLeitura }) {
  const [lista, setLista] = useState([]);
  const carregar = useCallback(() => {
    api("/glosas").then(setLista).catch(avisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(carregar, [carregar]);

  const mudarStatus = async (id, status) => {
    const valorRecuperado = status === "recuperada" ? window.prompt("Valor recuperado (R$):", "0") : undefined;
    try {
      await api(`/glosas/${id}`, { method: "PUT", body: JSON.stringify({ status, valorRecuperado: valorRecuperado ? Number(valorRecuperado) : undefined }) });
      carregar();
    } catch (e) {
      avisar(e);
    }
  };

  const totalGlosado = lista.reduce((s, g) => s + Number(g.valor), 0);

  return (
    <div className="space-y-4">
      <Cartao titulo="Total glosado (todas as pendências)" valor={brl(totalGlosado)} cor="text-[var(--danger)]" />
      {lista.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)] text-center py-8">Nenhuma glosa registrada.</p>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border-subtle)]">
          {lista.map((g) => {
            const st = STATUS_GLOSA[g.status] || STATUS_GLOSA.glosada;
            return (
              <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text)] truncate">{g.paciente_nome || "—"} · {g.convenio_nome || "Particular"}</div>
                  <div className="text-[11px] text-[var(--text-faint)] truncate">{g.motivo || "sem motivo informado"}</div>
                </div>
                <span className="font-mono text-sm text-[var(--danger)] shrink-0">{brl(g.valor)}</span>
                <span className={`text-[11px] rounded-full px-2 py-0.5 shrink-0 ${st.cor}`}>{st.label}</span>
                {!somenteLeitura && g.status === "glosada" && <Botao variante="fantasma" onClick={() => mudarStatus(g.id, "em_recurso")}>entrar com recurso</Botao>}
                {!somenteLeitura && g.status === "em_recurso" && (
                  <>
                    <Botao variante="fantasma" onClick={() => mudarStatus(g.id, "recuperada")}>recuperada</Botao>
                    <Botao variante="fantasma" onClick={() => mudarStatus(g.id, "perdida")}>perdida</Botao>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------- DRE ----------------
function PainelDRE({ api, mes, avisar }) {
  const [dre, setDre] = useState(null);
  useEffect(() => {
    api(`/financeiro/dre?mes=${mes}`).then(setDre).catch(avisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  if (!dre) return <Loader2 className="animate-spin text-[var(--accent-text)]" size={18} />;

  const linhas = [
    { label: "Receita bruta", valor: dre.receitaBruta, tipo: "base" },
    { label: "(−) Glosas", valor: -dre.glosas, tipo: "sub" },
    { label: "(−) Impostos", valor: -dre.impostos, tipo: "sub" },
    { label: "= Receita líquida", valor: dre.receitaLiquida, tipo: "subtotal" },
    { label: "(−) Custos variáveis", valor: -dre.custosVariaveis, tipo: "sub" },
    { label: "= Margem de contribuição", valor: dre.margemContribuicao, tipo: "subtotal" },
    { label: "(−) Despesas fixas", valor: -dre.despesasFixas, tipo: "sub" },
    { label: "= Resultado operacional", valor: dre.resultadoOperacional, tipo: "total" },
  ];

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden max-w-lg">
      {linhas.map((l, i) => (
        <div
          key={i}
          className={`flex justify-between items-center px-4 py-2.5 ${
            l.tipo === "subtotal" ? "bg-[var(--bg)] font-medium" : l.tipo === "total" ? "bg-[var(--accent-soft-bg)] font-semibold" : ""
          } ${i > 0 ? "border-t border-[var(--border-subtle)]" : ""}`}
        >
          <span className={l.tipo === "sub" ? "text-[var(--text-muted)] text-sm" : "text-[var(--text)] text-sm"}>{l.label}</span>
          <span className={`font-mono text-sm tabular-nums ${l.valor < 0 && l.tipo !== "total" ? "text-[var(--text-muted)]" : l.tipo === "total" ? (l.valor >= 0 ? "text-[var(--accent-text)]" : "text-[var(--danger)]") : "text-[var(--text)]"}`}>
            {brl(l.valor)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------- Rentabilidade ----------------
function PainelRentabilidade({ api, mes, avisar }) {
  const [agrupar, setAgrupar] = useState("procedimento");
  const [dados, setDados] = useState([]);
  const [porEquipamento, setPorEquipamento] = useState([]);

  useEffect(() => {
    if (agrupar === "equipamento") {
      api(`/financeiro/rentabilidade-equipamento?mes=${mes}`).then(setPorEquipamento).catch(avisar);
    } else {
      api(`/financeiro/rentabilidade?mes=${mes}&agrupar=${agrupar}`).then((d) => setDados(d.sort((a, b) => b.resultado - a.resultado))).catch(avisar);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, agrupar]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {[
          { id: "procedimento", label: "Por exame" },
          { id: "convenio", label: "Por convênio" },
          { id: "dentista", label: "Por dentista" },
          { id: "equipamento", label: "Por equipamento (R$/hora)" },
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setAgrupar(o.id)}
            className={`text-xs px-3 py-1.5 rounded-md ${agrupar === o.id ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {agrupar === "equipamento" ? (
        porEquipamento.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)] text-center py-8">
            Nenhum exame vinculado a um equipamento neste mês. Associe um equipamento a cada procedimento na aba "Procedimentos".
          </p>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-[var(--text-faint)] bg-[var(--bg)] text-left">
                  <th className="font-normal px-4 py-2">Equipamento</th>
                  <th className="font-normal px-4 py-2 text-right">Exames</th>
                  <th className="font-normal px-4 py-2 text-right">Horas de uso</th>
                  <th className="font-normal px-4 py-2 text-right">Receita</th>
                  <th className="font-normal px-4 py-2 text-right">Receita/hora</th>
                  <th className="font-normal px-4 py-2 text-right">Lucro/hora</th>
                </tr>
              </thead>
              <tbody>
                {porEquipamento.map((e, i) => (
                  <tr key={i} className="border-t border-[var(--border-subtle)]">
                    <td className="px-4 py-2">{e.equipamento}</td>
                    <td className="px-4 py-2 text-right font-mono">{e.quantidade}</td>
                    <td className="px-4 py-2 text-right font-mono">{e.horas.toFixed(1)}h</td>
                    <td className="px-4 py-2 text-right font-mono">{brl(e.receitaTotal)}</td>
                    <td className="px-4 py-2 text-right font-mono text-[var(--accent-text)]">{brl(e.receitaPorHora)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${e.lucroPorHora >= 0 ? "text-[var(--accent-text)]" : "text-[var(--danger)]"}`}>{brl(e.lucroPorHora)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : dados.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)] text-center py-8">Sem dados faturados neste mês.</p>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-[var(--text-faint)] bg-[var(--bg)] text-left">
                <th className="font-normal px-4 py-2">{agrupar === "convenio" ? "Convênio" : agrupar === "dentista" ? "Dentista" : "Exame"}</th>
                <th className="font-normal px-4 py-2 text-right">Qtd</th>
                <th className="font-normal px-4 py-2 text-right">Receita</th>
                <th className="font-normal px-4 py-2 text-right">Custo</th>
                <th className="font-normal px-4 py-2 text-right">Resultado</th>
                <th className="font-normal px-4 py-2 text-right">Margem</th>
                <th className="font-normal px-4 py-2 text-right">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((d, i) => (
                <tr key={i} className="border-t border-[var(--border-subtle)]">
                  <td className="px-4 py-2">{d.chave}</td>
                  <td className="px-4 py-2 text-right font-mono">{d.quantidade}</td>
                  <td className="px-4 py-2 text-right font-mono">{brl(d.receita)}</td>
                  <td className="px-4 py-2 text-right font-mono text-[var(--text-muted)]">{brl(d.custo)}</td>
                  <td className={`px-4 py-2 text-right font-mono ${d.resultado >= 0 ? "text-[var(--accent-text)]" : "text-[var(--danger)]"}`}>{brl(d.resultado)}</td>
                  <td className="px-4 py-2 text-right font-mono">{pct(d.margem)}</td>
                  <td className="px-4 py-2 text-right font-mono">{brl(d.ticketMedio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------- Lotes de faturamento ----------------
function PainelLotes({ api, avisar, somenteLeitura }) {
  const [convenios, setConvenios] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [convenioSel, setConvenioSel] = useState("");
  const [periodo, setPeriodo] = useState({ inicio: hoje().slice(0, 8) + "01", fim: hoje() });
  const [producao, setProducao] = useState(null);

  const carregarLotes = useCallback(() => {
    api("/lotes").then(setLotes).catch(avisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    api("/convenios").then(setConvenios).catch(avisar);
    carregarLotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verProducao = async () => {
    if (!convenioSel) return;
    try {
      setProducao(await api(`/convenios/${convenioSel}/producao?periodoInicio=${periodo.inicio}&periodoFim=${periodo.fim}`));
    } catch (e) {
      avisar(e);
    }
  };

  const fecharLote = async () => {
    try {
      await api(`/convenios/${convenioSel}/lotes`, { method: "POST", body: JSON.stringify({ periodoInicio: periodo.inicio, periodoFim: periodo.fim }) });
      setProducao(null);
      carregarLotes();
    } catch (e) {
      avisar(e);
    }
  };

  const semPendencia = producao ? producao.filter((p) => p.pendencias.length === 0) : [];
  const comPendencia = producao ? producao.filter((p) => p.pendencias.length > 0) : [];

  return (
    <div className="space-y-6">
      {!somenteLeitura && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text)]">Fechar novo lote</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
            <Select value={convenioSel} onChange={setConvenioSel}>
              <option value="">Selecione o convênio</option>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
            <Input type="date" value={periodo.inicio} onChange={(v) => setPeriodo((p) => ({ ...p, inicio: v }))} />
            <Input type="date" value={periodo.fim} onChange={(v) => setPeriodo((p) => ({ ...p, fim: v }))} />
            <Botao onClick={verProducao} disabled={!convenioSel}>ver produção</Botao>
          </div>

          {producao && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-[var(--text-muted)]">
                {semPendencia.length} exame(s) prontos para faturar · {comPendencia.length} com pendência
              </p>
              {comPendencia.length > 0 && (
                <div className="bg-[var(--warning-bg)] border border-[var(--warning-border)] rounded-lg p-2.5 text-xs text-[var(--warning)] space-y-1">
                  {comPendencia.map((p) => (
                    <div key={p.id}>{p.paciente_nome || "(sem paciente)"} — {p.pendencias.join(", ")}</div>
                  ))}
                </div>
              )}
              {semPendencia.length > 0 && (
                <div className="flex items-center justify-between bg-[var(--accent-soft-bg)] rounded-lg p-2.5">
                  <span className="text-sm text-[var(--accent-text)]">
                    {semPendencia.length} exames · {brl(semPendencia.reduce((s, p) => s + Number(p.valor_faturado), 0))}
                  </span>
                  <Botao onClick={fecharLote}>fechar lote</Botao>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Lotes já fechados</h3>
        {lotes.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)] text-center py-8">Nenhum lote fechado ainda.</p>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border-subtle)]">
            {lotes.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text)]">{l.convenio_nome}</div>
                  <div className="text-[11px] text-[var(--text-faint)]">
                    {new Date(l.periodo_inicio + "T00:00:00").toLocaleDateString("pt-BR")} – {new Date(l.periodo_fim + "T00:00:00").toLocaleDateString("pt-BR")} · {l.quantidade} exames
                  </div>
                </div>
                <span className="font-mono text-sm text-[var(--text)]">{brl(l.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Conciliação bancária ----------------
function PainelConciliacao({ api, mes, avisar, somenteLeitura }) {
  const [conciliacao, setConciliacao] = useState(null);
  const [movimentos, setMovimentos] = useState([]);
  const [novo, setNovo] = useState(null);

  const carregar = useCallback(() => {
    Promise.all([api(`/financeiro/conciliacao?mes=${mes}`), api(`/movimentos-bancarios?mes=${mes}`)])
      .then(([c, m]) => { setConciliacao(c); setMovimentos(m); })
      .catch(avisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);
  useEffect(carregar, [carregar]);

  const criar = async () => {
    try {
      await api("/movimentos-bancarios", { method: "POST", body: JSON.stringify({ ...novo, valor: novo.tipo === "saida" ? -Math.abs(Number(novo.valor)) : Math.abs(Number(novo.valor)) }) });
      setNovo(null);
      carregar();
    } catch (e) {
      avisar(e);
    }
  };
  const excluir = async (id) => {
    try {
      await api(`/movimentos-bancarios/${id}`, { method: "DELETE" });
      carregar();
    } catch (e) {
      avisar(e);
    }
  };

  return (
    <div className="space-y-5">
      {conciliacao && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-[11px] text-[var(--text-faint)] mb-2">Entradas</div>
            <div className="flex justify-between text-sm mb-1"><span className="text-[var(--text-muted)]">Sistema (recebido)</span><span className="font-mono">{brl(conciliacao.recebidoSistema)}</span></div>
            <div className="flex justify-between text-sm mb-1"><span className="text-[var(--text-muted)]">Extrato bancário</span><span className="font-mono">{brl(conciliacao.entradasBanco)}</span></div>
            <div className={`flex justify-between text-sm pt-1 border-t border-[var(--border-subtle)] font-medium ${Math.abs(conciliacao.diferencaEntradas) < 0.01 ? "text-[var(--accent-text)]" : "text-[var(--danger)]"}`}>
              <span>Diferença</span><span className="font-mono">{brl(conciliacao.diferencaEntradas)}</span>
            </div>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-[11px] text-[var(--text-faint)] mb-2">Saídas</div>
            <div className="flex justify-between text-sm mb-1"><span className="text-[var(--text-muted)]">Sistema (pago)</span><span className="font-mono">{brl(conciliacao.pagoSistema)}</span></div>
            <div className="flex justify-between text-sm mb-1"><span className="text-[var(--text-muted)]">Extrato bancário</span><span className="font-mono">{brl(conciliacao.saidasBanco)}</span></div>
            <div className={`flex justify-between text-sm pt-1 border-t border-[var(--border-subtle)] font-medium ${Math.abs(conciliacao.diferencaSaidas) < 0.01 ? "text-[var(--accent-text)]" : "text-[var(--danger)]"}`}>
              <span>Diferença</span><span className="font-mono">{brl(conciliacao.diferencaSaidas)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">Extrato lançado manualmente</h3>
        {!somenteLeitura && !novo && (
          <Botao onClick={() => setNovo({ data: hoje(), descricao: "", valor: "", tipo: "entrada" })}><Plus size={13} /> lançar movimento</Botao>
        )}
      </div>

      {novo && (
        <div className="bg-[var(--surface)] border border-[var(--accent-soft-border)] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
          <Input type="date" value={novo.data} onChange={(v) => setNovo((n) => ({ ...n, data: v }))} />
          <div className="col-span-2">
            <Input value={novo.descricao} onChange={(v) => setNovo((n) => ({ ...n, descricao: v }))} placeholder="Descrição" />
          </div>
          <Select value={novo.tipo} onChange={(v) => setNovo((n) => ({ ...n, tipo: v }))}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </Select>
          <Input type="number" value={novo.valor} onChange={(v) => setNovo((n) => ({ ...n, valor: v }))} placeholder="Valor" />
          <div className="col-span-2 sm:col-span-5 flex gap-2 justify-end">
            <Botao variante="fantasma" onClick={() => setNovo(null)}>cancelar</Botao>
            <Botao onClick={criar} disabled={!novo.descricao || !novo.valor}>salvar</Botao>
          </div>
        </div>
      )}

      {movimentos.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)] text-center py-6">Nenhum movimento lançado neste mês.</p>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border-subtle)]">
          {movimentos.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2">
              <span className="text-xs text-[var(--text-faint)] w-20 shrink-0">{new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
              <span className="flex-1 text-sm text-[var(--text)] truncate">{m.descricao}</span>
              <span className={`font-mono text-sm ${Number(m.valor) >= 0 ? "text-[var(--accent-text)]" : "text-[var(--danger)]"}`}>{brl(m.valor)}</span>
              {!somenteLeitura && (
                <button onClick={() => excluir(m.id)} className="text-[var(--text-faint)] hover:text-[var(--danger)]"><Trash2 size={13} /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
