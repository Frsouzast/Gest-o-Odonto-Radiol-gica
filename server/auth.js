const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Em produção isto TEM que vir de uma variável de ambiente real e secreta.
// Gerar uma: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-troque-isto-em-producao";
const JWT_EXPIRES_IN = "7d";

function hashSenha(senha) {
  return bcrypt.hash(senha, 10);
}

function conferirSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}

function gerarToken({ usuarioId, clinicaId, papel }) {
  return jwt.sign({ usuarioId, clinicaId, papel }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET); // lança erro se inválido/expirado
}

module.exports = { hashSenha, conferirSenha, gerarToken, verificarToken };
