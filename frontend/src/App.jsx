import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, Activity, Clock, Package, Stethoscope, Calculator, TrendingUp, TrendingDown, AlertCircle, Loader2, LayoutDashboard, Printer, CalendarDays, ChevronLeft, ChevronRight, ArrowRight, Sun, Moon, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import FinanceiroModule from "./FinanceiroModule.jsx";

// ---------- helpers ----------
const brl = (n) =>
  isFinite(n)
    ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
const pct = (n) => (isFinite(n) ? `${(Number(n) * 100).toFixed(1)}%` : "—");
const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));

const STATUS_AGENDAMENTO = {
  aguardando: { label: "Aguardando chegar", classe: "bg-[var(--bg-alt-strong)] text-[var(--text-secondary)]" },
  atendido: { label: "Atendido", classe: "bg-[var(--accent-soft-bg-strong)] text-[var(--accent-text)]" },
  faltou: { label: "Faltou", classe: "bg-[var(--danger-bg-strong)] text-[var(--danger)]" },
  desmarcou: { label: "Desmarcou", classe: "bg-[var(--bg-alt-strong)] text-[var(--text-muted)]" },
  remarcado: { label: "Remarcado", classe: "bg-[var(--warning-bg-strong)] text-[var(--warning)]" },
};

// ---------- small UI atoms ----------
function NumInput({ value, onChange, onBlur, prefix, suffix, step = "1", className = "", disabled }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {prefix && <span className="text-xs text-[var(--text-faint)] font-mono">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onBlur={onBlur}
        className="w-full bg-transparent border-b border-[var(--border-strong)] focus:border-[var(--accent-text)] outline-none text-right font-mono text-sm py-0.5 px-1 tabular-nums disabled:text-[var(--text-faint)] disabled:cursor-not-allowed"
      />
      {suffix && <span className="text-xs text-[var(--text-faint)] font-mono">{suffix}</span>}
    </div>
  );
}

function TextInput({ value, onChange, onBlur, className = "", disabled }) {
  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={`w-full bg-transparent border-b border-[var(--border-strong)] focus:border-[var(--accent-text)] outline-none text-sm py-0.5 px-1 disabled:text-[var(--text-faint)] disabled:cursor-not-allowed ${className}`}
    />
  );
}

// ---------- tema (claro/escuro + cor de destaque) ----------
function useTema() {
  const [escuro, setEscuro] = useState(() => {
    try {
      return localStorage.getItem("temaEscuro") === "1";
    } catch {
      return false;
    }
  });
  const [cor, setCor] = useState(() => {
    try {
      return localStorage.getItem("corDestaque") || "teal";
    } catch {
      return "teal";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", escuro);
    document.documentElement.dataset.accent = cor;
    try {
      localStorage.setItem("temaEscuro", escuro ? "1" : "0");
      localStorage.setItem("corDestaque", cor);
    } catch {}
  }, [escuro, cor]);

  return { escuro, setEscuro, cor, setCor };
}

const CORES_DISPONIVEIS = [
  { id: "teal", swatch: "#0f766e" },
  { id: "blue", swatch: "#1d4ed8" },
  { id: "purple", swatch: "#7e22ce" },
];

function SeletorDeTema({ escuro, setEscuro, cor, setCor }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <IconBtn onClick={() => setAberto((a) => !a)} title="Tema">
        {escuro ? <Moon size={15} /> : <Sun size={15} />}
      </IconBtn>
      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-full mt-2 z-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-3 w-48">
            <button
              onClick={() => setEscuro((e) => !e)}
              className="w-full flex items-center justify-between text-xs text-[var(--text-secondary)] hover:text-[var(--text)] mb-3"
            >
              <span className="flex items-center gap-1.5">
                {escuro ? <Moon size={13} /> : <Sun size={13} />} {escuro ? "Escuro" : "Claro"}
              </span>
              <span className={`w-8 h-4 rounded-full relative transition-colors ${escuro ? "bg-[var(--accent)]" : "bg-[var(--bg-alt-strong)]"}`}>
                <span className={`absolute top-0.5 w-3 h-3 bg-[var(--surface)] rounded-full transition-transform ${escuro ? "translate-x-4" : "translate-x-0.5"}`} />
              </span>
            </button>
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] mb-1.5">Cor de destaque</div>
            <div className="flex gap-2">
              {CORES_DISPONIVEIS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCor(c.id)}
                  title={c.id}
                  style={{ background: c.swatch }}
                  className={`w-6 h-6 rounded-full ${cor === c.id ? "ring-2 ring-offset-2 ring-[var(--text)]" : ""}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IconBtn({ onClick, title, disabled, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="text-[var(--text-faint)] hover:text-[var(--danger)] disabled:opacity-30 disabled:hover:text-[var(--text-faint)] disabled:cursor-not-allowed transition-colors p-1 rounded"
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="border border-[var(--border)] rounded-lg px-4 py-3 bg-[var(--surface)]">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] mb-1">{label}</div>
      <div className={`text-2xl font-mono tabular-nums ${accent || "text-[var(--text)]"}`}>{value}</div>
      {sub && <div className="text-xs text-[var(--text-faint)] mt-0.5">{sub}</div>}
    </div>
  );
}

// ---------- configuração vinda do processo Electron (via query string) ----------
const params = new URLSearchParams(window.location.search);
const MODO_INSTALACAO = params.get("modo") || "servidor"; // "servidor" | "cliente"
const API_BASE = params.get("apiBase") || ""; // vazio = mesma origem (modo servidor)
const ENDERECO_REDE = params.get("enderecoRede") || null; // só existe no modo servidor

// ---------- API client ----------
function useApi(token) {
  return useCallback(
    async (path, options = {}) => {
      const res = await fetch(`${API_BASE}/api${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
          const body = await res.json();
          if (body.erro) msg = body.erro;
        } catch (_) {}
        const erro = new Error(msg);
        erro.status = res.status;
        throw erro;
      }
      if (res.status === 204) return null;
      const texto = await res.text();
      return texto ? JSON.parse(texto) : null; // algumas rotas respondem "criado com sucesso" sem corpo nenhum
    },
    [token]
  );
}

