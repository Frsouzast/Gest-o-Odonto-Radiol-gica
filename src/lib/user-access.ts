import type { PrismaClient } from "@prisma/client";
import type { AuthPayload } from "./auth";
import { ServerSessions } from "./server-sessions";

export class UserAccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function changeUserAccess(store: PrismaClient, actor: AuthPayload, targetId: string, patch: { papel?: "financeiro" | "recepcao"; ativo?: boolean }) {
  return store.$transaction(async (tx) => {
    // Recheck actor inside the transaction, not just before starting it.
    const current = await tx.usuario.findFirst({ where: { id: actor.usuarioId, clinicaId: actor.clinicaId }, include: { acesso: true } });
    const session = await tx.sessao.findFirst({ where: { id: actor.sessaoId, usuarioId: actor.usuarioId, revogadaEm: null, expiraEm: { gt: new Date() } } });
    if (!current || current.acesso?.ativo === false || !session) throw new UserAccessError("Sua sessão terminou. Entre novamente.", 401);
    if (current.papel !== "dono") throw new UserAccessError("Só o dono da clínica pode gerenciar usuários.", 403);
    const target = await tx.usuario.findFirst({ where: { id: targetId, clinicaId: actor.clinicaId }, include: { acesso: true } });
    if (!target) throw new UserAccessError("Usuário não encontrado.", 404);
    // Ownership transfer needs its own acceptance flow. Never lock out an owner here.
    if (target.papel === "dono" || target.id === current.id) throw new UserAccessError("O acesso do dono não pode ser alterado nesta tela.", 409);
    const ativo = patch.ativo ?? target.acesso?.ativo ?? true;
    const papel = patch.papel ?? target.papel;
    if (!["financeiro", "recepcao"].includes(papel)) throw new UserAccessError("Função de usuário inválida.", 409);
    const changed = ativo !== (target.acesso?.ativo ?? true) || papel !== target.papel;
    if (changed) {
      await tx.usuario.update({ where: { id: target.id }, data: { papel } });
      await tx.usuarioAcesso.upsert({ where: { usuarioId: target.id }, create: { usuarioId: target.id, ativo }, update: { ativo } });
      // Reactivation never revives old credentials. Any role change requires new login.
      await new ServerSessions(tx).revokeAll(target.id);
    }
    return { id: target.id, nome: target.nome, email: target.email, papel, ativo, criadoEm: target.criadoEm, alterado: changed };
  });
}
