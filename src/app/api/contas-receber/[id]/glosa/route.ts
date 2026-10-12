import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface GlosaCreateBody {
  valor?: number;
  motivo?: string;
}

// POST /api/contas-receber/[id]/glosa
// Cria uma glosa vinculada a conta a receber [id]. Requer papel dono ou
// financeiro. `motivo` vira null quando ausente/vazio. Retorna 201 com a
// linha criada.
//
// Nota: nao verificamos se a conta pertence a clinica do usuario aqui porque
// a FK contaReceberId vai falhar a criacao se o id nao existir; mas para
// isolar multi-tenant corretamente, fazemos o findFirst previo para garantir
// que o id pertence a clinica do usuario autenticado e retornar 404 limpo.
export async function POST(
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

    const conta = await db.contaReceber.findFirst({
      where: { id, clinicaId: payload.clinicaId },
      select: { id: true },
    });
    if (!conta) {
      return NextResponse.json(
        { erro: "Conta a receber não encontrada." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as GlosaCreateBody;
    const { valor, motivo } = body;

    const novoId = crypto.randomUUID();
    const criado = await db.glosa.create({
      data: {
        id: novoId,
        contaReceberId: id,
        valor: valor ?? 0,
        motivo: motivo || null,
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
