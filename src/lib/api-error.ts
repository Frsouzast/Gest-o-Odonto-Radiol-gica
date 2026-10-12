/** Extract only bounded, textual API messages; never render arbitrary response objects. */
export function apiErrorMessage(body: unknown, status: number): string {
  if (typeof body === "string" && body) return body.slice(0, 500);
  if (!body || typeof body !== "object") return `Erro ${status}`;
  const payload = body as Record<string, unknown>;
  const general = [payload.erro, payload.error, payload.message].find(
    (value): value is string => typeof value === "string" && value.length > 0
  )?.slice(0, 500) ?? `Erro ${status}`;
  if (!Array.isArray(payload.campos)) return general;
  const details = payload.campos.slice(0, 3).flatMap((field: unknown) => {
    if (!field || typeof field !== "object") return [];
    const message = (field as Record<string, unknown>).mensagem;
    return typeof message === "string" && message ? [message.slice(0, 200)] : [];
  });
  return details.length ? `${general} ${[...new Set(details)].join(" ")}` : general;
}
