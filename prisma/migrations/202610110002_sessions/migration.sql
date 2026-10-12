-- Additive migration: preserves all existing users and clinical records.
CREATE TABLE "sessao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expira_em" DATETIME NOT NULL,
    "revogada_em" DATETIME,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sessao_token_hash_key" ON "sessao"("token_hash");
CREATE INDEX "sessao_usuario_id_idx" ON "sessao"("usuario_id");
CREATE INDEX "sessao_expira_em_idx" ON "sessao"("expira_em");
