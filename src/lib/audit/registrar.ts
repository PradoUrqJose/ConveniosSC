import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { accionAuditoria, rolUsuario } from "@/db/schema";

import { calcularHash, canonicalizar, redactar, type Datos } from "./canonico";

export type AccionAuditoria = (typeof accionAuditoria.enumValues)[number];
export type RolAuditoria = (typeof rolUsuario.enumValues)[number];

export type ActorAuditoria = {
  usuarioId: string;
  empresaId: string | null;
  rol: RolAuditoria;
};

export type EntradaAuditoria = {
  accion: AccionAuditoria;
  entidad: string;
  entidadId: string;
  actor?: ActorAuditoria | null;
  datosAntes?: Datos;
  datosDespues?: Datos;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

/** Mínimo común que toda transacción de Drizzle expone para SQL crudo. */
export type TransaccionAuditada = {
  execute(query: SQL): Promise<unknown>;
};

/**
 * Identificador estable de una cadena por recurso. JSON evita colisiones por
 * separadores que sí ocurrirían al concatenar `entidad` y `entidadId`.
 */
export function claveCadenaAuditoria(
  entidad: string,
  entidadId: string,
): string {
  return JSON.stringify([entidad, entidadId]);
}

/** Normaliza el resultado de `execute` de los distintos drivers (rows o { rows }). */
export function obtenerFilas(resultado: unknown): Record<string, unknown>[] {
  if (Array.isArray(resultado)) {
    return resultado as Record<string, unknown>[];
  }
  if (
    resultado !== null &&
    typeof resultado === "object" &&
    "rows" in resultado
  ) {
    const r = resultado as { rows?: unknown };
    if (Array.isArray(r.rows)) {
      return r.rows as Record<string, unknown>[];
    }
  }
  return [];
}

/**
 * Inserta una fila en `auditoria` dentro de la transacción recibida (01 §11).
 * La escritura va en la misma transacción que el cambio auditado: si falla la
 * auditoría, falla la operación completa.
 *
 * Secuencia con un advisory lock por recurso para que cada cadena nunca tenga
 * carreras, sin serializar escrituras de recursos distintos:
 *   1. adquirir el lock de la cadena
 *   2. leer el hash de su última fila una vez adquirido el lock
 *   3. calcular y escribir
 */
export async function registrar(
  tx: TransaccionAuditada,
  entrada: EntradaAuditoria,
): Promise<void> {
  const cadena = claveCadenaAuditoria(entrada.entidad, entrada.entidadId);

  // Debe ser una sentencia separada: en una CTE el optimizador puede leer la
  // última fila antes de evaluar el lock, dejando dos `prev_hash` iguales.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${cadena}))`);

  const ultima = obtenerFilas(
    await tx.execute(sql`
      SELECT hash FROM auditoria
      WHERE cadena = ${cadena}
      ORDER BY id DESC
      LIMIT 1
    `),
  )[0];
  const prevHash = (ultima?.hash as string | undefined) ?? null;

  const datosAntes = redactar(entrada.datosAntes ?? null);
  const datosDespues = redactar(entrada.datosDespues ?? null);
  const ts = new Date();

  const canon = canonicalizar({
    accion: entrada.accion,
    actor_empresa_id: entrada.actor?.empresaId ?? null,
    actor_rol: entrada.actor?.rol ?? null,
    actor_usuario_id: entrada.actor?.usuarioId ?? null,
    cadena,
    datos_antes: datosAntes,
    datos_despues: datosDespues,
    entidad: entrada.entidad,
    entidad_id: entrada.entidadId,
    ip: entrada.ip ?? null,
    request_id: entrada.requestId ?? null,
    ts: ts.toISOString(),
    user_agent: entrada.userAgent ?? null,
  });
  const hash = calcularHash(prevHash, canon);

  await tx.execute(sql`
    INSERT INTO auditoria
      (ts, actor_usuario_id, actor_empresa_id, actor_rol, accion,
       entidad, entidad_id, datos_antes, datos_despues,
       ip, user_agent, request_id, cadena, prev_hash, hash)
    VALUES
      (${ts.toISOString()}, ${entrada.actor?.usuarioId ?? null},
       ${entrada.actor?.empresaId ?? null}, ${entrada.actor?.rol ?? null},
       ${entrada.accion}, ${entrada.entidad}, ${entrada.entidadId},
       ${datosAntes === null ? null : JSON.stringify(datosAntes)},
       ${datosDespues === null ? null : JSON.stringify(datosDespues)},
       ${entrada.ip ?? null}, ${entrada.userAgent ?? null},
       ${entrada.requestId ?? null}, ${cadena}, ${prevHash}, ${hash})
  `);
}
