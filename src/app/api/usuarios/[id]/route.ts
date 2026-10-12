import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";
import { readBody, userAccessSchema } from "@/lib/validation";
import { changeUserAccess, UserAccessError } from "@/lib/user-access";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authRequired(req, "usuarios");
    if ("erro" in actor) return NextResponse.json({ erro: actor.erro }, { status: actor.status });
    if (actor.papel !== "dono") return NextResponse.json({ erro: "Só o dono da clínica pode gerenciar usuários." }, { status: 403 });
    const parsed = await readBody(req, userAccessSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await context.params;
    return NextResponse.json(await changeUserAccess(db, actor, id, parsed.data));
  } catch (error) {
    if (error instanceof UserAccessError) return NextResponse.json({ erro: error.message }, { status: error.status });
    console.error(JSON.stringify({ event: "user_access_change_failed_internal" }));
    return NextResponse.json({ erro: "Não foi possível alterar o acesso. Tente novamente." }, { status: 503 });
  }
}
