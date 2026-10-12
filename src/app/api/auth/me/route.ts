import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appOrigin } from "@/lib/auth";
import { ServerSessions } from "@/lib/server-sessions";

export async function GET(req: NextRequest) {
  try {
    const result = await new ServerSessions(db).authorize(req, appOrigin());
    if (!result.ok) return NextResponse.json({ erro: result.erro }, { status: result.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ usuario: result.session.usuario, clinica: result.session.clinica }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error(JSON.stringify({ event: "auth_session_lookup_failed" }));
    return NextResponse.json({ erro: "Não foi possível conferir seu acesso. Tente novamente." }, { status: 503 });
  }
}
