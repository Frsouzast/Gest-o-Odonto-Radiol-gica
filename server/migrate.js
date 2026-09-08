const fs = require("fs");
const path = require("path");

async function migrar(db) {
  await db.query(`
    create table if not exists _migrations (
      nome text primary key,
      aplicada_em text not null default (datetime('now'))
    )
  `);

  const { rows } = await db.query("select nome from _migrations");
  const jaAplicadas = new Set(rows.map((r) => r.nome));

  const dir = path.join(__dirname, "migrations");
  const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const arquivo of arquivos) {
    if (jaAplicadas.has(arquivo)) continue;
    console.log(`→ aplicando ${arquivo}...`);
    const sql = fs.readFileSync(path.join(dir, arquivo), "utf8");
    await db.runScript(sql);
    await db.query("insert into _migrations (nome) values ($1)", [arquivo]);
    console.log(`✓ ${arquivo} aplicada`);
  }
}

module.exports = { migrar };
