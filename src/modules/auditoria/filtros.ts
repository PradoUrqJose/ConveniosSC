import { accionAuditoria } from "@/db/schema";
import {
  parametrosUrlCanonicos,
  rangoFechasUrl,
  textoUrl,
  uuidUrl,
  type ParametrosUrl,
} from "@/lib/url-parametros";
import type { AccionAuditoria } from "@/lib/audit/registrar";
import type { FiltroAuditoria } from "./query";

const CLAVES = [
  "desde",
  "hasta",
  "accion",
  "entidad",
  "entidadId",
  "actorId",
  "cursor",
] as const;

function cursorAuditoria(valor: unknown): string | undefined {
  const candidato = textoUrl(valor, 512);
  if (!candidato) return undefined;
  try {
    const raw = JSON.parse(
      Buffer.from(candidato, "base64url").toString("utf8"),
    );
    return typeof raw.ts === "string" &&
      !Number.isNaN(Date.parse(raw.ts)) &&
      typeof raw.id === "number" &&
      Number.isSafeInteger(raw.id) &&
      raw.id > 0
      ? candidato
      : undefined;
  } catch {
    return undefined;
  }
}

/** Deserializa y sanea todos los filtros admitidos por /auditoria. */
export function normalizarParametrosAuditoria(
  entrada: Record<string, unknown>,
): FiltroAuditoria {
  const accion = accionAuditoria.enumValues.includes(
    entrada.accion as AccionAuditoria,
  )
    ? (entrada.accion as AccionAuditoria)
    : undefined;
  return {
    ...rangoFechasUrl(entrada.desde, entrada.hasta),
    accion,
    entidad: textoUrl(entrada.entidad, 100),
    entidadId: uuidUrl(entrada.entidadId),
    actorId: uuidUrl(entrada.actorId),
    cursor: cursorAuditoria(entrada.cursor),
  };
}

/** Serializa /auditoria, descartando cualquier valor no aplicable. */
export function serializarParametrosAuditoria(
  entrada: Record<string, unknown>,
): URLSearchParams {
  const filtros = normalizarParametrosAuditoria(entrada);
  const salida = new URLSearchParams();
  for (const clave of CLAVES) {
    const valor = filtros[clave];
    if (valor) salida.set(clave, valor);
  }
  return salida;
}

export function urlAuditoriaCanonica(entrada: ParametrosUrl): boolean {
  return parametrosUrlCanonicos(
    entrada,
    serializarParametrosAuditoria(entrada),
  );
}
