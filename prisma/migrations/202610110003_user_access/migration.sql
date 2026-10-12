-- Tabela adicional: não modifica usuários ou dados legados.
-- Usuário sem registro nesta tabela permanece ativo por compatibilidade.
CREATE TABLE "usuario_acesso" (
    "usuario_id" TEXT NOT NULL PRIMARY KEY,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "usuario_acesso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
