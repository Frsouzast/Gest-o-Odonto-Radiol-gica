const express = require("express");
const crypto = require("crypto");
const db = require("./db");
const { hashSenha, conferirSenha, gerarToken, verificarToken } = require("./auth");
const {
  custoFixoTotal,
  horasEfetivas,
  custoFixoPorHora,
  custoFixoPorMinuto,
  calcProcedimento,
} = require("./engine");
const { calcularDRE, agruparRentabilidade, calcularFluxoProjetado, calcularPorHora, calcularConciliacao } = require("./financeiro");

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const uuid = () => crypto.randomUUID();
const ehErroDeEmailDuplicado = (err) => /UNIQUE constraint failed.*usuario\.email/i.test(err.message || "");

router.get("/health", asyncHandler(async (req, res) => {
  await db.query("select 1");
  res.json({ status: "ok" });
}));

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------
router.post("/auth/registrar", asyncHandler(async (req, res) => {
  const { clinicaNome, usuarioNome, email, senha } = req.body;
  if (!clinicaNome || !usuarioNome || !email || !senha) {
    return res.status(400).json({ erro: "clinicaNome, usuarioNome, email e senha são obrigatórios." });
  }
  if (senha.length < 8) return res.status(400).json({ erro: "A senha precisa ter pelo menos 8 caracteres." });

  const clinicaId = uuid();
  const usuarioId = uuid();
  const emailNormalizado = email.toLowerCase();

  try {
    await db.query("insert into clinica (id, nome) values ($1, $2)", [clinicaId, clinicaNome]);
    const senhaHash = await hashSenha(senha);
    await db.query(
      "insert into usuario (id, clinica_id, nome, email, senha_hash, papel) values ($1, $2, $3, $4, $5, 'dono')",
      [usuarioId, clinicaId, usuarioNome, emailNormalizado, senhaHash]
    );
  } catch (err) {
    if (ehErroDeEmailDuplicado(err)) return res.status(409).json({ erro: "Já existe uma conta com esse e-mail." });
    throw err;
  }

  const token = gerarToken({ usuarioId, clinicaId, papel: "dono" });
  res.status(201).json({
    token,
    usuario: { id: usuarioId, nome: usuarioNome, email: emailNormalizado, papel: "dono" },
    clinica: { id: clinicaId, nome: clinicaNome },
  });
}));

router.post("/auth/login", asyncHandler(async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "email e senha são obrigatórios." });

  const { rows } = await db.query(
    `select u.id, u.nome, u.email, u.senha_hash, u.papel, u.clinica_id, c.nome as clinica_nome
     from usuario u join clinica c on c.id = u.clinica_id
     where u.email = $1`,
    [email.toLowerCase()]
  );
  const usuario = rows[0];
  const credenciaisInvalidas = () => res.status(401).json({ erro: "E-mail ou senha inválidos." });
  if (!usuario) return credenciaisInvalidas();

  const ok = await conferirSenha(senha, usuario.senha_hash);
  if (!ok) return credenciaisInvalidas();

  const token = gerarToken({ usuarioId: usuario.id, clinicaId: usuario.clinica_id, papel: usuario.papel });
  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    clinica: { id: usuario.clinica_id, nome: usuario.clinica_nome },
  });
}));

router.post("/auth/convidar", asyncHandler(async (req, res) => {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ erro: "Token ausente." });
  let payload;
  try {
    payload = verificarToken(token);
  } catch {
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
  if (payload.papel !== "dono") return res.status(403).json({ erro: "Só o dono da clínica pode convidar novos usuários." });

  const { nome, email, senha, papel } = req.body;
  if (!["financeiro", "recepcao"].includes(papel)) {
    return res.status(400).json({ erro: "papel precisa ser 'financeiro' ou 'recepcao'." });
  }
  const id = uuid();
  const emailNormalizado = email.toLowerCase();
  try {
    const senhaHash = await hashSenha(senha);
    await db.query(
      "insert into usuario (id, clinica_id, nome, email, senha_hash, papel) values ($1, $2, $3, $4, $5, $6)",
      [id, payload.clinicaId, nome, emailNormalizado, senhaHash, papel]
    );
    res.status(201).json({ id, nome, email: emailNormalizado, papel });
  } catch (err) {
    if (ehErroDeEmailDuplicado(err)) return res.status(409).json({ erro: "Já existe uma conta com esse e-mail." });
    throw err;
  }
}));

// ---------------------------------------------------------------------------
// Autenticação obrigatória a partir daqui
// ---------------------------------------------------------------------------
router.use((req, res, next) => {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ erro: "Faça login: token ausente no header Authorization." });
  try {
    const payload = verificarToken(token);
    req.usuarioId = payload.usuarioId;
    req.clinicaId = payload.clinicaId;
    req.papel = payload.papel;
    next();
  } catch {
    return res.status(401).json({ erro: "Sessão expirada ou token inválido. Faça login de novo." });
  }
});

const somentePapel = (...papeis) => (req, res, next) => {
  if (!papeis.includes(req.papel)) {
    return res.status(403).json({ erro: `Esta ação exige um dos papéis: ${papeis.join(", ")}.` });
  }
  next();
};
const podeEditar = somentePapel("dono", "financeiro");

// ---- Despesas fixas ----
router.get("/despesas", asyncHandler(async (req, res) => {
  const { rows } = await db.query("select * from despesa_fixa where clinica_id = $1 order by ordem", [req.clinicaId]);
  res.json(rows);
}));

router.post("/despesas", podeEditar, asyncHandler(async (req, res) => {
  const { nome, valor } = req.body;
  const id = uuid();
  await db.query("insert into despesa_fixa (id, clinica_id, nome, valor) values ($1, $2, $3, $4)", [id, req.clinicaId, nome, valor]);
  res.status(201).json({ id, clinica_id: req.clinicaId, nome, valor, ordem: 0 });
}));

