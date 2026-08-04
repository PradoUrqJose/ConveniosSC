export type CambioAuditoria = {
  campo: string;
  antes: unknown;
  despues: unknown;
};

/** Diff superficial para los snapshots JSON de auditoría; omite claves sin cambio. */
export function diffAuditoria(
  antes: unknown,
  despues: unknown,
): CambioAuditoria[] {
  const a: Record<string, unknown> = esObjeto(antes) ? antes : {};
  const d: Record<string, unknown> = esObjeto(despues) ? despues : {};
  const claves = new Set([...Object.keys(a), ...Object.keys(d)]);
  return [...claves]
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(d[k]))
    .sort()
    .map((campo) => ({ campo, antes: a[campo], despues: d[campo] }));
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
