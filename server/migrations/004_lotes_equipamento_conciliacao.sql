-- Continuação do módulo Financeiro/Convênios: lotes de faturamento,
-- rentabilidade por equipamento, e conciliação bancária simplificada.

-- Cada procedimento pode estar vinculado a um equipamento (da tabela de
-- ativos/depreciação) — é o que permite calcular receita/lucro por hora
-- de uso do equipamento.
alter table procedimento add column equipamento_id text references ativo(id);

-- Lote de faturamento: agrupa várias contas a receber de um mesmo convênio
-- num período, no momento do fechamento (produção → conferência → lote).
create table lote_faturamento (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  convenio_id text not null references convenio(id),
  periodo_inicio text not null,
  periodo_fim text not null,
  quantidade integer not null,
  valor real not null,
  usuario_id text references usuario(id),
  fechado_em text not null default (datetime('now'))
);
create index idx_lote_convenio on lote_faturamento (convenio_id);

-- Marca quais contas a receber foram incluídas em qual lote — depois de
-- fechado, o lote não muda mais (auditoria).
alter table conta_receber add column lote_id text references lote_faturamento(id);

-- Movimentação bancária, lançada manualmente (importação de arquivo fica
-- para uma etapa futura, como o próprio mapa mestre recomenda). Serve pra
-- comparar contra os lançamentos do sistema na tela de conciliação.
create table movimento_bancario (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  data text not null,
  descricao text,
  valor real not null,
  conciliado integer not null default 0
);
create index idx_mov_bancario_clinica_data on movimento_bancario (clinica_id, data);
