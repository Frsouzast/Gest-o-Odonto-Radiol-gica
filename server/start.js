const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const { migrar } = require("./migrate");

/**
 * Prepara tudo que o app embutido precisa antes de aceitar requisições:
 * - gera (ou reaproveita) um segredo JWT único desta instalação, guardado
 *   dentro da própria pasta de dados do usuário — nunca em código-fonte
 * - inicializa o banco SQLite nessa mesma pasta
 * - roda as migrações pendentes
 *
 * @param {string} dadosDir pasta de dados do app (no Electron: app.getPath('userData'))
 * @returns {Promise<import('express').Express>}
 */
async function iniciarServidor(dadosDir) {
  fs.mkdirSync(dadosDir, { recursive: true });

  const segredoPath = path.join(dadosDir, "jwt.secret");
  if (!fs.existsSync(segredoPath)) {
    fs.writeFileSync(segredoPath, crypto.randomBytes(48).toString("hex"), { mode: 0o600 });
  }
  process.env.JWT_SECRET = fs.readFileSync(segredoPath, "utf8").trim();

  await db.init(path.join(dadosDir, "dados.sqlite"));
  await migrar(db);

  const express = require("express");
  const cors = require("cors");
  const { router } = require("./api");
  const app = express();
  // Libera qualquer origem de propósito: isto é uma ferramenta de rede local
  // (LAN), não exposta à internet. Um computador cliente carrega a tela via
  // file:// e chama a API em outro IP da mesma rede — sem isso, o navegador
  // do Electron bloquearia a chamada por CORS.
  app.use(cors());
  app.use(express.json());
  // Só o que está sob /api passa pelo middleware de autenticação (definido
  // dentro do router). Arquivos estáticos (HTML/CSS/JS do frontend) ficam
  // de fora dessa exigência — senão a própria página nunca carregaria.
  app.use("/api", router);
  return app;
}

module.exports = { iniciarServidor };