// ---------- login / cadastro ----------
function AuthScreen({ onAutenticado }) {
  const { escuro, setEscuro, cor, setCor } = useTema();
  const [modo, setModo] = useState("login");
  const [clinicaNome, setClinicaNome] = useState("Minha Clínica");
  const [usuarioNome, setUsuarioNome] = useState("");
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem("ultimoEmail") || "";
    } catch {
      return "";
    }
  });
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const erroDeConexao = (e) => e.message;

  async function enviar() {
    setCarregando(true);
    setErro(null);
    try {
      const path = modo === "login" ? "/auth/login" : "/auth/registrar";
      const body = modo === "login" ? { email, senha } : { clinicaNome, usuarioNome, email, senha };
      const res = await fetch(`${API_BASE}/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
      try {
        localStorage.setItem("ultimoEmail", email); // só o e-mail, nunca a senha
      } catch {}
      onAutenticado({ token: data.token, usuario: data.usuario, clinica: data.clinica });
    } catch (e) {
      setErro(erroDeConexao(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-6" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-[var(--accent-text)]" strokeWidth={1.5} />
            <div className="text-[11px] uppercase tracking-wide text-[var(--accent-text)] font-medium">Precificação clínica</div>
          </div>
          <SeletorDeTema escuro={escuro} setEscuro={setEscuro} cor={cor} setCor={setCor} />
        </div>
        <h1 className="text-lg font-medium text-[var(--text)] mb-5">{modo === "login" ? "Entrar" : "Criar conta e clínica"}</h1>

        <div className="flex gap-1 mb-4 border-b border-[var(--border)]">
          {["login", "registrar"].map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                modo === m ? "border-[var(--accent-text)] text-[var(--accent-text-hover)] font-medium" : "border-transparent text-[var(--text-faint)]"
              }`}
            >
              {m === "login" ? "Já tenho conta" : "Nova clínica"}
            </button>
          ))}
        </div>

        {modo === "registrar" && (
          <>
            <label className="text-xs text-[var(--text-faint)] block mb-1">Nome da clínica</label>
            <TextInput value={clinicaNome} onChange={setClinicaNome} className="mb-3" />
            <label className="text-xs text-[var(--text-faint)] block mb-1">Seu nome</label>
            <TextInput value={usuarioNome} onChange={setUsuarioNome} className="mb-3" />
          </>
        )}
        <label className="text-xs text-[var(--text-faint)] block mb-1">E-mail</label>
        <TextInput value={email} onChange={setEmail} className="mb-3" />
        <label className="text-xs text-[var(--text-faint)] block mb-1">Senha {modo === "registrar" && "(mínimo 8 caracteres)"}</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full bg-transparent border-b border-[var(--border-strong)] focus:border-[var(--accent-text)] outline-none text-sm py-1 px-1 mb-4"
        />

        <button
          onClick={enviar}
          disabled={carregando || !email || !senha || (modo === "registrar" && (!clinicaNome || !usuarioNome))}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm rounded-md py-2 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {carregando && <Loader2 size={14} className="animate-spin" />}
          {modo === "login" ? "Entrar" : "Criar conta"}
        </button>

        {erro && (
          <div className="mt-4 flex gap-2 text-xs text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-md p-3">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <p className="text-xs text-[var(--text-faint)] mt-5">
          Seus dados ficam salvos neste computador. O login não persiste se você fechar o programa — é preciso entrar de novo a cada abertura.
        </p>
      </div>
    </div>
  );
}

