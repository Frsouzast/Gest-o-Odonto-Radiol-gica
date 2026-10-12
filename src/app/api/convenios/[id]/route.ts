import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface ConvenioUpdateBody {
  nome?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  responsavel?: string;
  prazoMedioDias?: number;
  ativo?: unknown;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && !Number.isNaN(v);

// PUT /api/convenios/[id]
// Atualiza apenas os campos fornecidos do convenio. `ativo`, se presente, e
// coercido a boolean (fiel ao `ativo ? 1 : 0` do api.js L560). Requer papel
// dono ou financeiro. Retorna 404 se o convenio nao existir na clinica.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const check = podeEditar(auth);
    if (!check.ok) {
      return NextResponse.json({ erro: check.erro }, { status: check.status });
    }
    const payload = check.payload;

    const { id } = await params;

    const existente = await db.convenio.findFirst({
      where: { id, clinicaId: payload.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Convênio não encontrado." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ConvenioUpdateBody;

    const data: {
      nome?: string;
      cnpj?: string;
      telefone?: string;
      email?: string;
      responsavel?: string;
      prazoMedioDias?: number;
      ativo?: boolean;
    } = {};
    if (typeof body.nome === "string") data.nome = body.nome;
    if (typeof body.cnpj === "string") data.cnpj = body.cnpj;
    if (typeof body.telefone === "string") data.telefone = body.telefone;
    if (typeof body.email === "string") data.email = body.email;
    if (typeof body.responsavel === "string") data.responsavel = body.responsavel;
    if (isNum(body.prazoMedioDias)) data.prazoMedioDias = body.prazoMedioDias;
    if (body.ativo !== undefined) data.ativo = Boolean(body.ativo);

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { erro: "Nenhum campo reconhecido para atualizar." },
        { status: 400 }
      );
    }

    const atualizado = await db.convenio.update({
      where: { id },
      data,
    });

    return NextResponse.json(atualizado);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// DELETE /api/convenios/[id]
// Remove o convenio. Requer papel dono ou financeiro. Retorna 204
// (idempotente via deleteMany por {id, clinicaId}).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const check = podeEditar(auth);
    if (!check.ok) {
      return NextResponse.json({ erro: check.erro }, { status: check.status });
    }
    const payload = check.payload;

    const { id } = await params;

    await db.convenio.deleteMany({
      where: { id, clinicaId: payload.clinicaId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
