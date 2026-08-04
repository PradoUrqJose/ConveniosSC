import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { calcularHash, canonicalizar } from "./canonico";
import { obtenerFilas } from "./registrar";

export type FilaCadena = {
  id: number;
  prev_hash: string | null;
  hash: string;
  accion: string;
  entidad: string;
  entidad_id: string;
  actor_usuario_id: string | null;
  actor_empresa_id: string | null;
  actor_rol: string | null;
  datos_antes: unknown;
  datos_despues: unknown;
  ip: string | null;
  request_id: string | null;
  user_agent: string | null;
  ts: unknown;
};

export type ResultadoVerificacion =
  | { verificadas: number; rota: false }
  | { verificadas: number; rota: true; enId: number };

export type EjecutorLectura = {
  execute(query: SQL): Promise<unknown>;
};

/**
 * Verifica la cadena sobre filas ya cargadas (puras, sin tocar la BD).
 * `prevHashInicial` permite validar un tramo que no empieza en la primera fila.
 */
export function verificarFilas(
  filas: FilaCadena[],
  prevHashInicial: string | null = null,
): ResultadoVerificacion {
  let prevHash = prevHashInicial;
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const esperado = calcularHash(
      fila.prev_hash,
      canonicalizar(camposCadena(fila)),
    );
    if (fila.hash !== esperado || fila.prev_hash !== prevHash) {
      return { verificadas: i, rota: true, enId: fila.id };
    }
    prevHash = fila.hash;
  }
  return { verificadas: filas.length, rota: false };
}

/**
 * Verifica la cadena completa en la BD (o un tramo desde `desdeId`).
 * `ejecutor` por defecto: el cliente de la app (`@/db`), importado en diferido.
 */
export async function verificarCadena(
  opciones?: { desdeId?: number; limite?: number },
  ejecutor?: EjecutorLectura,
): Promise<ResultadoVerificacion> {
  const ejecutante = ejecutor ?? (await import("@/db")).db;
  const desdeId = opciones?.desdeId;
  const limite = opciones?.limite;

  let prevHashInicial: string | null = null;
  if (desdeId !== undefined) {
    const previa = obtenerFilas(
      await ejecutante.execute(
        sql`SELECT hash FROM auditoria WHERE id < ${desdeId} ORDER BY id DESC LIMIT 1`,
      ),
    )[0];
    prevHashInicial = (previa?.hash as string | undefined) ?? null;
  }

  const condiciones =
    desdeId !== undefined ? sql` WHERE id >= ${desdeId}` : sql``;
  const limiteSql = limite !== undefined ? sql` LIMIT ${limite}` : sql``;

  const filas = obtenerFilas(
    await ejecutante.execute(sql`
      SELECT id, prev_hash, hash, ts, actor_usuario_id, actor_empresa_id, actor_rol,
             accion, entidad, entidad_id, datos_antes, datos_despues, ip, request_id,
             user_agent
      FROM auditoria${condiciones} ORDER BY id ASC${limiteSql}
    `),
  ) as FilaCadena[];

  return verificarFilas(filas, prevHashInicial);
}

function camposCadena(fila: FilaCadena) {
  return {
    accion: fila.accion,
    actor_empresa_id: fila.actor_empresa_id,
    actor_rol: fila.actor_rol,
    actor_usuario_id: fila.actor_usuario_id,
    datos_antes: fila.datos_antes,
    datos_despues: fila.datos_despues,
    entidad: fila.entidad,
    entidad_id: fila.entidad_id,
    ip: fila.ip,
    request_id: fila.request_id,
    ts: aIso(fila.ts),
    user_agent: fila.user_agent,
  };
}

/** Normaliza el timestamptz leído (Date o string) a ISO con milisegundos. */
function aIso(valor: unknown): string {
  if (valor instanceof Date) return valor.toISOString();
  return new Date(String(valor)).toISOString();
}
