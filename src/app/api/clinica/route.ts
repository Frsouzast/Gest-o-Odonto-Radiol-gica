import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

// GET /api/clinica — retorna dados da clínica do usuário autenticado
export async function GET(req: NextRequest) {
  try {
    const payload = await authRequired(req, "operacional");
    if ("erro" in payload) {
      return NextResponse.json({ erro: payload.erro }, { status: payload.status });
    }

    const clinica = await db.clinica.findUnique({
      where: { id: payload.clinicaId },
      select: { id: true, nome: true, cnpj: true, criadoEm: true },
    });

    if (!clinica) {
      return NextResponse.json({ erro: "Clínica não encontrada." }, { status: 404 });
    }

    return NextResponse.json(clinica);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// PUT /api/clinica — atualiza nome e CNPJ da clínica (só dono/financeiro)
export async function PUT(req: NextRequest) {
  try {
    const payload = await authRequired(req);
    if ("erro" in payload) {
      return NextResponse.json({ erro: payload.erro }, { status: payload.status });
    }

    const check = podeEditar(payload);
    if (!check.ok) {
      return NextResponse.json({ erro: check.erro }, { status: check.status });
    }

    const body = await req.json().catch(() => ({}));
    const data: { nome?: string; cnpj?: string | null } = {};
    if (typeof body.nome === "string" && body.nome.trim().length > 0) {
      data.nome = body.nome.trim();
    }
    if (body.cnpj !== undefined) {
      // Permite string ou null (para limpar)
      data.cnpj = typeof body.cnpj === "string" ? body.cnpj.trim() || null : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { erro: "Informe nome ou cnpj para atualizar." },
        { status: 400 }
      );
    }

    const atualizada = await db.clinica.update({
      where: { id: payload.clinicaId },
      data,
      select: { id: true, nome: true, cnpj: true, criadoEm: true },
    });

    return NextResponse.json(atualizada);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
