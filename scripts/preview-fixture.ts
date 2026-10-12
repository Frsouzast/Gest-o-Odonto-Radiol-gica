/** Disposable, local-only UI fixture. Never connects to DATABASE_URL from .env. */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadMigrations } from "./migration-manifest";

const directory = await mkdtemp(join(tmpdir(), "odonto-ui-fixture-"));
const file = join(directory, "fictitious.db");
const databaseUrl = `file:${file.replaceAll("\\", "/")}`;
const client = createClient({ url: pathToFileURL(file).href });
try { for (const migration of await loadMigrations()) await client.executeMultiple(migration.sql); }
finally { client.close(); }
const orm = new PrismaClient({ datasourceUrl: databaseUrl });
try {
  await orm.clinica.create({ data: { id: "demo-clinic", nome: "Clínica fictícia — TESTE LOCAL" } });
  const senhaHash = await bcrypt.hash("Teste-Local-2026!", 10);
  for (const papel of ["dono", "financeiro", "recepcao"]) await orm.usuario.create({ data: {
    id: `demo-${papel}`, clinicaId: "demo-clinic", nome: `Pessoa fictícia (${papel})`, email: `${papel}@example.test`, senhaHash, papel,
  } });
  await orm.capacidadeProdutiva.create({ data: { clinicaId: "demo-clinic", diasTrabalhados: 20, horasPorDia: 8, unidadesRenda: 1, percentOcupacao: 0.8 } });
  await orm.despesaFixa.create({ data: { id: "demo-cost", clinicaId: "demo-clinic", nome: "Aluguel fictício", valor: 3200 } });
  await orm.procedimento.create({ data: { id: "demo-procedure", clinicaId: "demo-clinic", nome: "Exame fictício de teste", tempoMinutos: 30, precoFinal: 150, laudos: 17, lucroDesejadoPct: 0.31 } });
  await orm.procedimento.create({ data: { id: "demo-unpriced", clinicaId: "demo-clinic", nome: "Exame fictício sem preço", tempoMinutos: 15 } });
  await orm.agendamento.create({ data: { id: "demo-booking", clinicaId: "demo-clinic", nome: "Paciente FICTÍCIO", data: new Date().toISOString().slice(0, 10), hora: "10:00", exame: "Exame fictício de teste" } });
} finally { await orm.$disconnect(); }
const port = await new Promise<number>((accept, reject) => {
  const socket = createServer(); socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    if (!address || typeof address === "string") return reject(new Error("No local port"));
    socket.close((error) => error ? reject(error) : accept(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const child = Bun.spawn([process.execPath, "node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: { ...process.env, DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "", NODE_ENV: "development", APP_ORIGIN: origin,
    APP_RUNTIME_TEST: "1", AUTH_SECRET: "disposable-ui-fixture-only-not-for-production",
    AUTH_RATE_LIMIT_REDIS_URL: "", AUTH_RATE_LIMIT_REDIS_TOKEN: "", AUTH_RATE_LIMIT_TRUST_PROXY: "false", NEXT_TELEMETRY_DISABLED: "1" },
  stdout: "inherit", stderr: "inherit",
});
console.log(JSON.stringify({ event: "local_ui_fixture_started", origin,
  emails: ["dono@example.test", "financeiro@example.test", "recepcao@example.test"], fictitiousPassword: "Teste-Local-2026!" }));
let stopping = false;
const stop = () => { if (!stopping) { stopping = true; child.kill(); } };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
await child.exited;
const target = resolve(directory);
if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("odonto-ui-fixture-")) throw new Error("Unsafe fixture cleanup");
Bun.gc(true);
try { await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
catch (error) {
  if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EBUSY") throw error;
  console.warn("Synthetic UI fixture retained until Windows handles close.");
}
