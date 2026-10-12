import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appOrigin } from "@/lib/auth";
import { clearSessionCookies, ServerSessions } from "@/lib/server-sessions";

export async function POST(req: NextRequest) {
  try {
    const sessions = new ServerSessions(db);
    const result = await sessions.authorize(req, appOrigin());
    if (!result.ok) {
      const response = NextResponse.json({ erro: result.erro }, { status: result.status });
      return result.status === 401 ? clearSessionCookies(response) : response;
    }
    await sessions.revoke(result.session.id, result.session.usuarioId);
    return clearSessionCookies(new NextResponse(null, { status: 204 }));
  } catch {
    console.error(JSON.stringify({ event: "auth_logout_failed" }));
    return NextResponse.json({ erro: "Não foi possível encerrar sua sessão. Tente novamente." }, { status: 503 });
  }
}
