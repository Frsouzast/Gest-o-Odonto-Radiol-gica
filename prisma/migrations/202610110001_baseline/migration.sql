-- CreateTable
CREATE TABLE "clinica" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuario_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "capacidade_produtiva" (
    "clinica_id" TEXT NOT NULL PRIMARY KEY,
    "dias_trabalhados" INTEGER NOT NULL DEFAULT 24,
    "horas_por_dia" REAL NOT NULL DEFAULT 8,
    "unidades_renda" REAL NOT NULL DEFAULT 1,
    "percent_ocupacao" REAL NOT NULL DEFAULT 0.75,
    CONSTRAINT "capacidade_produtiva_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "despesa_fixa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" REAL NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "despesa_fixa_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ativo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "data_aquisicao" TEXT,
    "valor_aquisicao" REAL NOT NULL DEFAULT 0,
    "vida_util_anos" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "ativo_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "funcionario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "quantidade" REAL NOT NULL DEFAULT 1,
    "valor_unitario" REAL NOT NULL DEFAULT 0,
    "encargos_pct" REAL NOT NULL DEFAULT 0,
    "beneficios" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "funcionario_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "insumo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "valor_total" REAL NOT NULL DEFAULT 0,
    "quantidade" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "insumo_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "procedimento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tempo_minutos" REAL NOT NULL DEFAULT 0,
    "laudos" REAL NOT NULL DEFAULT 0,
    "retrabalho_pct" REAL NOT NULL DEFAULT 0.03,
    "comissao_pct" REAL NOT NULL DEFAULT 0,
    "lucro_desejado_pct" REAL NOT NULL DEFAULT 0.3,
    "inadimplencia_pct" REAL NOT NULL DEFAULT 0.03,
    "impostos_pct" REAL NOT NULL DEFAULT 0.15,
    "taxa_cartao_pct" REAL NOT NULL DEFAULT 0.03,
    "outros_pct" REAL NOT NULL DEFAULT 0,
    "preco_concorrencia" REAL,
    "preco_final" REAL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "equipamento_id" TEXT,
    CONSTRAINT "procedimento_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "procedimento_equipamento_id_fkey" FOREIGN KEY ("equipamento_id") REFERENCES "ativo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "procedimento_insumo" (
    "procedimento_id" TEXT NOT NULL,
    "insumo_id" TEXT NOT NULL,
    "quantidade" REAL NOT NULL DEFAULT 1,

    PRIMARY KEY ("procedimento_id", "insumo_id"),
    CONSTRAINT "procedimento_insumo_procedimento_id_fkey" FOREIGN KEY ("procedimento_id") REFERENCES "procedimento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "procedimento_insumo_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "historico_preco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "procedimento_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "preco_anterior" REAL,
    "preco_novo" REAL,
    "alterado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historico_preco_procedimento_id_fkey" FOREIGN KEY ("procedimento_id") REFERENCES "procedimento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "historico_preco_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agendamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "exame" TEXT,
    "plano" BOOLEAN NOT NULL DEFAULT false,
    "particular" BOOLEAN NOT NULL DEFAULT false,
    "data" TEXT NOT NULL,
    "hora" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aguardando',
    "remarcado_para_id" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agendamento_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agendamento_remarcado_para_id_fkey" FOREIGN KEY ("remarcado_para_id") REFERENCES "agendamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "convenio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "responsavel" TEXT,
    "prazo_medio_dias" INTEGER NOT NULL DEFAULT 30,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "convenio_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "convenio_tabela_preco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "convenio_id" TEXT NOT NULL,
    "procedimento_id" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "vigencia_inicio" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "convenio_tabela_preco_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "convenio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "convenio_tabela_preco_procedimento_id_fkey" FOREIGN KEY ("procedimento_id") REFERENCES "procedimento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "despesa_recorrente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "fornecedor" TEXT,
    "valor" REAL NOT NULL,
    "dia_vencimento" INTEGER NOT NULL DEFAULT 5,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "despesa_recorrente_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conta_pagar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "fornecedor" TEXT,
    "valor" REAL NOT NULL,
    "vencimento" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "data_pagamento" TEXT,
    "recorrente_id" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conta_pagar_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conta_pagar_recorrente_id_fkey" FOREIGN KEY ("recorrente_id") REFERENCES "despesa_recorrente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conta_receber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "paciente_nome" TEXT,
    "procedimento_id" TEXT,
    "convenio_id" TEXT,
    "dentista_solicitante" TEXT,
    "data_exame" TEXT NOT NULL,
    "valor_faturado" REAL NOT NULL,
    "valor_pago" REAL,
    "vencimento" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "data_recebimento" TEXT,
    "lote_id" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conta_receber_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conta_receber_procedimento_id_fkey" FOREIGN KEY ("procedimento_id") REFERENCES "procedimento" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conta_receber_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "convenio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conta_receber_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote_faturamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "glosa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conta_receber_id" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "motivo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'glosada',
    "valor_recuperado" REAL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "glosa_conta_receber_id_fkey" FOREIGN KEY ("conta_receber_id") REFERENCES "conta_receber" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "financeiro_config" (
    "clinica_id" TEXT NOT NULL PRIMARY KEY,
    "aliquota_impostos_pct" REAL NOT NULL DEFAULT 0.06,
    "saldo_inicial_caixa" REAL NOT NULL DEFAULT 0,
    "data_saldo_inicial" TEXT,
    CONSTRAINT "financeiro_config_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lote_faturamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "convenio_id" TEXT NOT NULL,
    "periodo_inicio" TEXT NOT NULL,
    "periodo_fim" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor" REAL NOT NULL,
    "usuario_id" TEXT,
    "fechado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lote_faturamento_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lote_faturamento_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "convenio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movimento_bancario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinica_id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" REAL NOT NULL,
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "movimento_bancario_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "despesa_fixa_clinica_id_idx" ON "despesa_fixa"("clinica_id");

-- CreateIndex
CREATE INDEX "ativo_clinica_id_idx" ON "ativo"("clinica_id");

-- CreateIndex
CREATE INDEX "funcionario_clinica_id_idx" ON "funcionario"("clinica_id");

-- CreateIndex
CREATE INDEX "insumo_clinica_id_idx" ON "insumo"("clinica_id");

-- CreateIndex
CREATE INDEX "procedimento_clinica_id_idx" ON "procedimento"("clinica_id");

-- CreateIndex
CREATE INDEX "procedimento_insumo_insumo_id_idx" ON "procedimento_insumo"("insumo_id");

-- CreateIndex
CREATE INDEX "historico_preco_procedimento_id_idx" ON "historico_preco"("procedimento_id");

-- CreateIndex
CREATE INDEX "agendamento_clinica_id_data_idx" ON "agendamento"("clinica_id", "data");

-- CreateIndex
CREATE INDEX "convenio_clinica_id_idx" ON "convenio"("clinica_id");

-- CreateIndex
CREATE INDEX "convenio_tabela_preco_convenio_id_procedimento_id_vigencia_inicio_idx" ON "convenio_tabela_preco"("convenio_id", "procedimento_id", "vigencia_inicio");

-- CreateIndex
CREATE INDEX "despesa_recorrente_clinica_id_idx" ON "despesa_recorrente"("clinica_id");

-- CreateIndex
CREATE INDEX "conta_pagar_clinica_id_vencimento_idx" ON "conta_pagar"("clinica_id", "vencimento");

-- CreateIndex
CREATE INDEX "conta_receber_clinica_id_data_exame_idx" ON "conta_receber"("clinica_id", "data_exame");

-- CreateIndex
CREATE INDEX "conta_receber_convenio_id_idx" ON "conta_receber"("convenio_id");

-- CreateIndex
CREATE INDEX "glosa_conta_receber_id_idx" ON "glosa"("conta_receber_id");

-- CreateIndex
CREATE INDEX "lote_faturamento_convenio_id_idx" ON "lote_faturamento"("convenio_id");

-- CreateIndex
CREATE INDEX "movimento_bancario_clinica_id_data_idx" ON "movimento_bancario"("clinica_id", "data");
