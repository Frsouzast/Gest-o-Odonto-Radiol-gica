-- Schema do sistema de precificação — versão SQLite (arquivo único local).
-- Diferenças do schema Postgres original:
--   * ids são TEXT (UUID gerado em JS com crypto.randomUUID(), não no banco)
--   * sem "returning": o código sempre confere o resultado com um SELECT
--     depois, porque nem toda build do SQLite embutido suporta RETURNING
--   * booleano vira INTEGER (0/1), datas viram TEXT (ISO 8601)

create table clinica (
  id text primary key,
  nome text not null,
  cnpj text,
  criado_em text not null default (datetime('now'))
);

create table usuario (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  nome text not null,
  email text not null unique,
  senha_hash text not null,
  papel text not null check (papel in ('dono', 'financeiro', 'recepcao')),
  criado_em text not null default (datetime('now'))
);

create table capacidade_produtiva (
  clinica_id text primary key references clinica(id) on delete cascade,
  dias_trabalhados integer not null default 24,
  horas_por_dia real not null default 8,
  unidades_renda real not null default 1,
  percent_ocupacao real not null default 0.75
);

create table despesa_fixa (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  nome text not null,
  valor real not null default 0,
  ordem integer not null default 0
);

create table ativo (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  nome text not null,
  data_aquisicao text,
  valor_aquisicao real not null default 0,
  vida_util_anos real not null default 1
);

create table funcionario (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  cargo text not null,
  quantidade real not null default 1,
  valor_unitario real not null default 0,
  encargos_pct real not null default 0,
  beneficios real not null default 0
);

create table insumo (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  nome text not null,
  unidade text not null default 'un',
  valor_total real not null default 0,
  quantidade real not null default 1
);

create table procedimento (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  nome text not null,
  tempo_minutos real not null default 0,
  laudos real not null default 0,
  retrabalho_pct real not null default 0.03,
  comissao_pct real not null default 0,
  lucro_desejado_pct real not null default 0.3,
  inadimplencia_pct real not null default 0.03,
  impostos_pct real not null default 0.15,
  taxa_cartao_pct real not null default 0.03,
  outros_pct real not null default 0,
  preco_concorrencia real,
  preco_final real,
  ativo integer not null default 1
);

create table procedimento_insumo (
  procedimento_id text not null references procedimento(id) on delete cascade,
  insumo_id text not null references insumo(id) on delete restrict,
  quantidade real not null default 1,
  primary key (procedimento_id, insumo_id)
);

create table historico_preco (
  id text primary key,
  procedimento_id text not null references procedimento(id) on delete cascade,
  usuario_id text references usuario(id),
  preco_anterior real,
  preco_novo real,
  alterado_em text not null default (datetime('now'))
);

create index idx_despesa_clinica on despesa_fixa (clinica_id);
create index idx_insumo_clinica on insumo (clinica_id);
create index idx_procedimento_clinica on procedimento (clinica_id);
create index idx_pi_insumo on procedimento_insumo (insumo_id);
create index idx_historico_proc on historico_preco (procedimento_id);
