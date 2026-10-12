import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface ConvenioCreateBody {
  nome?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  responsavel?: string;
  prazoMedioDias?: number;
}

// GET /api/convenios
// Lista todos os convenios da clinica do usuario autenticado, ordenados por
// nome. Requer apenas sessão válida (qualquer papel pode listar).
export async function GET(req: NextRequest) {
  try {
    const auth = await authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const convenios = await db.convenio.findMany({
      where: { clinicaId: auth.clinicaId },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(convenios);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/convenios
// Cria um novo convenio para a clinica. Requer papel dono ou financeiro.
// Defaults: prazoMedioDias=30 quando ausente (fiel ao api.js L546). Campos
// opcionais (cnpj, telefone, email, responsavel) viram null quando ausentes
// ou vazios.
export async function POST(req: NextRequest) {
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

    const body = (await req.json().catch(() => ({}))) as ConvenioCreateBody;
    const { nome, cnpj, telefone, email, responsavel, prazoMedioDias } = body;

    const id = crypto.randomUUID();
    const criado = await db.convenio.create({
      data: {
        id,
        clinicaId: payload.clinicaId,
        nome: nome ?? "",
        cnpj: cnpj || null,
        telefone: telefone || null,
        email: email || null,
        responsavel: responsavel || null,
        prazoMedioDias: prazoMedioDias ?? 30,
      },
    });

    return NextResponse.json(criado, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