router.put("/despesas/:id", podeEditar, asyncHandler(async (req, res) => {
  const { nome, valor } = req.body;
  const { rows: atuais } = await db.query("select * from despesa_fixa where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  if (!atuais[0]) return res.status(404).end();
  await db.query(
    "update despesa_fixa set nome = coalesce($1, nome), valor = coalesce($2, valor) where id = $3 and clinica_id = $4",
    [nome ?? null, valor ?? null, req.params.id, req.clinicaId]
  );
  const { rows } = await db.query("select * from despesa_fixa where id = $1", [req.params.id]);
  res.json(rows[0]);
}));

router.delete("/despesas/:id", podeEditar, asyncHandler(async (req, res) => {
  await db.query("delete from despesa_fixa where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

// ---- Capacidade produtiva ----
router.get("/capacidade", asyncHandler(async (req, res) => {
  const { rows } = await db.query("select * from capacidade_produtiva where clinica_id = $1", [req.clinicaId]);
  res.json(rows[0] || null);
}));

router.put("/capacidade", podeEditar, asyncHandler(async (req, res) => {
  const { diasTrabalhados, horasPorDia, unidadesRenda, percentOcupacao } = req.body;
  await db.query(
    `insert into capacidade_produtiva (clinica_id, dias_trabalhados, horas_por_dia, unidades_renda, percent_ocupacao)
     values ($1, $2, $3, $4, $5)
     on conflict (clinica_id) do update set
       dias_trabalhados = excluded.dias_trabalhados,
       horas_por_dia = excluded.horas_por_dia,
       unidades_renda = excluded.unidades_renda,
       percent_ocupacao = excluded.percent_ocupacao`,
    [req.clinicaId, diasTrabalhados, horasPorDia, unidadesRenda, percentOcupacao]
  );
  const { rows } = await db.query("select * from capacidade_produtiva where clinica_id = $1", [req.clinicaId]);
  res.json(rows[0]);
}));

// ---- Insumos ----
router.get("/insumos", asyncHandler(async (req, res) => {
  const { rows } = await db.query("select * from insumo where clinica_id = $1 order by nome", [req.clinicaId]);
  res.json(rows);
}));

router.post("/insumos", podeEditar, asyncHandler(async (req, res) => {
  const { nome, unidade, valorTotal, quantidade } = req.body;
  const id = uuid();
  await db.query(
    "insert into insumo (id, clinica_id, nome, unidade, valor_total, quantidade) values ($1, $2, $3, $4, $5, $6)",
    [id, req.clinicaId, nome, unidade, valorTotal, quantidade]
  );
  res.status(201).json({ id, clinica_id: req.clinicaId, nome, unidade, valor_total: valorTotal, quantidade });
}));

router.put("/insumos/:id", podeEditar, asyncHandler(async (req, res) => {
  const { nome, unidade, valorTotal, quantidade } = req.body;
  await db.query(
    `update insumo set
       nome = coalesce($1, nome), unidade = coalesce($2, unidade),
       valor_total = coalesce($3, valor_total), quantidade = coalesce($4, quantidade)
     where id = $5 and clinica_id = $6`,
    [nome ?? null, unidade ?? null, valorTotal ?? null, quantidade ?? null, req.params.id, req.clinicaId]
  );
  const { rows } = await db.query("select * from insumo where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  if (!rows[0]) return res.status(404).end();
  res.json(rows[0]);
}));

router.delete("/insumos/:id", podeEditar, asyncHandler(async (req, res) => {
  await db.query("delete from insumo where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

// ---- Ativos (imobilizado) e sua depreciação ----
router.get("/ativos", asyncHandler(async (req, res) => {
  const { rows } = await db.query("select * from ativo where clinica_id = $1 order by nome", [req.clinicaId]);
  res.json(rows);
}));

router.post("/ativos", podeEditar, asyncHandler(async (req, res) => {
  const { nome, dataAquisicao, valorAquisicao, vidaUtilAnos } = req.body;
  const id = uuid();
  await db.query(
    "insert into ativo (id, clinica_id, nome, data_aquisicao, valor_aquisicao, vida_util_anos) values ($1, $2, $3, $4, $5, $6)",
    [id, req.clinicaId, nome, dataAquisicao || null, valorAquisicao || 0, vidaUtilAnos || 1]
  );
  const { rows } = await db.query("select * from ativo where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

router.put("/ativos/:id", podeEditar, asyncHandler(async (req, res) => {
  const { nome, dataAquisicao, valorAquisicao, vidaUtilAnos } = req.body;
  await db.query(
    `update ativo set
       nome = coalesce($1, nome), data_aquisicao = coalesce($2, data_aquisicao),
       valor_aquisicao = coalesce($3, valor_aquisicao), vida_util_anos = coalesce($4, vida_util_anos)
     where id = $5 and clinica_id = $6`,
    [nome ?? null, dataAquisicao ?? null, valorAquisicao ?? null, vidaUtilAnos ?? null, req.params.id, req.clinicaId]
  );
  const { rows } = await db.query("select * from ativo where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  if (!rows[0]) return res.status(404).end();
  res.json(rows[0]);
}));

router.delete("/ativos/:id", podeEditar, asyncHandler(async (req, res) => {
  await db.query("delete from ativo where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

// ---- Custo fixo por minuto (agregado) ----
async function carregarCustoMinuto(clinicaId) {
  const [despesasRes, ativosRes, capacidadeRes] = await Promise.all([
    db.query("select valor from despesa_fixa where clinica_id = $1", [clinicaId]),
    db.query("select valor_aquisicao, vida_util_anos from ativo where clinica_id = $1", [clinicaId]),
    db.query("select * from capacidade_produtiva where clinica_id = $1", [clinicaId]),
  ]);
  const despesas = despesasRes.rows.map((d) => ({ valor: Number(d.valor) }));
  // Depreciação mensal de cada ativo = valor de aquisição / vida útil (anos) / 12.
  // Entra na soma do custo fixo do mesmo jeito que uma despesa comum — é
  // dinheiro que a clínica "gasta" todo mês, só que na forma de desgaste do
  // equipamento em vez de uma conta a pagar.
  const depreciacoes = ativosRes.rows.map((a) => ({
    valor: Number(a.vida_util_anos) > 0 ? Number(a.valor_aquisicao) / Number(a.vida_util_anos) / 12 : 0,
  }));
  const depreciacaoMensalTotal = custoFixoTotal(depreciacoes);
  const capacidadeRow = capacidadeRes.rows[0];
  if (!capacidadeRow) return null;
  const capacidade = {
    diasTrabalhados: Number(capacidadeRow.dias_trabalhados),
    horasPorDia: Number(capacidadeRow.horas_por_dia),
    unidadesRenda: Number(capacidadeRow.unidades_renda),
    percentOcupacao: Number(capacidadeRow.percent_ocupacao),
  };
  const todosOsCustos = [...despesas, ...depreciacoes];
  return {
    custoFixoTotal: custoFixoTotal(todosOsCustos),
    depreciacaoMensalTotal,
    horasEfetivas: horasEfetivas(capacidade),
    custoFixoPorHora: custoFixoPorHora(todosOsCustos, capacidade),
    custoFixoPorMinuto: custoFixoPorMinuto(todosOsCustos, capacidade),
  };
}

router.get("/resumo", asyncHandler(async (req, res) => {
  const resumo = await carregarCustoMinuto(req.clinicaId);
  if (!resumo) return res.status(400).json({ erro: "Capacidade produtiva não configurada para esta clínica." });
  res.json(resumo);
}));

// ---- Procedimentos ----
router.get("/procedimentos", asyncHandler(async (req, res) => {
  const { rows } = await db.query("select * from procedimento where clinica_id = $1 and ativo order by nome", [req.clinicaId]);
  res.json(rows);
}));

router.post("/procedimentos", podeEditar, asyncHandler(async (req, res) => {
  const { nome, tempoMinutos, laudos, retrabalhoPct } = req.body;
  const id = uuid();
  await db.query(
    `insert into procedimento (id, clinica_id, nome, tempo_minutos, laudos, retrabalho_pct)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, req.clinicaId, nome, tempoMinutos || 0, laudos || 0, retrabalhoPct ?? 0.03]
  );
  const { rows } = await db.query("select * from procedimento where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

const CAMPOS_PROCEDIMENTO = {
  nome: "nome",
  tempoMinutos: "tempo_minutos",
  laudos: "laudos",
  retrabalhoPct: "retrabalho_pct",
  comissaoPct: "comissao_pct",
  lucroDesejadoPct: "lucro_desejado_pct",
  inadimplenciaPct: "inadimplencia_pct",
  impostosPct: "impostos_pct",
  taxaCartaoPct: "taxa_cartao_pct",
  outrosPct: "outros_pct",
  precoConcorrencia: "preco_concorrencia",
  equipamentoId: "equipamento_id",
};

router.put("/procedimentos/:id", podeEditar, asyncHandler(async (req, res) => {
  const sets = [];
  const values = [];
  for (const [key, coluna] of Object.entries(CAMPOS_PROCEDIMENTO)) {
    if (req.body[key] !== undefined) {
      values.push(req.body[key]);
      sets.push(`${coluna} = $${values.length}`);
    }
  }
  if (sets.length === 0) return res.status(400).json({ erro: "Nenhum campo reconhecido para atualizar." });
  values.push(req.params.id, req.clinicaId);
  await db.query(
    `update procedimento set ${sets.join(", ")} where id = $${values.length - 1} and clinica_id = $${values.length}`,
    values
  );
  const { rows } = await db.query("select * from procedimento where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  if (!rows[0]) return res.status(404).end();
  res.json(rows[0]);
}));

router.delete("/procedimentos/:id", podeEditar, asyncHandler(async (req, res) => {
  await db.query("update procedimento set ativo = 0 where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

router.get("/procedimentos/:id/itens", asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `select pi.insumo_id, pi.quantidade, i.nome as insumo_nome
     from procedimento_insumo pi join insumo i on i.id = pi.insumo_id
     where pi.procedimento_id = $1`,
    [req.params.id]
  );
  res.json(rows);
}));

router.post("/procedimentos/:id/itens", podeEditar, asyncHandler(async (req, res) => {
  const { insumoId, quantidade } = req.body;
  await db.query(
    `insert into procedimento_insumo (procedimento_id, insumo_id, quantidade)
     values ($1, $2, $3)
     on conflict (procedimento_id, insumo_id) do update set quantidade = excluded.quantidade`,
    [req.params.id, insumoId, quantidade ?? 1]
  );
  res.status(201).json({ procedimento_id: req.params.id, insumo_id: insumoId, quantidade: quantidade ?? 1 });
}));

router.delete("/procedimentos/:id/itens/:insumoId", podeEditar, asyncHandler(async (req, res) => {
  await db.query("delete from procedimento_insumo where procedimento_id = $1 and insumo_id = $2", [req.params.id, req.params.insumoId]);
  res.status(204).end();
}));

router.get("/procedimentos/:id/calculo", asyncHandler(async (req, res) => {
  const resumo = await carregarCustoMinuto(req.clinicaId);
  if (!resumo) return res.status(400).json({ erro: "Capacidade produtiva não configurada para esta clínica." });

  const { rows: procRows } = await db.query("select * from procedimento where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  const p = procRows[0];
  if (!p) return res.status(404).end();

  const { rows: itensRows } = await db.query(
    `select pi.quantidade, i.id as insumo_id, i.valor_total, i.quantidade as insumo_quantidade
     from procedimento_insumo pi join insumo i on i.id = pi.insumo_id
     where pi.procedimento_id = $1`,
    [p.id]
  );
  const custoUnitario = Object.fromEntries(
    itensRows.map((r) => [r.insumo_id, r.insumo_quantidade ? r.valor_total / r.insumo_quantidade : 0])
  );

  const proc = {
    tempoMinutos: Number(p.tempo_minutos),
    laudos: Number(p.laudos),
    retrabalho: Number(p.retrabalho_pct),
    itens: itensRows.map((r) => ({ insumoId: r.insumo_id, quantidade: Number(r.quantidade) })),
    comissao: Number(p.comissao_pct),
    lucroDesejado: Number(p.lucro_desejado_pct),
    inadimplencia: Number(p.inadimplencia_pct),
    impostos: Number(p.impostos_pct),
    taxaCartao: Number(p.taxa_cartao_pct),
    outrosPct: Number(p.outros_pct),
    precoFinal: p.preco_final ? Number(p.preco_final) : 0,
  };

  const resultado = calcProcedimento(proc, resumo.custoFixoPorMinuto, (id) => custoUnitario[id] || 0);
  res.json({ procedimento: p.nome, ...resultado });
}));

router.put("/procedimentos/:id/preco-final", podeEditar, asyncHandler(async (req, res) => {
  const { precoNovo } = req.body;
  const { rows: atuais } = await db.query("select preco_final from procedimento where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  if (!atuais[0]) return res.status(404).end();

  await db.query("update procedimento set preco_final = $1 where id = $2", [precoNovo, req.params.id]);
  await db.query(
    "insert into historico_preco (id, procedimento_id, usuario_id, preco_anterior, preco_novo) values ($1, $2, $3, $4, $5)",
    [uuid(), req.params.id, req.usuarioId, atuais[0].preco_final, precoNovo]
  );
  res.status(204).end();
}));

// ---------------------------------------------------------------------------
// Agenda de pacientes — aberta a qualquer papel autenticado (agendar não é
// uma ação financeira, então não passa por podeEditar como despesas/preços).
// ---------------------------------------------------------------------------
router.get("/agendamentos", asyncHandler(async (req, res) => {
  const data = req.query.data;
  if (!data) return res.status(400).json({ erro: "Informe ?data=AAAA-MM-DD." });
  const { rows } = await db.query(
    `select a.*, r.data as remarcado_para_data, r.hora as remarcado_para_hora
     from agendamento a
     left join agendamento r on r.id = a.remarcado_para_id
     where a.clinica_id = $1 and a.data = $2
     order by a.hora is null, a.hora`,
    [req.clinicaId, data]
  );
  res.json(rows);
}));

router.post("/agendamentos", asyncHandler(async (req, res) => {
  const { nome, telefone, exame, plano, particular, data, hora } = req.body;
  if (!nome || !data) return res.status(400).json({ erro: "nome e data são obrigatórios." });
  const id = uuid();
  await db.query(
    `insert into agendamento (id, clinica_id, nome, telefone, exame, plano, particular, data, hora)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, req.clinicaId, nome, telefone || null, exame || null, plano ? 1 : 0, particular ? 1 : 0, data, hora || null]
  );
  const { rows } = await db.query("select * from agendamento where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

const CAMPOS_AGENDAMENTO = {
  nome: "nome",
  telefone: "telefone",
  exame: "exame",
  plano: "plano",
  particular: "particular",
  data: "data",
  hora: "hora",
  status: "status",
};

router.put("/agendamentos/:id", asyncHandler(async (req, res) => {
  const sets = [];
  const values = [];
  for (const [key, coluna] of Object.entries(CAMPOS_AGENDAMENTO)) {
    if (req.body[key] !== undefined) {
      const valor = (key === "plano" || key === "particular") ? (req.body[key] ? 1 : 0) : req.body[key];
      values.push(valor);
      sets.push(`${coluna} = $${values.length}`);
    }
  }
  if (sets.length === 0) return res.status(400).json({ erro: "Nenhum campo reconhecido para atualizar." });
  values.push(req.params.id, req.clinicaId);
  await db.query(
    `update agendamento set ${sets.join(", ")} where id = $${values.length - 1} and clinica_id = $${values.length}`,
    values
  );
  const { rows } = await db.query("select * from agendamento where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  if (!rows[0]) return res.status(404).end();
  res.json(rows[0]);
}));

// Remarcar cria um novo agendamento na nova data e liga o original a ele —
// é assim que o "link para o dia remarcado" funciona.
router.put("/agendamentos/:id/remarcar", asyncHandler(async (req, res) => {
  const { novaData, novaHora } = req.body;
  if (!novaData) return res.status(400).json({ erro: "novaData é obrigatória." });

  const { rows: atuais } = await db.query("select * from agendamento where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  const original = atuais[0];
  if (!original) return res.status(404).end();

  const novoId = uuid();
  await db.query(
    `insert into agendamento (id, clinica_id, nome, telefone, exame, plano, particular, data, hora, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'aguardando')`,
    [novoId, req.clinicaId, original.nome, original.telefone, original.exame, original.plano, original.particular, novaData, novaHora || null]
  );
  await db.query(
    "update agendamento set status = 'remarcado', remarcado_para_id = $1 where id = $2",
    [novoId, req.params.id]
  );

  const { rows } = await db.query("select * from agendamento where id = $1", [novoId]);
  res.status(201).json(rows[0]);
}));

router.delete("/agendamentos/:id", asyncHandler(async (req, res) => {
  await db.query("delete from agendamento where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

// ---------------------------------------------------------------------------
// Financeiro avançado — convênios, contas a receber/pagar, glosas, DRE.
// Segue o mapa mestre (módulos 07 e 08).
// ---------------------------------------------------------------------------

// ---- Convênios ----
router.get("/convenios", asyncHandler(async (req, res) => {
  const { rows } = await db.query("select * from convenio where clinica_id = $1 order by nome", [req.clinicaId]);
  res.json(rows);
}));

router.post("/convenios", podeEditar, asyncHandler(async (req, res) => {
  const { nome, cnpj, telefone, email, responsavel, prazoMedioDias } = req.body;
  const id = uuid();
  await db.query(
    "insert into convenio (id, clinica_id, nome, cnpj, telefone, email, responsavel, prazo_medio_dias) values ($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, req.clinicaId, nome, cnpj || null, telefone || null, email || null, responsavel || null, prazoMedioDias ?? 30]
  );
  const { rows } = await db.query("select * from convenio where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

router.put("/convenios/:id", podeEditar, asyncHandler(async (req, res) => {
  const { nome, cnpj, telefone, email, responsavel, prazoMedioDias, ativo } = req.body;
  await db.query(
    `update convenio set
       nome = coalesce($1, nome), cnpj = coalesce($2, cnpj), telefone = coalesce($3, telefone),
       email = coalesce($4, email), responsavel = coalesce($5, responsavel),
       prazo_medio_dias = coalesce($6, prazo_medio_dias), ativo = coalesce($7, ativo)
     where id = $8 and clinica_id = $9`,
    [nome ?? null, cnpj ?? null, telefone ?? null, email ?? null, responsavel ?? null, prazoMedioDias ?? null, ativo === undefined ? null : (ativo ? 1 : 0), req.params.id, req.clinicaId]
  );
  const { rows } = await db.query("select * from convenio where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  if (!rows[0]) return res.status(404).end();
  res.json(rows[0]);
}));

router.delete("/convenios/:id", podeEditar, asyncHandler(async (req, res) => {
  await db.query("delete from convenio where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

// ---- Tabela de preços por convênio (com vigência/histórico) ----
router.get("/convenios/:id/precos", asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `select ctp.*, p.nome as procedimento_nome from convenio_tabela_preco ctp
     join procedimento p on p.id = ctp.procedimento_id
     where ctp.convenio_id = $1 order by p.nome, ctp.vigencia_inicio desc`,
    [req.params.id]
  );
  res.json(rows);
}));

// Sempre INSERE uma nova vigência — nunca sobrescreve a anterior, porque
// exames antigos precisam continuar lendo o valor que estava valendo na
// data em que foram feitos (regra do mapa: "congelar a regra comercial").
router.post("/convenios/:id/precos", podeEditar, asyncHandler(async (req, res) => {
  const { procedimentoId, valor, vigenciaInicio } = req.body;
  const id = uuid();
  await db.query(
    "insert into convenio_tabela_preco (id, convenio_id, procedimento_id, valor, vigencia_inicio) values ($1,$2,$3,$4,$5)",
    [id, req.params.id, procedimentoId, valor, vigenciaInicio || new Date().toISOString().slice(0, 10)]
  );
  const { rows } = await db.query("select * from convenio_tabela_preco where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

// Valor vigente de um procedimento para um convênio numa data — é isto que
// o lançamento de conta a receber usa pra "congelar" o preço do exame.
async function precoVigente(convenioId, procedimentoId, data) {
  const { rows } = await db.query(
    `select valor from convenio_tabela_preco
     where convenio_id = $1 and procedimento_id = $2 and vigencia_inicio <= $3
     order by vigencia_inicio desc limit 1`,
    [convenioId, procedimentoId, data]
  );
  return rows[0] ? Number(rows[0].valor) : null;
}

// ---- Despesas recorrentes ----
router.get("/despesas-recorrentes", asyncHandler(async (req, res) => {
  const { rows } = await db.query("select * from despesa_recorrente where clinica_id = $1 order by descricao", [req.clinicaId]);
  res.json(rows);
}));

router.post("/despesas-recorrentes", podeEditar, asyncHandler(async (req, res) => {
  const { descricao, categoria, fornecedor, valor, diaVencimento } = req.body;
  const id = uuid();
  await db.query(
    "insert into despesa_recorrente (id, clinica_id, descricao, categoria, fornecedor, valor, dia_vencimento) values ($1,$2,$3,$4,$5,$6,$7)",
    [id, req.clinicaId, descricao, categoria || null, fornecedor || null, valor, diaVencimento ?? 5]
  );
  const { rows } = await db.query("select * from despesa_recorrente where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

router.delete("/despesas-recorrentes/:id", podeEditar, asyncHandler(async (req, res) => {
  await db.query("delete from despesa_recorrente where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

// Gera os lançamentos de conta a pagar do mês pedido, pra cada despesa
// recorrente ativa — idempotente: não duplica se já rodou pra aquele mês.
router.post("/despesas-recorrentes/gerar", podeEditar, asyncHandler(async (req, res) => {
  const { mes } = req.body; // "YYYY-MM"
  if (!mes) return res.status(400).json({ erro: "mes (AAAA-MM) é obrigatório." });
  const { rows: recorrentes } = await db.query("select * from despesa_recorrente where clinica_id = $1 and ativa = 1", [req.clinicaId]);
  const criados = [];
  for (const r of recorrentes) {
    const { rows: existentes } = await db.query(
      "select id from conta_pagar where recorrente_id = $1 and vencimento like $2",
      [r.id, `${mes}%`]
    );
    if (existentes.length > 0) continue;
    const dia = String(r.dia_vencimento).padStart(2, "0");
    const vencimento = `${mes}-${dia}`;
    const id = uuid();
    await db.query(
      "insert into conta_pagar (id, clinica_id, descricao, categoria, fornecedor, valor, vencimento, recorrente_id) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, req.clinicaId, r.descricao, r.categoria, r.fornecedor, r.valor, vencimento, r.id]
    );
    criados.push(id);
  }
  res.status(201).json({ gerados: criados.length });
}));

// ---- Contas a pagar ----
router.get("/contas-pagar", asyncHandler(async (req, res) => {
  const { status, mes } = req.query;
  const condicoes = ["clinica_id = $1"];
  const valores = [req.clinicaId];
  if (status) { valores.push(status); condicoes.push(`status = $${valores.length}`); }
  if (mes) { valores.push(`${mes}%`); condicoes.push(`vencimento like $${valores.length}`); }
  const { rows } = await db.query(`select * from conta_pagar where ${condicoes.join(" and ")} order by vencimento`, valores);
  res.json(rows);
}));

router.post("/contas-pagar", podeEditar, asyncHandler(async (req, res) => {
  const { descricao, categoria, fornecedor, valor, vencimento } = req.body;
  const id = uuid();
  await db.query(
    "insert into conta_pagar (id, clinica_id, descricao, categoria, fornecedor, valor, vencimento) values ($1,$2,$3,$4,$5,$6,$7)",
    [id, req.clinicaId, descricao, categoria || null, fornecedor || null, valor, vencimento]
  );
  const { rows } = await db.query("select * from conta_pagar where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

router.put("/contas-pagar/:id", podeEditar, asyncHandler(async (req, res) => {
  const { status, dataPagamento } = req.body;
  await db.query(
    "update conta_pagar set status = coalesce($1, status), data_pagamento = coalesce($2, data_pagamento) where id = $3 and clinica_id = $4",
    [status ?? null, dataPagamento ?? null, req.params.id, req.clinicaId]
  );
  const { rows } = await db.query("select * from conta_pagar where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  if (!rows[0]) return res.status(404).end();
  res.json(rows[0]);
}));

router.delete("/contas-pagar/:id", podeEditar, asyncHandler(async (req, res) => {
  await db.query("delete from conta_pagar where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

// ---- Contas a receber ----
router.get("/contas-receber", asyncHandler(async (req, res) => {
  const { status, mes, convenioId } = req.query;
  const condicoes = ["cr.clinica_id = $1"];
  const valores = [req.clinicaId];
  if (status) { valores.push(status); condicoes.push(`cr.status = $${valores.length}`); }
  if (mes) { valores.push(`${mes}%`); condicoes.push(`cr.data_exame like $${valores.length}`); }
  if (convenioId) { valores.push(convenioId); condicoes.push(`cr.convenio_id = $${valores.length}`); }
  const { rows } = await db.query(
    `select cr.*, c.nome as convenio_nome, p.nome as procedimento_nome
     from conta_receber cr
     left join convenio c on c.id = cr.convenio_id
     left join procedimento p on p.id = cr.procedimento_id
     where ${condicoes.join(" and ")} order by cr.data_exame desc`,
    valores
  );
  res.json(rows);
}));

// Cria o lançamento. Se vier convenioId + procedimentoId e valorFaturado não
// for informado, o sistema busca o preço vigente naquele convênio na data
// do exame — é a regra de "congelar a tabela" do mapa mestre.
router.post("/contas-receber", asyncHandler(async (req, res) => {
  const { pacienteNome, procedimentoId, convenioId, dentistaSolicitante, dataExame, vencimento } = req.body;
  let { valorFaturado } = req.body;

  if (valorFaturado === undefined && convenioId && procedimentoId) {
    valorFaturado = await precoVigente(convenioId, procedimentoId, dataExame);
    if (valorFaturado === null) {
      return res.status(400).json({ erro: "Não há preço cadastrado para esse convênio + procedimento nessa data. Cadastre na tabela de preços do convênio ou informe valorFaturado manualmente." });
    }
  }
  if (valorFaturado === undefined) return res.status(400).json({ erro: "valorFaturado é obrigatório (ou informe convenioId + procedimentoId com tabela cadastrada)." });

  const id = uuid();
  await db.query(
    `insert into conta_receber (id, clinica_id, paciente_nome, procedimento_id, convenio_id, dentista_solicitante, data_exame, valor_faturado, vencimento)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, req.clinicaId, pacienteNome || null, procedimentoId || null, convenioId || null, dentistaSolicitante || null, dataExame, valorFaturado, vencimento || null]
  );
  const { rows } = await db.query("select * from conta_receber where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

router.put("/contas-receber/:id", podeEditar, asyncHandler(async (req, res) => {
  const { status, valorPago, dataRecebimento } = req.body;
  await db.query(
    `update conta_receber set
       status = coalesce($1, status), valor_pago = coalesce($2, valor_pago), data_recebimento = coalesce($3, data_recebimento)
     where id = $4 and clinica_id = $5`,
    [status ?? null, valorPago ?? null, dataRecebimento ?? null, req.params.id, req.clinicaId]
  );
  const { rows } = await db.query("select * from conta_receber where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  if (!rows[0]) return res.status(404).end();
  res.json(rows[0]);
}));

router.delete("/contas-receber/:id", podeEditar, asyncHandler(async (req, res) => {
  await db.query("delete from conta_receber where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

// ---- Glosas ----
router.get("/glosas", asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `select g.*, cr.paciente_nome, cr.valor_faturado, cr.data_exame, c.nome as convenio_nome
     from glosa g
     join conta_receber cr on cr.id = g.conta_receber_id
     left join convenio c on c.id = cr.convenio_id
     where cr.clinica_id = $1 order by g.criado_em desc`,
    [req.clinicaId]
  );
  res.json(rows);
}));

router.post("/contas-receber/:id/glosa", podeEditar, asyncHandler(async (req, res) => {
  const { valor, motivo } = req.body;
  const id = uuid();
  await db.query("insert into glosa (id, conta_receber_id, valor, motivo) values ($1,$2,$3,$4)", [id, req.params.id, valor, motivo || null]);
  const { rows } = await db.query("select * from glosa where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

router.put("/glosas/:id", podeEditar, asyncHandler(async (req, res) => {
  const { status, valorRecuperado } = req.body;
  await db.query(
    "update glosa set status = coalesce($1, status), valor_recuperado = coalesce($2, valor_recuperado) where id = $3",
    [status ?? null, valorRecuperado ?? null, req.params.id]
  );
  const { rows } = await db.query("select * from glosa where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).end();
  res.json(rows[0]);
}));

// ---- Dashboard financeiro ----
router.get("/financeiro/resumo", asyncHandler(async (req, res) => {
  const { mes } = req.query; // "YYYY-MM"
  if (!mes) return res.status(400).json({ erro: "mes (AAAA-MM) é obrigatório." });

  const [receberMes, pagarMes, receberAberto, pagarAberto] = await Promise.all([
    db.query(
      `select cr.*, c.nome as convenio_nome from conta_receber cr left join convenio c on c.id = cr.convenio_id
       where cr.clinica_id = $1 and cr.data_exame like $2`,
      [req.clinicaId, `${mes}%`]
    ),
    db.query("select * from conta_pagar where clinica_id = $1 and vencimento like $2", [req.clinicaId, `${mes}%`]),
    db.query("select * from conta_receber where clinica_id = $1 and status in ('aberto','vencido','parcial')", [req.clinicaId]),
    db.query("select * from conta_pagar where clinica_id = $1 and status in ('aberto','vencido')", [req.clinicaId]),
  ]);

  const receitas = receberMes.rows.filter((r) => r.status === "recebido" || r.status === "parcial").reduce((s, r) => s + Number(r.valor_pago ?? r.valor_faturado), 0);
  const despesasPagas = pagarMes.rows.filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0);
  const aReceber = receberAberto.rows.reduce((s, r) => s + Number(r.valor_faturado), 0);
  const aPagar = pagarAberto.rows.reduce((s, p) => s + Number(p.valor), 0);
  const inadimplencia = receberAberto.rows.filter((r) => r.status === "vencido").reduce((s, r) => s + Number(r.valor_faturado), 0);

  const porOrigem = {};
  for (const r of receberMes.rows) {
    const chave = r.convenio_nome || "Particular";
    porOrigem[chave] = (porOrigem[chave] || 0) + Number(r.valor_pago ?? r.valor_faturado);
  }

  res.json({
    receitas,
    despesas: despesasPagas,
    resultado: receitas - despesasPagas,
    aReceber,
    aPagar,
    inadimplencia,
    receitaPorOrigem: Object.entries(porOrigem).map(([origem, valor]) => ({ origem, valor })),
  });
}));

// ---- DRE gerencial ----
router.get("/financeiro/dre", asyncHandler(async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(400).json({ erro: "mes (AAAA-MM) é obrigatório." });

  const [{ rows: config }, { rows: receber }, { rows: despesas }, { rows: ativos }] = await Promise.all([
    db.query("select * from financeiro_config where clinica_id = $1", [req.clinicaId]),
    db.query("select * from conta_receber where clinica_id = $1 and data_exame like $2", [req.clinicaId, `${mes}%`]),
    db.query("select valor from despesa_fixa where clinica_id = $1", [req.clinicaId]),
    db.query("select valor_aquisicao, vida_util_anos from ativo where clinica_id = $1", [req.clinicaId]),
  ]);
  const aliquota = config[0] ? Number(config[0].aliquota_impostos_pct) : 0.06;

  const receitaBruta = receber.reduce((s, r) => s + Number(r.valor_faturado), 0);
  const { rows: glosasDoMes } = await db.query(
    `select g.valor from glosa g join conta_receber cr on cr.id = g.conta_receber_id
     where cr.clinica_id = $1 and cr.data_exame like $2`,
    [req.clinicaId, `${mes}%`]
  );
  const glosas = glosasDoMes.reduce((s, g) => s + Number(g.valor), 0);

  // custo variável aproximado: custo de insumos dos procedimentos faturados no mês
  let custosVariaveis = 0;
  for (const r of receber) {
    if (!r.procedimento_id) continue;
    const { rows: itens } = await db.query(
      `select pi.quantidade, i.valor_total, i.quantidade as insumo_quantidade
       from procedimento_insumo pi join insumo i on i.id = pi.insumo_id where pi.procedimento_id = $1`,
      [r.procedimento_id]
    );
    custosVariaveis += itens.reduce((s, it) => s + Number(it.quantidade) * (Number(it.insumo_quantidade) ? Number(it.valor_total) / Number(it.insumo_quantidade) : 0), 0);
  }

  const despesasFixas = despesas.reduce((s, d) => s + Number(d.valor), 0) +
    ativos.reduce((s, a) => s + (Number(a.vida_util_anos) > 0 ? Number(a.valor_aquisicao) / Number(a.vida_util_anos) / 12 : 0), 0);

  const dre = calcularDRE({ receitaBruta, glosas, aliquotaImpostos: aliquota, custosVariaveis, despesasFixas });
  res.json(dre);
}));

// ---- Rentabilidade agrupada (por exame ou por convênio) ----
router.get("/financeiro/rentabilidade", asyncHandler(async (req, res) => {
  const { mes, agrupar } = req.query; // agrupar: "procedimento" | "convenio"
  if (!mes) return res.status(400).json({ erro: "mes (AAAA-MM) é obrigatório." });

  const { rows: receber } = await db.query(
    `select cr.*, p.nome as procedimento_nome, c.nome as convenio_nome
     from conta_receber cr
     left join procedimento p on p.id = cr.procedimento_id
     left join convenio c on c.id = cr.convenio_id
     where cr.clinica_id = $1 and cr.data_exame like $2`,
    [req.clinicaId, `${mes}%`]
  );

  const lancamentos = [];
  for (const r of receber) {
    let custo = 0;
    if (r.procedimento_id) {
      const { rows: itens } = await db.query(
        `select pi.quantidade, i.valor_total, i.quantidade as insumo_quantidade
         from procedimento_insumo pi join insumo i on i.id = pi.insumo_id where pi.procedimento_id = $1`,
        [r.procedimento_id]
      );
      custo = itens.reduce((s, it) => s + Number(it.quantidade) * (Number(it.insumo_quantidade) ? Number(it.valor_total) / Number(it.insumo_quantidade) : 0), 0);
    }
    const chave = agrupar === "convenio" ? (r.convenio_nome || "Particular") : agrupar === "dentista" ? (r.dentista_solicitante || "(não informado)") : (r.procedimento_nome || "(sem procedimento)");
    lancamentos.push({ chave, receita: Number(r.valor_faturado), custo });
  }

  res.json(agruparRentabilidade(lancamentos));
}));

// ---- Fluxo de caixa projetado (próximos N dias) ----
router.get("/financeiro/fluxo-projetado", asyncHandler(async (req, res) => {
  const dias = Number(req.query.dias) || 30;
  const hoje = new Date();
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + dias);
  const hojeStr = hoje.toISOString().slice(0, 10);
  const limiteStr = limite.toISOString().slice(0, 10);

  const [{ rows: receber }, { rows: pagar }] = await Promise.all([
    db.query("select * from conta_receber where clinica_id = $1 and status = 'aberto' and vencimento between $2 and $3", [req.clinicaId, hojeStr, limiteStr]),
    db.query("select * from conta_pagar where clinica_id = $1 and status = 'aberto' and vencimento between $2 and $3", [req.clinicaId, hojeStr, limiteStr]),
  ]);
  res.json({ dias, ...calcularFluxoProjetado(receber, pagar) });
}));

// ---- Rentabilidade por hora de equipamento ----
router.get("/financeiro/rentabilidade-equipamento", asyncHandler(async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(400).json({ erro: "mes (AAAA-MM) é obrigatório." });

  const { rows: ativos } = await db.query("select id, nome from ativo where clinica_id = $1", [req.clinicaId]);
  const resultado = [];
  for (const ativo of ativos) {
    const { rows: receber } = await db.query(
      `select cr.valor_faturado, p.tempo_minutos, p.id as procedimento_id
       from conta_receber cr join procedimento p on p.id = cr.procedimento_id
       where cr.clinica_id = $1 and cr.data_exame like $2 and p.equipamento_id = $3`,
      [req.clinicaId, `${mes}%`, ativo.id]
    );
    if (receber.length === 0) continue;
    let receitaTotal = 0, custoTotal = 0, minutosTotais = 0;
    for (const r of receber) {
      receitaTotal += Number(r.valor_faturado);
      minutosTotais += Number(r.tempo_minutos);
      const { rows: itens } = await db.query(
        `select pi.quantidade, i.valor_total, i.quantidade as insumo_quantidade
         from procedimento_insumo pi join insumo i on i.id = pi.insumo_id where pi.procedimento_id = $1`,
        [r.procedimento_id]
      );
      custoTotal += itens.reduce((s, it) => s + Number(it.quantidade) * (Number(it.insumo_quantidade) ? Number(it.valor_total) / Number(it.insumo_quantidade) : 0), 0);
    }
    resultado.push({ equipamento: ativo.nome, quantidade: receber.length, receitaTotal, custoTotal, ...calcularPorHora(receitaTotal, custoTotal, minutosTotais) });
  }
  res.json(resultado);
}));

// ---- Lotes de faturamento (produção -> conferência -> fechamento) ----
router.get("/convenios/:id/producao", asyncHandler(async (req, res) => {
  const { periodoInicio, periodoFim } = req.query;
  if (!periodoInicio || !periodoFim) return res.status(400).json({ erro: "periodoInicio e periodoFim são obrigatórios." });
  const { rows } = await db.query(
    `select cr.*, p.nome as procedimento_nome from conta_receber cr left join procedimento p on p.id = cr.procedimento_id
     where cr.clinica_id = $1 and cr.convenio_id = $2 and cr.lote_id is null
       and cr.data_exame between $3 and $4 and cr.status != 'cancelado'
     order by cr.data_exame`,
    [req.clinicaId, req.params.id, periodoInicio, periodoFim]
  );
  // Conferência simplificada: aponta pendências antes de deixar fechar o lote.
  const comPendencia = rows.map((r) => {
    const pendencias = [];
    if (!r.paciente_nome) pendencias.push("paciente não informado");
    if (!r.procedimento_id) pendencias.push("procedimento não informado");
    if (!r.valor_faturado || Number(r.valor_faturado) <= 0) pendencias.push("valor inválido");
    return { ...r, pendencias };
  });
  res.json(comPendencia);
}));

router.post("/convenios/:id/lotes", podeEditar, asyncHandler(async (req, res) => {
  const { periodoInicio, periodoFim } = req.body;
  if (!periodoInicio || !periodoFim) return res.status(400).json({ erro: "periodoInicio e periodoFim são obrigatórios." });

  const { rows: elegveis } = await db.query(
    `select * from conta_receber where clinica_id = $1 and convenio_id = $2 and lote_id is null
       and data_exame between $3 and $4 and status != 'cancelado'
       and paciente_nome is not null and procedimento_id is not null and valor_faturado > 0`,
    [req.clinicaId, req.params.id, periodoInicio, periodoFim]
  );
  if (elegveis.length === 0) return res.status(400).json({ erro: "Nenhum exame elegível nesse período (ou todos têm pendência de conferência)." });

  const valor = elegveis.reduce((s, c) => s + Number(c.valor_faturado), 0);
  const loteId = uuid();
  await db.query(
    "insert into lote_faturamento (id, clinica_id, convenio_id, periodo_inicio, periodo_fim, quantidade, valor, usuario_id) values ($1,$2,$3,$4,$5,$6,$7,$8)",
    [loteId, req.clinicaId, req.params.id, periodoInicio, periodoFim, elegveis.length, valor, req.usuarioId]
  );
  for (const c of elegveis) {
    await db.query("update conta_receber set lote_id = $1 where id = $2", [loteId, c.id]);
  }
  const { rows } = await db.query("select * from lote_faturamento where id = $1", [loteId]);
  res.status(201).json(rows[0]);
}));

router.get("/lotes", asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `select l.*, c.nome as convenio_nome from lote_faturamento l join convenio c on c.id = l.convenio_id
     where l.clinica_id = $1 order by l.fechado_em desc`,
    [req.clinicaId]
  );
  res.json(rows);
}));

router.get("/lotes/:id/contas", asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `select cr.*, p.nome as procedimento_nome from conta_receber cr left join procedimento p on p.id = cr.procedimento_id
     where cr.lote_id = $1 order by cr.data_exame`,
    [req.params.id]
  );
  res.json(rows);
}));

// ---- Movimentos bancários e conciliação ----
router.get("/movimentos-bancarios", asyncHandler(async (req, res) => {
  const { mes } = req.query;
  const condicoes = ["clinica_id = $1"];
  const valores = [req.clinicaId];
  if (mes) { valores.push(`${mes}%`); condicoes.push(`data like $${valores.length}`); }
  const { rows } = await db.query(`select * from movimento_bancario where ${condicoes.join(" and ")} order by data desc`, valores);
  res.json(rows);
}));

router.post("/movimentos-bancarios", podeEditar, asyncHandler(async (req, res) => {
  const { data, descricao, valor } = req.body;
  const id = uuid();
  await db.query("insert into movimento_bancario (id, clinica_id, data, descricao, valor) values ($1,$2,$3,$4,$5)", [id, req.clinicaId, data, descricao || null, valor]);
  const { rows } = await db.query("select * from movimento_bancario where id = $1", [id]);
  res.status(201).json(rows[0]);
}));

router.delete("/movimentos-bancarios/:id", podeEditar, asyncHandler(async (req, res) => {
  await db.query("delete from movimento_bancario where id = $1 and clinica_id = $2", [req.params.id, req.clinicaId]);
  res.status(204).end();
}));

router.get("/financeiro/conciliacao", asyncHandler(async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(400).json({ erro: "mes (AAAA-MM) é obrigatório." });

  const [{ rows: recebidos }, { rows: pagos }, { rows: movimentos }] = await Promise.all([
    db.query("select valor_pago, valor_faturado from conta_receber where clinica_id = $1 and status = 'recebido' and data_recebimento like $2", [req.clinicaId, `${mes}%`]),
    db.query("select valor from conta_pagar where clinica_id = $1 and status = 'pago' and data_pagamento like $2", [req.clinicaId, `${mes}%`]),
    db.query("select valor from movimento_bancario where clinica_id = $1 and data like $2", [req.clinicaId, `${mes}%`]),
  ]);
  const recebidoSistema = recebidos.reduce((s, r) => s + Number(r.valor_pago ?? r.valor_faturado), 0);
  const pagoSistema = pagos.reduce((s, p) => s + Number(p.valor), 0);
  const entradasBanco = movimentos.filter((m) => Number(m.valor) > 0).reduce((s, m) => s + Number(m.valor), 0);
  const saidasBanco = movimentos.filter((m) => Number(m.valor) < 0).reduce((s, m) => s + Math.abs(Number(m.valor)), 0);

  res.json(calcularConciliacao({ recebidoSistema, pagoSistema, entradasBanco, saidasBanco }));
}));

// Error handler global — qualquer erro cai aqui em vez de derrubar o processo.
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno ao processar a requisição." });
});

module.exports = { router };