// ---------- main connected app ----------
function ConnectedApp({ sessao, onSair }) {
  const { token, usuario, clinica } = sessao;
  const api = useApi(token);
  const { escuro, setEscuro, cor, setCor } = useTema();
  const somenteLeitura = usuario.papel === "recepcao";
  const [tab, setTab] = useState(MODO_INSTALACAO === "cliente" ? "insumos" : "custos");
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erroGlobal, setErroGlobal] = useState(null);

  const [despesas, setDespesas] = useState([]);
  const [ativos, setAtivos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [dataAgenda, setDataAgenda] = useState(() => new Date().toISOString().slice(0, 10));
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);
  const [novoAgendamento, setNovoAgendamento] = useState(null); // objeto do formulário, ou null se fechado
  const [capacidade, setCapacidade] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [procedimentos, setProcedimentos] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [selectedProc, setSelectedProc] = useState(null);
  const [calc, setCalc] = useState(null);
  const [calculos, setCalculos] = useState({}); // id -> calc, usado só pros ícones de tendência na lista

  const avisar = (e) => {
    if (e && e.status === 401) {
      onSair(); // sessão expirou ou token ficou inválido — manda de volta pro login
      return;
    }
    setErroGlobal(typeof e === "string" ? e : e.message || "Erro inesperado.");
  };

  // ---- carga inicial ----
  useEffect(() => {
    (async () => {
      try {
        const [d, c, i, p, a] = await Promise.all([
          api("/despesas"),
          api("/capacidade"),
          api("/insumos"),
          api("/procedimentos"),
          api("/ativos"),
        ]);
        setDespesas(d);
        setCapacidade(
          c || { dias_trabalhados: 24, horas_por_dia: 8, unidades_renda: 1, percent_ocupacao: 0.75 }
        );
        setInsumos(i);
        setProcedimentos(p);
        setAtivos(a);
        if (p[0]) setSelectedProc(p[0].id);
      } catch (e) {
        avisar(e);
      } finally {
        setCarregandoInicial(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---- resumo (custo fixo/minuto) recarrega sempre que despesas ou capacidade mudam de verdade ----
  const recarregarResumo = useCallback(async () => {
    try {
      setResumo(await api("/resumo"));
    } catch (e) {
      setResumo(null); // capacidade ainda não configurada é esperado, não é erro pro usuário
    }
  }, [api]);

  useEffect(() => {
    if (!carregandoInicial) recarregarResumo();
  }, [carregandoInicial, recarregarResumo]);

  // ---- calc do procedimento selecionado ----
  const recarregarCalc = useCallback(
    async (procId) => {
      if (!procId) return;
      try {
        setCalc(await api(`/procedimentos/${procId}/calculo`));
      } catch (e) {
        setCalc(null);
      }
    },
    [api]
  );

  useEffect(() => {
    recarregarCalc(selectedProc);
  }, [selectedProc, recarregarCalc]);

  // pré-carrega os cálculos de todos os procedimentos (só pros ícones de tendência)
  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        procedimentos.map(async (p) => {
          try {
            return [p.id, await api(`/procedimentos/${p.id}/calculo`)];
          } catch {
            return [p.id, null];
          }
        })
      );
      setCalculos(Object.fromEntries(entries));
    })();
  }, [procedimentos, resumo, api]);

  const insumoUnit = (id) => {
    const it = insumos.find((i) => i.id === id);
    if (!it || !num(it.quantidade)) return 0;
    return num(it.valor_total) / num(it.quantidade);
  };

  // ---- mutators: despesas ----
  const addDespesa = async () => {
    try {
      const nova = await api("/despesas", { method: "POST", body: JSON.stringify({ nome: "Nova despesa", valor: 0 }) });
      setDespesas((ds) => [...ds, nova]);
    } catch (e) {
      avisar(e);
    }
  };
  const updDespesaLocal = (id, field, val) =>
    setDespesas((ds) => ds.map((d) => (d.id === id ? { ...d, [field]: val } : d)));
  const salvarDespesa = async (id) => {
    const d = despesas.find((x) => x.id === id);
    try {
      await api(`/despesas/${id}`, { method: "PUT", body: JSON.stringify({ nome: d.nome, valor: num(d.valor) }) });
      recarregarResumo();
    } catch (e) {
      avisar(e);
    }
  };
  const rmDespesa = async (id) => {
    try {
      await api(`/despesas/${id}`, { method: "DELETE" });
      setDespesas((ds) => ds.filter((d) => d.id !== id));
      recarregarResumo();
    } catch (e) {
      avisar(e);
    }
  };

  // ---- mutators: ativos (depreciação) ----
  const addAtivo = async () => {
    try {
      const novo = await api("/ativos", {
        method: "POST",
        body: JSON.stringify({ nome: "Novo equipamento", dataAquisicao: new Date().toISOString().slice(0, 10), valorAquisicao: 0, vidaUtilAnos: 5 }),
      });
      setAtivos((as) => [...as, novo]);
    } catch (e) {
      avisar(e);
    }
  };
  const updAtivoLocal = (id, field, val) => setAtivos((as) => as.map((a) => (a.id === id ? { ...a, [field]: val } : a)));
  const salvarAtivo = async (id) => {
    const a = ativos.find((x) => x.id === id);
    try {
      await api(`/ativos/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          nome: a.nome,
          dataAquisicao: a.data_aquisicao,
          valorAquisicao: num(a.valor_aquisicao),
          vidaUtilAnos: num(a.vida_util_anos),
        }),
      });
      recarregarResumo();
    } catch (e) {
      avisar(e);
    }
  };
  const rmAtivo = async (id) => {
    try {
      await api(`/ativos/${id}`, { method: "DELETE" });
      setAtivos((as) => as.filter((a) => a.id !== id));
      recarregarResumo();
    } catch (e) {
      avisar(e);
    }
  };

  // ---- agenda de pacientes ----
  const carregarAgendamentos = useCallback(
    async (data) => {
      setCarregandoAgenda(true);
      try {
        setAgendamentos(await api(`/agendamentos?data=${data}`));
      } catch (e) {
        avisar(e);
      } finally {
        setCarregandoAgenda(false);
      }
    },
    [api]
  );
  useEffect(() => {
    if (!carregandoInicial) carregarAgendamentos(dataAgenda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataAgenda, carregandoInicial]);

  const mudarDia = (delta) => {
    const d = new Date(dataAgenda + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDataAgenda(d.toISOString().slice(0, 10));
  };

  const criarAgendamento = async () => {
    if (!novoAgendamento?.nome) return;
    try {
      await api("/agendamentos", {
        method: "POST",
        body: JSON.stringify({ ...novoAgendamento, data: dataAgenda }),
      });
      setNovoAgendamento(null);
      carregarAgendamentos(dataAgenda);
    } catch (e) {
      avisar(e);
    }
  };

  const mudarStatusAgendamento = async (ag, novoStatus) => {
    if (novoStatus === "remarcado") {
      const novaData = window.prompt(`Remarcar "${ag.nome}" para qual data? (AAAA-MM-DD)`, dataAgenda);
      if (!novaData) return;
      const novaHora = window.prompt("Horário (opcional, HH:MM):", ag.hora || "") || null;
      try {
        await api(`/agendamentos/${ag.id}/remarcar`, { method: "PUT", body: JSON.stringify({ novaData, novaHora }) });
        carregarAgendamentos(dataAgenda);
      } catch (e) {
        avisar(e);
      }
      return;
    }
    try {
      await api(`/agendamentos/${ag.id}`, { method: "PUT", body: JSON.stringify({ status: novoStatus }) });
      carregarAgendamentos(dataAgenda);
    } catch (e) {
      avisar(e);
    }
  };

  const excluirAgendamento = async (id) => {
    try {
      await api(`/agendamentos/${id}`, { method: "DELETE" });
      carregarAgendamentos(dataAgenda);
    } catch (e) {
      avisar(e);
    }
  };

  // ---- mutators: capacidade ----
  const updCapacidadeLocal = (field, val) => setCapacidade((c) => ({ ...c, [field]: val }));
  const salvarCapacidade = async () => {
    try {
      await api("/capacidade", {
        method: "PUT",
        body: JSON.stringify({
          diasTrabalhados: num(capacidade.dias_trabalhados),
          horasPorDia: num(capacidade.horas_por_dia),
          unidadesRenda: num(capacidade.unidades_renda),
          percentOcupacao: num(capacidade.percent_ocupacao),
        }),
      });
      recarregarResumo();
    } catch (e) {
      avisar(e);
    }
  };

  // ---- mutators: insumos ----
  const addInsumo = async () => {
    try {
      const novo = await api("/insumos", {
        method: "POST",
        body: JSON.stringify({ nome: "Novo insumo", unidade: "un", valorTotal: 0, quantidade: 1 }),
      });
      setInsumos((is) => [...is, novo]);
    } catch (e) {
      avisar(e);
    }
  };
  const updInsumoLocal = (id, field, val) => setInsumos((is) => is.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  const salvarInsumo = async (id) => {
    const it = insumos.find((x) => x.id === id);
    try {
      await api(`/insumos/${id}`, {
        method: "PUT",
        body: JSON.stringify({ nome: it.nome, unidade: it.unidade, valorTotal: num(it.valor_total), quantidade: num(it.quantidade) }),
      });
      recarregarCalc(selectedProc);
    } catch (e) {
      avisar(e);
    }
  };
  const rmInsumo = async (id) => {
    try {
      await api(`/insumos/${id}`, { method: "DELETE" });
      setInsumos((is) => is.filter((i) => i.id !== id));
    } catch (e) {
      avisar(e);
    }
  };

  // ---- mutators: procedimentos ----
  const addProc = async () => {
    try {
      const novo = await api("/procedimentos", { method: "POST", body: JSON.stringify({ nome: "Novo procedimento", tempoMinutos: 10 }) });
      novo._itens = [];
      setProcedimentos((ps) => [...ps, novo]);
      setSelectedProc(novo.id);
    } catch (e) {
      avisar(e);
    }
  };
  const rmProc = async (id) => {
    try {
      await api(`/procedimentos/${id}`, { method: "DELETE" });
      const restantes = procedimentos.filter((p) => p.id !== id);
      setProcedimentos(restantes);
      if (selectedProc === id) setSelectedProc(restantes[0]?.id || null);
    } catch (e) {
      avisar(e);
    }
  };
  const updProcLocal = (id, field, val) => setProcedimentos((ps) => ps.map((p) => (p.id === id ? { ...p, [field]: val } : p)));

  const CAMPO_PARA_API = {
    nome: "nome",
    tempo_minutos: "tempoMinutos",
    laudos: "laudos",
    retrabalho_pct: "retrabalhoPct",
    comissao_pct: "comissaoPct",
    lucro_desejado_pct: "lucroDesejadoPct",
    inadimplencia_pct: "inadimplenciaPct",
    impostos_pct: "impostosPct",
    taxa_cartao_pct: "taxaCartaoPct",
    outros_pct: "outrosPct",
    preco_concorrencia: "precoConcorrencia",
    equipamento_id: "equipamentoId",
  };
  const CAMPOS_TEXTO_PROC = ["nome", "equipamento_id"]; // não passam por num() ao salvar

  const salvarCampoProc = async (id, campo) => {
    const p = procedimentos.find((x) => x.id === id);
    const chaveApi = CAMPO_PARA_API[campo];
    if (!chaveApi) return;
    try {
      await api(`/procedimentos/${id}`, {
        method: "PUT",
        body: JSON.stringify({ [chaveApi]: CAMPOS_TEXTO_PROC.includes(campo) ? (p[campo] || null) : num(p[campo]) }),
      });
      recarregarCalc(id);
    } catch (e) {
      avisar(e);
    }
  };

  const salvarPrecoFinal = async (id) => {
    const p = procedimentos.find((x) => x.id === id);
    try {
      await api(`/procedimentos/${id}/preco-final`, { method: "PUT", body: JSON.stringify({ precoNovo: num(p.preco_final) }) });
      recarregarCalc(id);
    } catch (e) {
      avisar(e);
    }
  };

  // ---- itens (insumos consumidos) de um procedimento ----
  const [itensPorProc, setItensPorProc] = useState({});
  const carregarItens = useCallback(
    async (procId) => {
      try {
        const itens = await api(`/procedimentos/${procId}/itens`);
        setItensPorProc((m) => ({ ...m, [procId]: itens }));
      } catch (e) {
        avisar(e);
      }
    },
    [api]
  );
  useEffect(() => {
    if (selectedProc) carregarItens(selectedProc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProc]);

  const addItem = async (procId) => {
    if (!insumos.length) return;
    // Sempre escolher insumos[0] sem checar o que já está na lista fazia
    // o botão "não fazer nada" quando esse insumo já estava adicionado —
    // a chamada só reafirmava quantidade 1 num item que já existia, em vez
    // de criar uma linha nova.
    const jaUsados = new Set((itensPorProc[procId] || []).map((it) => it.insumo_id));
    const proximoInsumo = insumos.find((i) => !jaUsados.has(i.id));
    if (!proximoInsumo) {
      avisar("Todos os insumos cadastrados já foram adicionados a este procedimento. Cadastre um novo insumo na aba \"Insumos\" para adicionar mais.");
      return;
    }
    try {
      await api(`/procedimentos/${procId}/itens`, {
        method: "POST",
        body: JSON.stringify({ insumoId: proximoInsumo.id, quantidade: 1 }),
      });
      await carregarItens(procId);
      recarregarCalc(procId);
    } catch (e) {
      avisar(e);
    }
  };
  const updItem = async (procId, insumoIdAntigo, novoInsumoId, quantidade) => {
    try {
      if (novoInsumoId !== insumoIdAntigo) {
        await api(`/procedimentos/${procId}/itens/${insumoIdAntigo}`, { method: "DELETE" });
      }
      await api(`/procedimentos/${procId}/itens`, {
        method: "POST",
        body: JSON.stringify({ insumoId: novoInsumoId, quantidade }),
      });
      await carregarItens(procId);
      recarregarCalc(procId);
    } catch (e) {
      avisar(e);
    }
  };
  const rmItem = async (procId, insumoId) => {
    try {
      await api(`/procedimentos/${procId}/itens/${insumoId}`, { method: "DELETE" });
      await carregarItens(procId);
      recarregarCalc(procId);
    } catch (e) {
      avisar(e);
    }
  };

  const proc = procedimentos.find((p) => p.id === selectedProc);
  const itensDoProc = itensPorProc[selectedProc] || [];

  const TODAS_AS_ABAS = [
    { id: "custos", label: "Custos & capacidade", icon: Clock },
    { id: "insumos", label: "Insumos", icon: Package },
    { id: "procedimentos", label: "Procedimentos", icon: Stethoscope },
    { id: "precificacao", label: "Precificação", icon: Calculator },
    { id: "agenda", label: "Agenda", icon: CalendarDays },
    { id: "financeiro", label: "Financeiro", icon: Wallet },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];
  // Instalação "cliente" (computador da recepção conectado ao servidor da
  // clínica) só enxerga o que foi pedido: cadastrar insumos e consultar
  // preços — nada de custos, procedimentos, agenda ou dashboard ali.
  const tabs = MODO_INSTALACAO === "cliente" ? TODAS_AS_ABAS.filter((t) => ["insumos", "precificacao"].includes(t.id)) : TODAS_AS_ABAS;
  const precificacaoBloqueada = somenteLeitura || MODO_INSTALACAO === "cliente";

  useEffect(() => {
    // Se a aba atual não existe mais nesta instalação (ex: veio de um
    // estado antigo salvo, ou mudou de modo), volta pra primeira disponível.
    if (!tabs.find((t) => t.id === tab)) setTab(tabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [MODO_INSTALACAO]);

  if (carregandoInicial) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[var(--accent-text)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] no-print">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[var(--accent-text)] font-medium mb-1 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-text)]" />
              {clinica.nome} · {usuario.nome} ({usuario.papel})
            </div>
            <h1 className="text-xl font-medium text-[var(--text)]">Calculadora de custo e preço por procedimento</h1>
          </div>
          <div className="flex items-center gap-4 no-print">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] border border-[var(--border)] rounded-md px-3 py-1.5">
              <Printer size={13} /> Imprimir tabela de preços
            </button>
            <SeletorDeTema escuro={escuro} setEscuro={setEscuro} cor={cor} setCor={setCor} />
            <button onClick={onSair} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)]">
              sair
            </button>
          </div>
        </div>
      </div>

      {somenteLeitura && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="text-xs text-[var(--warning)] bg-[var(--warning-bg)] border border-[var(--warning-border)] rounded-md px-4 py-2">
            Seu papel é "recepção": você pode consultar tudo, mas edições ficam bloqueadas pela própria API.
          </div>
        </div>
      )}

      {MODO_INSTALACAO === "servidor" && ENDERECO_REDE && (
        <div className="max-w-5xl mx-auto px-6 pt-4 no-print">
          <div className="text-xs text-[var(--accent-text)] bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] rounded-md px-4 py-2">
            Este computador é o <strong>servidor</strong>. Nos computadores clientes, informe o endereço:{" "}
            <span className="font-mono">{ENDERECO_REDE}</span>
          </div>
        </div>
      )}

      {MODO_INSTALACAO === "cliente" && (
        <div className="max-w-5xl mx-auto px-6 pt-4 no-print">
          <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-alt-strong)] border border-[var(--border)] rounded-md px-4 py-2">
            Conectado ao servidor em <span className="font-mono">{API_BASE}</span> — modo cliente: só cadastro de insumos e consulta de preços.
          </div>
        </div>
      )}

      {erroGlobal && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-md px-4 py-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} /> {erroGlobal}
            </div>
            <button onClick={() => setErroGlobal(null)} className="text-[var(--danger-faint)] hover:text-[var(--danger)] text-xs">
              fechar
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 pt-6 no-print">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Custo fixo total / mês" value={resumo ? brl(resumo.custoFixoTotal) : "—"} sub={resumo && resumo.depreciacaoMensalTotal > 0 ? `inclui ${brl(resumo.depreciacaoMensalTotal)} de depreciação` : undefined} />
          <StatCard label="Horas efetivas / mês" value={resumo ? resumo.horasEfetivas.toFixed(0) + "h" : "—"} />
          <StatCard label="Custo fixo / hora" value={resumo ? brl(resumo.custoFixoPorHora) : "—"} accent="text-[var(--accent-text)]" />
          <StatCard label="Custo fixo / minuto" value={resumo ? brl(resumo.custoFixoPorMinuto) : "—"} accent="text-[var(--accent-text)]" />
        </div>
        {!resumo && (
          <p className="text-xs text-[var(--text-faint)] mt-2">
            Configure a capacidade produtiva na aba "Custos & capacidade" para calcular o custo fixo por minuto.
          </p>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-6 no-print">
        <div className="flex gap-1 border-b border-[var(--border)]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                  active ? "border-[var(--accent-text)] text-[var(--accent-text-hover)] font-medium" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <Icon size={15} strokeWidth={1.75} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 no-print">
        {tab === "custos" && (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Despesas fixas mensais</h2>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg)] text-[var(--text-muted)] text-xs uppercase tracking-wide">
                      <th className="text-left font-normal px-4 py-2">Despesa</th>
                      <th className="text-right font-normal px-4 py-2 w-40">Valor médio mensal</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {despesas.map((d) => (
                      <tr key={d.id} className="border-t border-[var(--border-subtle)]">
                        <td className="px-4 py-1.5">
                          <TextInput value={d.nome} onChange={(v) => updDespesaLocal(d.id, "nome", v)} onBlur={() => salvarDespesa(d.id)} disabled={somenteLeitura} />
                        </td>
                        <td className="px-4 py-1.5">
                          <NumInput prefix="R$" value={d.valor} onChange={(v) => updDespesaLocal(d.id, "valor", v)} onBlur={() => salvarDespesa(d.id)} disabled={somenteLeitura} />
                        </td>
                        <td className="px-2 text-center">
                          <IconBtn onClick={() => rmDespesa(d.id)} title="Remover" disabled={somenteLeitura}>
                            <Trash2 size={14} />
                          </IconBtn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={addDespesa} disabled={somenteLeitura} className="flex items-center gap-1.5 text-xs text-[var(--accent-text)] hover:text-[var(--accent-text-hover)] disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2.5 border-t border-[var(--border-subtle)]">
                  <Plus size={13} /> Adicionar despesa
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Equipamentos e móveis (depreciação)</h2>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg)] text-[var(--text-muted)] text-xs uppercase tracking-wide">
                      <th className="text-left font-normal px-4 py-2">Equipamento</th>
                      <th className="text-left font-normal px-4 py-2 w-36">Aquisição</th>
                      <th className="text-right font-normal px-4 py-2 w-32">Valor pago</th>
                      <th className="text-right font-normal px-4 py-2 w-28">Vida útil (anos)</th>
                      <th className="text-right font-normal px-4 py-2 w-32">Depreciação/mês</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ativos.map((a) => (
                      <tr key={a.id} className="border-t border-[var(--border-subtle)]">
                        <td className="px-4 py-1.5">
                          <TextInput value={a.nome} onChange={(v) => updAtivoLocal(a.id, "nome", v)} onBlur={() => salvarAtivo(a.id)} disabled={somenteLeitura} />
                        </td>
                        <td className="px-4 py-1.5">
                          <input
                            type="date"
                            value={a.data_aquisicao || ""}
                            disabled={somenteLeitura}
                            onChange={(e) => updAtivoLocal(a.id, "data_aquisicao", e.target.value)}
                            onBlur={() => salvarAtivo(a.id)}
                            className="w-full bg-transparent border-b border-[var(--border-strong)] focus:border-[var(--accent-text)] outline-none text-sm py-0.5 px-1 disabled:text-[var(--text-faint)]"
                          />
                        </td>
                        <td className="px-4 py-1.5">
                          <NumInput prefix="R$" value={a.valor_aquisicao} onChange={(v) => updAtivoLocal(a.id, "valor_aquisicao", v)} onBlur={() => salvarAtivo(a.id)} disabled={somenteLeitura} />
                        </td>
                        <td className="px-4 py-1.5">
                          <NumInput value={a.vida_util_anos} onChange={(v) => updAtivoLocal(a.id, "vida_util_anos", v)} onBlur={() => salvarAtivo(a.id)} disabled={somenteLeitura} />
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-sm tabular-nums text-[var(--text-secondary)]">
                          {brl(num(a.vida_util_anos) > 0 ? num(a.valor_aquisicao) / num(a.vida_util_anos) / 12 : 0)}
                        </td>
                        <td className="px-2 text-center">
                          <IconBtn onClick={() => rmAtivo(a.id)} title="Remover" disabled={somenteLeitura}>
                            <Trash2 size={14} />
                          </IconBtn>
                        </td>
                      </tr>
                    ))}
                    {resumo && (
                      <tr className="border-t border-[var(--border)] bg-[var(--bg)] font-medium">
                        <td className="px-4 py-2" colSpan={4}>Depreciação mensal total</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">{brl(resumo.depreciacaoMensalTotal)}</td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <button onClick={addAtivo} disabled={somenteLeitura} className="flex items-center gap-1.5 text-xs text-[var(--accent-text)] hover:text-[var(--accent-text-hover)] disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2.5 border-t border-[var(--border-subtle)]">
                  <Plus size={13} /> Adicionar equipamento
                </button>
              </div>
              <p className="text-xs text-[var(--text-faint)] mt-2">
                Depreciação mensal = valor pago ÷ vida útil (anos) ÷ 12. Entra automaticamente no custo fixo total, junto com as despesas acima.
              </p>
            </section>

            {capacidade && (
              <section>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Capacidade produtiva</h2>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
                  <div>
                    <label className="text-xs text-[var(--text-faint)] block mb-1">Dias trabalhados / mês</label>
                    <NumInput value={capacidade.dias_trabalhados} onChange={(v) => updCapacidadeLocal("dias_trabalhados", v)} onBlur={salvarCapacidade} disabled={somenteLeitura} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-faint)] block mb-1">Horas por dia</label>
                    <NumInput value={capacidade.horas_por_dia} onChange={(v) => updCapacidadeLocal("horas_por_dia", v)} onBlur={salvarCapacidade} disabled={somenteLeitura} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-faint)] block mb-1">Unidades de renda (salas/aparelhos)</label>
                    <NumInput value={capacidade.unidades_renda} onChange={(v) => updCapacidadeLocal("unidades_renda", v)} onBlur={salvarCapacidade} disabled={somenteLeitura} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-faint)] block mb-1">% de ocupação</label>
                    <NumInput step="0.01" value={capacidade.percent_ocupacao} onChange={(v) => updCapacidadeLocal("percent_ocupacao", v)} onBlur={salvarCapacidade} disabled={somenteLeitura} />
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "insumos" && (
          <section>
            <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Catálogo de insumos e consumíveis</h2>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--bg)] text-[var(--text-muted)] text-xs uppercase tracking-wide">
                    <th className="text-left font-normal px-4 py-2">Item</th>
                    <th className="text-left font-normal px-4 py-2 w-24">Unidade</th>
                    <th className="text-right font-normal px-4 py-2 w-32">Valor total (R$)</th>
                    <th className="text-right font-normal px-4 py-2 w-28">Quantidade</th>
                    <th className="text-right font-normal px-4 py-2 w-32">Custo unitário</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {insumos.map((it) => (
                    <tr key={it.id} className="border-t border-[var(--border-subtle)]">
                      <td className="px-4 py-1.5">
                        <TextInput value={it.nome} onChange={(v) => updInsumoLocal(it.id, "nome", v)} onBlur={() => salvarInsumo(it.id)} disabled={somenteLeitura} />
                      </td>
                      <td className="px-4 py-1.5">
                        <TextInput value={it.unidade} onChange={(v) => updInsumoLocal(it.id, "unidade", v)} onBlur={() => salvarInsumo(it.id)} disabled={somenteLeitura} />
                      </td>
                      <td className="px-4 py-1.5">
                        <NumInput prefix="R$" value={it.valor_total} onChange={(v) => updInsumoLocal(it.id, "valor_total", v)} onBlur={() => salvarInsumo(it.id)} disabled={somenteLeitura} />
                      </td>
                      <td className="px-4 py-1.5">
                        <NumInput value={it.quantidade} onChange={(v) => updInsumoLocal(it.id, "quantidade", v)} onBlur={() => salvarInsumo(it.id)} disabled={somenteLeitura} />
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-sm tabular-nums text-[var(--text-secondary)]">{brl(insumoUnit(it.id))}</td>
                      <td className="px-2 text-center">
                        <IconBtn onClick={() => rmInsumo(it.id)} title="Remover" disabled={somenteLeitura}>
                          <Trash2 size={14} />
                        </IconBtn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addInsumo} disabled={somenteLeitura} className="flex items-center gap-1.5 text-xs text-[var(--accent-text)] hover:text-[var(--accent-text-hover)] disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2.5 border-t border-[var(--border-subtle)]">
                <Plus size={13} /> Adicionar insumo
              </button>
            </div>
          </section>
        )}

        {tab === "procedimentos" && (
          <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-6">
            <div>
              <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Procedimentos</h2>
              <div className="space-y-1">
                {procedimentos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProc(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedProc === p.id ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent-soft-border)]"
                    }`}
                  >
                    {p.nome || "(sem nome)"}
                  </button>
                ))}
                <button onClick={addProc} disabled={somenteLeitura} className="w-full flex items-center gap-1.5 text-xs text-[var(--accent-text)] hover:text-[var(--accent-text-hover)] disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2">
                  <Plus size={13} /> Novo procedimento
                </button>
              </div>
            </div>

            {proc && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-[var(--text-faint)] block mb-1">Nome do procedimento</label>
                    <TextInput value={proc.nome} onChange={(v) => updProcLocal(proc.id, "nome", v)} onBlur={() => salvarCampoProc(proc.id, "nome")} className="text-base" disabled={somenteLeitura} />
                  </div>
                  <IconBtn onClick={() => rmProc(proc.id)} title="Remover procedimento" disabled={somenteLeitura}>
                    <Trash2 size={16} />
                  </IconBtn>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                  <div>
                    <label className="text-xs text-[var(--text-faint)] block mb-1">Tempo (minutos)</label>
                    <NumInput value={proc.tempo_minutos} onChange={(v) => updProcLocal(proc.id, "tempo_minutos", v)} onBlur={() => salvarCampoProc(proc.id, "tempo_minutos")} disabled={somenteLeitura} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-faint)] block mb-1">Laudos / planejamento (R$)</label>
                    <NumInput prefix="R$" value={proc.laudos} onChange={(v) => updProcLocal(proc.id, "laudos", v)} onBlur={() => salvarCampoProc(proc.id, "laudos")} disabled={somenteLeitura} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-faint)] block mb-1">Retrabalho / desperdício</label>
                    <NumInput step="0.01" value={proc.retrabalho_pct} onChange={(v) => updProcLocal(proc.id, "retrabalho_pct", v)} onBlur={() => salvarCampoProc(proc.id, "retrabalho_pct")} disabled={somenteLeitura} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-faint)] block mb-1">Equipamento usado</label>
                    <select
                      value={proc.equipamento_id || ""}
                      disabled={somenteLeitura}
                      onChange={(e) => { updProcLocal(proc.id, "equipamento_id", e.target.value || null); setTimeout(() => salvarCampoProc(proc.id, "equipamento_id"), 0); }}
                      className="w-full bg-transparent border-b border-[var(--border-strong)] focus:border-[var(--accent-text)] outline-none text-sm py-0.5 px-1 disabled:text-[var(--text-faint)]"
                    >
                      <option value="">— nenhum —</option>
                      {ativos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                    <p className="text-[10px] text-[var(--text-faint)] mt-0.5">alimenta a rentabilidade por hora no Financeiro</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-[var(--text-faint)]">Insumos consumidos</label>
                    <button onClick={() => addItem(proc.id)} disabled={somenteLeitura} className="flex items-center gap-1 text-xs text-[var(--accent-text)] hover:text-[var(--accent-text-hover)] disabled:opacity-30 disabled:cursor-not-allowed">
                      <Plus size={12} /> item
                    </button>
                  </div>
                  <div className="border border-[var(--border)] rounded-md overflow-hidden">
                    {itensDoProc.length === 0 && <div className="text-xs text-[var(--text-faint)] px-3 py-3">Nenhum insumo associado ainda.</div>}
                    {itensDoProc.map((it) => (
                      <div key={it.insumo_id} className="flex items-center gap-2 px-3 py-1.5 border-t border-[var(--border-subtle)] first:border-t-0 text-sm">
                        <select
                          value={it.insumo_id}
                          disabled={somenteLeitura}
                          onChange={(e) => updItem(proc.id, it.insumo_id, e.target.value, it.quantidade)}
                          className="flex-1 bg-transparent border-b border-[var(--border-strong)] outline-none py-0.5 text-sm disabled:text-[var(--text-faint)]"
                        >
                          {insumos.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nome}
                            </option>
                          ))}
                        </select>
                        <NumInput
                          className="w-20"
                          value={it.quantidade}
                          onChange={(v) => setItensPorProc((m) => ({ ...m, [proc.id]: m[proc.id].map((x) => (x.insumo_id === it.insumo_id ? { ...x, quantidade: v } : x)) }))}
                          onBlur={() => updItem(proc.id, it.insumo_id, it.insumo_id, num(it.quantidade))}
                        disabled={somenteLeitura} />
                        <span className="text-xs text-[var(--text-faint)] font-mono w-20 text-right">{brl(num(it.quantidade) * insumoUnit(it.insumo_id))}</span>
                        <IconBtn onClick={() => rmItem(proc.id, it.insumo_id)} title="Remover item" disabled={somenteLeitura}>
                          <Trash2 size={13} />
                        </IconBtn>
                      </div>
                    ))}
                  </div>
                </div>

                {calc && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)]">
                    <StatCard label="Rateio custo fixo" value={brl(calc.rateio)} />
                    <StatCard label="Custo de insumos" value={brl(calc.custoInsumos)} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "precificacao" && (
          <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-6">
            <div>
              <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Procedimentos</h2>
              <div className="space-y-1">
                {procedimentos.map((p) => {
                  const c = calculos[p.id];
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProc(p.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between gap-2 ${
                        selectedProc === p.id ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent-soft-border)]"
                      }`}
                    >
                      <span className="truncate">{p.nome}</span>
                      {c && isFinite(c.lucratividadeFinal) &&
                        (c.lucratividadeFinal >= 0 ? (
                          <TrendingUp size={13} className={selectedProc === p.id ? "text-white" : "text-[var(--accent-text)]"} />
                        ) : (
                          <TrendingDown size={13} className={selectedProc === p.id ? "text-white" : "text-[var(--danger)]"} />
                        ))}
                    </button>
                  );
                })}
              </div>
            </div>

            {proc && (
              <div className="space-y-5">
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                  <h3 className="text-base font-medium mb-4">{proc.nome}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                    <div>
                      <label className="text-xs text-[var(--text-faint)] block mb-1">Comissão comercial</label>
                      <NumInput step="0.01" value={proc.comissao_pct} onChange={(v) => updProcLocal(proc.id, "comissao_pct", v)} onBlur={() => salvarCampoProc(proc.id, "comissao_pct")} disabled={precificacaoBloqueada} />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-faint)] block mb-1">Lucro desejado</label>
                      <NumInput step="0.01" value={proc.lucro_desejado_pct} onChange={(v) => updProcLocal(proc.id, "lucro_desejado_pct", v)} onBlur={() => salvarCampoProc(proc.id, "lucro_desejado_pct")} disabled={precificacaoBloqueada} />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-faint)] block mb-1">Inadimplência</label>
                      <NumInput step="0.01" value={proc.inadimplencia_pct} onChange={(v) => updProcLocal(proc.id, "inadimplencia_pct", v)} onBlur={() => salvarCampoProc(proc.id, "inadimplencia_pct")} disabled={precificacaoBloqueada} />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-faint)] block mb-1">Impostos</label>
                      <NumInput step="0.01" value={proc.impostos_pct} onChange={(v) => updProcLocal(proc.id, "impostos_pct", v)} onBlur={() => salvarCampoProc(proc.id, "impostos_pct")} disabled={precificacaoBloqueada} />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-faint)] block mb-1">Taxa de cartão</label>
                      <NumInput step="0.01" value={proc.taxa_cartao_pct} onChange={(v) => updProcLocal(proc.id, "taxa_cartao_pct", v)} onBlur={() => salvarCampoProc(proc.id, "taxa_cartao_pct")} disabled={precificacaoBloqueada} />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-faint)] block mb-1">Preço da concorrência</label>
                      <NumInput prefix="R$" value={proc.preco_concorrencia} onChange={(v) => updProcLocal(proc.id, "preco_concorrencia", v)} onBlur={() => salvarCampoProc(proc.id, "preco_concorrencia")} disabled={precificacaoBloqueada} />
                    </div>
                  </div>

                  {calc ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <StatCard label="Custo direto total" value={brl(calc.custoDireto)} />
                      <StatCard label="Ponto de equilíbrio" value={brl(calc.pontoEquilibrio)} accent="text-[var(--text-secondary)]" />
                      <StatCard label="Preço sugerido" value={brl(calc.precoSugerido)} accent="text-[var(--accent-text)]" />
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-faint)]">Configure a capacidade produtiva para ver o cálculo.</p>
                  )}
                </div>

                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                  <label className="text-xs text-[var(--text-faint)] block mb-1">Preço final praticado</label>
                  <div className="flex items-end gap-4">
                    <NumInput
                      prefix="R$"
                      value={proc.preco_final}
                      onChange={(v) => updProcLocal(proc.id, "preco_final", v)}
                      onBlur={() => salvarPrecoFinal(proc.id)}
                      className="text-lg max-w-[160px]"
                    disabled={precificacaoBloqueada} />
                    <div className="flex-1">
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] mb-1">Lucratividade final</div>
                      <div className={`text-2xl font-mono tabular-nums ${calc && calc.lucratividadeFinal >= 0 ? "text-[var(--accent-text)]" : "text-[var(--danger)]"}`}>
                        {calc && isFinite(calc.lucratividadeFinal) ? pct(calc.lucratividadeFinal) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "agenda" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconBtn onClick={() => mudarDia(-1)} title="Dia anterior">
                  <ChevronLeft size={16} />
                </IconBtn>
                <input
                  type="date"
                  value={dataAgenda}
                  onChange={(e) => setDataAgenda(e.target.value)}
                  className="border border-[var(--border)] rounded-md px-3 py-1.5 text-sm"
                />
                <IconBtn onClick={() => mudarDia(1)} title="Próximo dia">
                  <ChevronRight size={16} />
                </IconBtn>
                <button onClick={() => setDataAgenda(new Date().toISOString().slice(0, 10))} className="text-xs text-[var(--accent-text)] hover:text-[var(--accent-text-hover)] ml-1">
                  hoje
                </button>
              </div>
              {!somenteLeitura && !novoAgendamento && (
                <button
                  onClick={() => setNovoAgendamento({ nome: "", telefone: "", exame: "", plano: false, particular: false, hora: "" })}
                  className="flex items-center gap-1.5 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md px-3 py-1.5"
                >
                  <Plus size={13} /> Novo agendamento
                </button>
              )}
            </div>

            {novoAgendamento && (
              <div className="bg-[var(--surface)] border border-[var(--accent-soft-border)] rounded-lg p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
                <div className="col-span-2">
                  <label className="text-xs text-[var(--text-faint)] block mb-1">Nome</label>
                  <TextInput value={novoAgendamento.nome} onChange={(v) => setNovoAgendamento((n) => ({ ...n, nome: v }))} />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)] block mb-1">Telefone</label>
                  <TextInput value={novoAgendamento.telefone} onChange={(v) => setNovoAgendamento((n) => ({ ...n, telefone: v }))} />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)] block mb-1">Exame</label>
                  <TextInput value={novoAgendamento.exame} onChange={(v) => setNovoAgendamento((n) => ({ ...n, exame: v }))} />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-faint)] block mb-1">Horário</label>
                  <input
                    type="time"
                    value={novoAgendamento.hora}
                    onChange={(e) => setNovoAgendamento((n) => ({ ...n, hora: e.target.value }))}
                    className="w-full border-b border-[var(--border-strong)] focus:border-[var(--accent-text)] outline-none text-sm py-0.5 px-1 bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={novoAgendamento.plano} onChange={(e) => setNovoAgendamento((n) => ({ ...n, plano: e.target.checked }))} />
                    Plano
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={novoAgendamento.particular} onChange={(e) => setNovoAgendamento((n) => ({ ...n, particular: e.target.checked }))} />
                    Particular
                  </label>
                </div>
                <div className="col-span-2 sm:col-span-6 flex gap-2 justify-end pt-1">
                  <button onClick={() => setNovoAgendamento(null)} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)] px-3 py-1.5">
                    cancelar
                  </button>
                  <button onClick={criarAgendamento} disabled={!novoAgendamento.nome} className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-md px-3 py-1.5">
                    salvar
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--text-muted)]">
              {Object.entries(STATUS_AGENDAMENTO).map(([k, v]) => (
                <span key={k} className={`px-2 py-0.5 rounded-full ${v.classe}`}>{v.label}</span>
              ))}
            </div>

            {carregandoAgenda ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-faint)] py-8 justify-center">
                <Loader2 size={16} className="animate-spin" /> Carregando...
              </div>
            ) : agendamentos.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)] py-8 text-center">Nenhum agendamento para este dia.</p>
            ) : (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg divide-y divide-[var(--border-subtle)]">
                {agendamentos.map((ag) => {
                  const st = STATUS_AGENDAMENTO[ag.status] || STATUS_AGENDAMENTO.aguardando;
                  return (
                    <div key={ag.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="w-14 text-sm font-mono text-[var(--text-muted)] shrink-0">{ag.hora || "—"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--text)] truncate">{ag.nome}</div>
                        <div className="text-xs text-[var(--text-faint)] truncate">
                          {ag.telefone || "sem telefone"} {ag.exame ? `· ${ag.exame}` : ""}
                          {ag.plano ? " · Plano" : ""}
                          {ag.particular ? " · Particular" : ""}
                        </div>
                      </div>
                      {ag.status === "remarcado" && ag.remarcado_para_data ? (
                        <button
                          onClick={() => setDataAgenda(ag.remarcado_para_data)}
                          className="flex items-center gap-1 text-xs text-[var(--warning)] hover:text-[var(--warning-strong)] shrink-0"
                        >
                          <ArrowRight size={12} />
                          {new Date(ag.remarcado_para_data + "T00:00:00").toLocaleDateString("pt-BR")}
                        </button>
                      ) : (
                        <select
                          value={ag.status}
                          disabled={somenteLeitura}
                          onChange={(e) => mudarStatusAgendamento(ag, e.target.value)}
                          className={`text-xs rounded-full px-2 py-1 border-none outline-none shrink-0 ${st.classe} disabled:opacity-60`}
                        >
                          {Object.entries(STATUS_AGENDAMENTO).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      )}
                      <IconBtn onClick={() => excluirAgendamento(ag.id)} title="Excluir" disabled={somenteLeitura}>
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "financeiro" && (
          <FinanceiroModule api={api} somenteLeitura={somenteLeitura} avisar={avisar} procedimentos={procedimentos} insumos={insumos} />
        )}

        {tab === "dashboard" && (
          <div className="space-y-6">
            {procedimentos.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">Cadastre procedimentos para ver os gráficos aqui.</p>
            ) : (
              <>
                <section>
                  <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Preço sugerido vs. preço praticado</h2>
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4" style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={procedimentos.map((p) => ({
                          nome: p.nome,
                          sugerido: calculos[p.id] && isFinite(calculos[p.id].precoSugerido) ? Number(calculos[p.id].precoSugerido.toFixed(2)) : 0,
                          praticado: Number(p.preco_final) || 0,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                        <XAxis dataKey="nome" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                        <Tooltip formatter={(v) => brl(v)} />
                        <Bar dataKey="sugerido" name="Preço sugerido" fill="#0f766e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="praticado" name="Preço praticado" fill="#a8a29e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-[var(--text-faint)] mt-2">
                    Barras cinzas bem abaixo das verdes indicam procedimentos vendidos por menos do que o cálculo sugere.
                  </p>
                </section>

                <section>
                  <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Lucratividade final por procedimento</h2>
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4" style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={procedimentos.map((p) => ({
                          nome: p.nome,
                          lucratividade:
                            calculos[p.id] && isFinite(calculos[p.id].lucratividadeFinal)
                              ? Number((calculos[p.id].lucratividadeFinal * 100).toFixed(1))
                              : 0,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                        <XAxis dataKey="nome" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <Bar dataKey="lucratividade" name="Lucratividade" radius={[4, 4, 0, 0]}>
                          {procedimentos.map((p, i) => {
                            const c = calculos[p.id];
                            const negativo = c && isFinite(c.lucratividadeFinal) && c.lucratividadeFinal < 0;
                            return <Cell key={i} fill={negativo ? "#dc2626" : "#0f766e"} />;
                          })}
                          <LabelList dataKey="lucratividade" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 10, fill: "#78716c" }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {despesas.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Composição das despesas fixas</h2>
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4" style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={[...despesas].sort((a, b) => num(b.valor) - num(a.valor)).map((d) => ({ nome: d.nome, valor: num(d.valor) }))}
                          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                          <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => brl(v)} />
                          <Bar dataKey="valor" fill="#0f766e" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Relatório para impressão — invisível na tela, só aparece no papel/PDF via Ctrl+P.
          Sempre em preto sobre branco, mesmo com o tema escuro ativado na tela. */}
      <style>{`
        .relatorio-impressao { display: none; }
        @media print {
          .no-print { display: none !important; }
          .relatorio-impressao { display: block !important; color: #1c1917; background: white; }
          .relatorio-impressao * { color: #1c1917 !important; border-color: #1c1917 !important; }
          body { background: white; }
        }
      `}</style>
      <div className="relatorio-impressao px-8 py-6">
        <h1 className="text-xl font-semibold mb-1">{clinica.nome}</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Tabela de preços — gerada em {new Date().toLocaleDateString("pt-BR")} · custo fixo/minuto:{" "}
          {resumo ? brl(resumo.custoFixoPorMinuto) : "—"}
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-[var(--text)] text-left">
              <th className="py-2 pr-3">Procedimento</th>
              <th className="py-2 pr-3 text-right">Custo direto</th>
              <th className="py-2 pr-3 text-right">Preço sugerido</th>
              <th className="py-2 pr-3 text-right">Preço praticado</th>
              <th className="py-2 pr-3 text-right">Lucratividade</th>
            </tr>
          </thead>
          <tbody>
            {procedimentos.map((p) => {
              const c = calculos[p.id];
              return (
                <tr key={p.id} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{p.nome}</td>
                  <td className="py-2 pr-3 text-right font-mono">{c ? brl(c.custoDireto) : "—"}</td>
                  <td className="py-2 pr-3 text-right font-mono">{c && isFinite(c.precoSugerido) ? brl(c.precoSugerido) : "—"}</td>
                  <td className="py-2 pr-3 text-right font-mono">{brl(p.preco_final)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{c && isFinite(c.lucratividadeFinal) ? pct(c.lucratividadeFinal) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- root: decide entre tela de login e app conectado ----------
export default function PricingAppConnected() {
  const [sessao, setSessao] = useState(null); // { token, usuario, clinica }

  if (!sessao) {
    return <AuthScreen onAutenticado={setSessao} />;
  }
  return <ConnectedApp sessao={sessao} onSair={() => setSessao(null)} />;
}
