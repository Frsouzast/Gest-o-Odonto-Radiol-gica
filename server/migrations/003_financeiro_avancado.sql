-- Módulo Financeiro avançado (convênios, contas a receber/pagar, glosas).
-- Segue o "MAPA_MESTRE_SUITE_GESTÃO_RADIOLOGIA": módulos 07 (Financeiro) e
-- 08 (Convênios e Faturamento) — núcleo, sem o workflow completo de lotes.

create table convenio (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  nome text not null,
  cnpj text,
  telefone text,
  email text,
  responsavel text,
  prazo_medio_dias integer not null default 30,
  ativo integer not null default 1
);
create index idx_convenio_clinica on convenio (clinica_id);

-- Tabela de preços por convênio e procedimento, com vigência — histórico
-- completo. Ao faturar, o sistema usa a vigência válida na data do exame,
-- nunca a mais recente, para não alterar exames já registrados quando o
-- convênio reajusta valores.
create table convenio_tabela_preco (
  id text primary key,
  convenio_id text not null references convenio(id) on delete cascade,
  procedimento_id text not null references procedimento(id) on delete cascade,
  valor real not null,
  vigencia_inicio text not null,
  criado_em text not null default (datetime('now'))
);
create index idx_ctp_busca on convenio_tabela_preco (convenio_id, procedimento_id, vigencia_inicio);

create table despesa_recorrente (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  descricao text not null,
  categoria text,
  fornecedor text,
  valor real not null,
  dia_vencimento integer not null default 5,
  ativa integer not null default 1
);

create table conta_pagar (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  descricao text not null,
  categoria text,
  fornecedor text,
  valor real not null,
  vencimento text not null,
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'vencido', 'cancelado')),
  data_pagamento text,
  recorrente_id text references despesa_recorrente(id),
  criado_em text not null default (datetime('now'))
);
create index idx_cp_clinica_venc on conta_pagar (clinica_id, vencimento);

-- Contas a receber: cada exame faturável vira um lançamento. convenio_id
-- nulo = particular. O valor_faturado já vem "congelado" da tabela de
-- preços vigente na data do exame (ou digitado direto, no caso particular).
create table conta_receber (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  paciente_nome text,
  procedimento_id text references procedimento(id),
  convenio_id text references convenio(id),
  dentista_solicitante text,
  data_exame text not null,
  valor_faturado real not null,
  valor_pago real,
  vencimento text,
  status text not null default 'aberto' check (status in ('aberto', 'recebido', 'vencido', 'parcial', 'cancelado')),
  data_recebimento text,
  criado_em text not null default (datetime('now'))
);
create index idx_cr_clinica_data on conta_receber (clinica_id, data_exame);
create index idx_cr_convenio on conta_receber (convenio_id);

-- Glosa vinculada diretamente ao lançamento que a originou — não só "o
-- convênio X glosou Y", mas exatamente qual exame.
create table glosa (
  id text primary key,
  conta_receber_id text not null references conta_receber(id) on delete cascade,
  valor real not null,
  motivo text,
  status text not null default 'glosada' check (status in ('glosada', 'em_recurso', 'recuperada', 'perdida')),
  valor_recuperado real,
  criado_em text not null default (datetime('now'))
);
create index idx_glosa_conta on glosa (conta_receber_id);

-- Parâmetros financeiros da clínica (alíquota pra DRE, saldo inicial do caixa).
create table financeiro_config (
  clinica_id text primary key references clinica(id) on delete cascade,
  aliquota_impostos_pct real not null default 0.06,
  saldo_inicial_caixa real not null default 0,
  data_saldo_inicial text
);
