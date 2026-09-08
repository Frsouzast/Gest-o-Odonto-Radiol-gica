-- Agenda de pacientes.
-- "remarcado_para_id" aponta para o novo agendamento criado quando o
-- original é remarcado para outro dia — é o "link" entre os dois.
create table agendamento (
  id text primary key,
  clinica_id text not null references clinica(id) on delete cascade,
  nome text not null,
  telefone text,
  exame text,
  plano integer not null default 0,
  particular integer not null default 0,
  data text not null,
  hora text,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'atendido', 'faltou', 'desmarcou', 'remarcado')),
  remarcado_para_id text references agendamento(id),
  criado_em text not null default (datetime('now'))
);

create index idx_agendamento_clinica_data on agendamento (clinica_id, data);
