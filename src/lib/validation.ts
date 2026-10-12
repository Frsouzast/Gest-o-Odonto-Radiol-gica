import { NextResponse } from "next/server";
import { z } from "zod";

export const dateISO = z.iso.date("Use uma data válida no formato AAAA-MM-DD.");
export const money = z.number().finite().min(0).max(1_000_000_000);
export const shortText = z.string().trim().min(1, "Preencha este campo.").max(200, "Use no máximo 200 caracteres.");
const optionalText = z.string().trim().max(200).optional();
const password = z.string().min(8).refine(
  (value) => new TextEncoder().encode(value).length <= 72,
  "A senha precisa ter no máximo 72 bytes (caracteres com acento ocupam mais de um byte)."
);
export const email = z.email().trim().toLowerCase();
export const loginSchema = z.object({ email, senha: z.string().min(1).max(200) });
export const registerSchema = z.object({ clinicaNome: shortText, usuarioNome: shortText, email, senha: password });
export const inviteSchema = z.object({ nome: shortText, email, senha: password, papel: z.enum(["financeiro", "recepcao"]) });
export const userAccessSchema = z.object({
  papel: z.enum(["financeiro", "recepcao"]).optional(),
  ativo: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Informe uma alteração de função ou acesso.");
export const contaPagarSchema = z.object({
  descricao: shortText, categoria: optionalText, fornecedor: optionalText,
  valor: money, vencimento: dateISO,
});
export const contaReceberSchema = z.object({
  pacienteNome: optionalText, procedimentoId: shortText.optional(), convenioId: shortText.optional(),
  dentistaSolicitante: optionalText, dataExame: dateISO, valorFaturado: money.optional(),
  vencimento: dateISO.optional(),
});
export const contaReceberUpdateSchema = z.object({
  status: z.enum(["aberto", "recebido", "vencido", "parcial", "cancelado"]).optional(),
  valorPago: money.optional(), dataRecebimento: dateISO.optional(),
}).refine((value) => Object.keys(value).length > 0, "Informe uma alteração.");
export const contaPagarUpdateSchema = z.object({
  status: z.enum(["aberto", "pago", "vencido", "cancelado"]).optional(),
  dataPagamento: dateISO.optional(),
}).refine((value) => Object.keys(value).length > 0, "Informe uma alteração.");
export const glosaUpdateSchema = z.object({
  status: z.enum(["glosada", "em_recurso", "recuperada", "perdida"]).optional(),
  valorRecuperado: money.optional(),
}).refine((value) => Object.keys(value).length > 0, "Informe uma alteração.");

const nullableText = z.string().trim().max(200).nullable().optional();
export const appointmentTime = z.union([
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use um horário entre 00:00 e 23:59."),
  z.literal(""), z.null(),
]).transform((value) => value || null);
const appointmentFields = {
  nome: shortText,
  telefone: nullableText,
  exame: nullableText,
  plano: z.boolean().optional(),
  particular: z.boolean().optional(),
  data: dateISO,
  hora: appointmentTime.optional(),
};
export const agendamentoSchema = z.object(appointmentFields);
export const agendamentoUpdateSchema = z.object({
  ...appointmentFields,
  status: z.enum(["aguardando", "atendido", "faltou", "desmarcou", "remarcado"]),
}).partial().refine((value) => Object.keys(value).length > 0, "Informe uma alteração.");
export const remarcarSchema = z.object({ novaData: dateISO, novaHora: appointmentTime.optional() });
export const agendaQuerySchema = z.union([
  z.object({ data: dateISO, periodoInicio: z.undefined().optional(), periodoFim: z.undefined().optional() }),
  z.object({ data: z.undefined().optional(), periodoInicio: dateISO, periodoFim: dateISO })
    .refine((value) => value.periodoInicio <= value.periodoFim, "A data inicial não pode ser posterior à data final."),
]);
export const capacidadeSchema = z.object({
  diasTrabalhados: z.number().int("Informe um número inteiro de dias.").min(1, "Informe ao menos um dia.").max(31, "Use no máximo 31 dias no mês."),
  horasPorDia: z.number().finite().gt(0, "Informe mais de zero horas.").max(24, "Um dia tem no máximo 24 horas."),
  unidadesRenda: z.number().int("Informe um número inteiro de unidades.").min(1, "Informe ao menos uma unidade.").max(10_000),
  percentOcupacao: z.number().finite().min(0, "Ocupação não pode ser negativa.").max(1, "Ocupação não pode passar de 100%."),
});
const fraction = z.number().finite().min(0, "Percentual não pode ser negativo.").max(1, "Percentual não pode passar de 100%.");
const procedimentoFields = {
  nome: shortText,
  tempoMinutos: z.number().finite().min(0, "Tempo não pode ser negativo.").max(1_440, "Use no máximo 24 horas (1.440 minutos)."),
  laudos: money,
  retrabalhoPct: fraction,
};
export const procedimentoSchema = z.object({
  ...procedimentoFields,
  tempoMinutos: procedimentoFields.tempoMinutos.default(0),
  laudos: money.default(0),
  retrabalhoPct: fraction.default(0.03),
});
export const pricingPercentagesSchema = z.object({
  comissaoPct: fraction.default(0), lucroDesejadoPct: fraction.default(0),
  inadimplenciaPct: fraction.default(0), impostosPct: fraction.default(0),
  taxaCartaoPct: fraction.default(0), outrosPct: fraction.default(0),
}).refine((value) => Object.values(value).reduce((total, pct) => total + pct, 0) < 1,
  "A soma de comissão, lucro, inadimplência, impostos, cartão e outros deve ficar abaixo de 100% para calcular o preço.");
export const procedimentoUpdateSchema = z.object({
  ...procedimentoFields,
  comissaoPct: fraction, lucroDesejadoPct: fraction, inadimplenciaPct: fraction,
  impostosPct: fraction, taxaCartaoPct: fraction, outrosPct: fraction,
  precoConcorrencia: money,
  equipamentoId: shortText,
}).partial().refine((value) => Object.keys(value).length > 0, "Informe uma alteração.");

export async function readBody<T extends z.ZodType>(req: Request, schema: T): Promise<
  { ok: true; data: z.output<T> } | { ok: false; response: NextResponse }
> {
  let body: unknown;
  // Bound bytes actually read, not only Content-Length (which can be absent or forged).
  const maxBytes = 16 * 1_024;
  const tooLarge = () => ({ ok: false as const, response: NextResponse.json({
    erro: "Os dados enviados são grandes demais. Reduza o tamanho dos campos.",
  }, { status: 413 }) });
  const length = req.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > maxBytes) return tooLarge();
  try {
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Empty JSON body");
    const decoder = new TextDecoder();
    let bytes = 0;
    let json = "";
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) {
          void reader.cancel().catch(() => {});
          return tooLarge();
        }
        json += decoder.decode(chunk.value, { stream: true });
      }
      json += decoder.decode();
      body = JSON.parse(json);
    } finally { reader.releaseLock(); }
  }
  catch {
    return { ok: false, response: NextResponse.json({ erro: "Envie um JSON válido." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: NextResponse.json({
      erro: "Confira os campos informados.",
      campos: parsed.error.issues.map((issue) => ({ campo: issue.path.join("."), mensagem: issue.message })),
    }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}
