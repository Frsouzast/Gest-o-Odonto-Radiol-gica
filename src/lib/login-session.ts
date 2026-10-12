import type { PrismaClient } from "@prisma/client";
import type { Papel } from "./auth";
import { ServerSessions } from "./server-sessions";

/** Password checking happens before this transaction; recheck its hash and access here. */
export async function createLoginSession(store: PrismaClient, usuarioId: string, verifiedHash: string) {
  return store.$transaction(async (tx) => {
    const user = await tx.usuario.findUnique({ where: { id: usuarioId }, include: { clinica: true, acesso: true } });
    if (!user || user.senhaHash !== verifiedHash || user.acesso?.ativo === false || !["dono", "financeiro", "recepcao"].includes(user.papel)) return null;
    const credentials = await new ServerSessions(tx).create(user.id);
    return { credentials,
      usuario: { id: user.id, nome: user.nome, email: user.email, papel: user.papel as Papel },
      clinica: { id: user.clinica.id, nome: user.clinica.nome } };
  });
}
