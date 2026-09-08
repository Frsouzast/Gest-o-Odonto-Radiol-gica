const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

let SQL = null;
let db = null;
let dbPath = null;

async function init(filePath) {
  dbPath = filePath;
  SQL = await initSqlJs();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    db = new SQL.Database(fs.readFileSync(filePath));
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON;");
}

function persist() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

// $1, $2... (estilo Postgres) -> ? (estilo SQLite)
function paramsPgParaSqlite(sql) {
  return sql.replace(/\$\d+/g, "?");
}

async function query(sql, params = []) {
  if (!db) throw new Error("Banco não inicializado — chame init() antes de qualquer query.");
  const convertido = paramsPgParaSqlite(sql);
  const isLeitura = /^\s*select/i.test(sql);
  const stmt = db.prepare(convertido);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    if (!isLeitura) {
      persist();
      return { rows, rowCount: db.getRowsModified() };
    }
    return { rows, rowCount: rows.length };
  } finally {
    stmt.free();
  }
}

// Não existe pool de conexões de verdade aqui (é um arquivo só, sem
// concorrência de rede) — mas mantemos o mesmo formato connect()/release()
// que o server.js já usa para as transações, pra não precisar reescrever
// essa parte.
async function connect() {
  return { query, release: () => {} };
}

// db.prepare() só compila a PRIMEIRA instrução de uma string com várias —
// é assim que a API C do SQLite funciona. Migrações têm várias instruções
// (vários "create table") no mesmo arquivo, então usam db.run(), que
// executa a string inteira de uma vez (sem bind de parâmetros).
async function runScript(sql) {
  if (!db) throw new Error("Banco não inicializado — chame init() antes de qualquer query.");
  db.run(sql);
  persist();
}

module.exports = { init, query, connect, persist, runScript };
