import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { calcularHash, canonicalizar } from "./canonico";
import { obtenerFilas } from "./registrar";

export type FilaCadena = {
  id: number;
  cadena: string | null;
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

export type ResultadoLoteVerificacion =
  | {
      verificadas: number;
      rota: false;
      ultimoId: number | null;
      completa: boolean;
    }
  | { verificadas: number; rota: true; enId: number };

const CADENA_LEGADA = "";

function claveCadena(fila: Pick<FilaCadena, "cadena">): string {
  return fila.cadena ?? CADENA_LEGADA;
}

/**
 * Verifica la cadena sobre filas ya cargadas (puras, sin tocar la BD).
 * `prevHashInicial` permite validar un tramo que no empieza en la primera fila.
 */
export function verificarFilas(
  filas: FilaCadena[],
  prevHashInicial: string | null = null,
  prevHashesIniciales: ReadonlyMap<string, string | null> = new Map(),
): ResultadoVerificacion {
  const prevHashes = new Map(prevHashesIniciales);
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const cadena = claveCadena(fila);
    const prevHash = prevHashes.has(cadena)
      ? prevHashes.get(cadena)!
      : fila.cadena === null
        ? prevHashInicial
        : null;
    const esperado = calcularHash(
      fila.prev_hash,
      canonicalizar(camposCadena(fila)),
    );
    if (fila.hash !== esperado || fila.prev_hash !== prevHash) {
      return { verificadas: i, rota: true, enId: fila.id };
    }
    prevHashes.set(cadena, fila.hash);
  }
  return { verificadas: filas.length, rota: false };
}

/**
 * Verifica un lote de la cadena en la BD. `desdeId` es el último ID ya
 * comprobado, por lo que el siguiente lote empieza estrictamente después.
 * Esto mantiene el consumo de filas acotado incluso con auditorías grandes.
 * `ejecutor` por defecto: el cliente de la app (`@/db`), importado en diferido.
 */
export async function verificarCadena(
  opciones?: { desdeId?: number; limite?: number },
  ejecutor?: EjecutorLectura,
): Promise<ResultadoLoteVerificacion> {
  const ejecutante = ejecutor ?? (await import("@/db")).db;
  const desdeId = opciones?.desdeId;
  const limite = opciones?.limite;

  const limiteEfectivo = limite ?? 250;
  const condiciones =
    desdeId !== undefined ? sql` WHERE id > ${desdeId}` : sql``;

  const filas = obtenerFilas(
    await ejecutante.execute(sql`
      SELECT id, cadena, prev_hash, hash, ts, actor_usuario_id, actor_empresa_id, actor_rol,
             accion, entidad, entidad_id, datos_antes, datos_despues, ip, request_id,
             user_agent
      FROM auditoria${condiciones} ORDER BY id ASC LIMIT ${limiteEfectivo + 1}
    `),
  ) as FilaCadena[];

  const tieneMas = filas.length > limiteEfectivo;
  const lote = filas.slice(0, limiteEfectivo);

  const prevHashes = new Map<string, string | null>();
  if (desdeId !== undefined && lote.length > 0) {
    const cadenas = new Map(
      lote.map((fila) => [claveCadena(fila), fila.cadena] as const),
    );
    const condicionesPrevias = sql.join(
      [...cadenas.values()].map((cadena) =>
        cadena === null ? sql`cadena IS NULL` : sql`cadena = ${cadena}`,
      ),
      sql` OR `,
    );
    const previas = obtenerFilas(
      await ejecutante.execute(sql`
        SELECT DISTINCT ON (cadena) cadena, hash
        FROM auditoria
        WHERE id < ${desdeId} AND (${condicionesPrevias})
        ORDER BY cadena, id DESC
      `),
    );
    for (const previa of previas) {
      prevHashes.set(
        (previa.cadena as string | null) ?? CADENA_LEGADA,
        (previa.hash as string | undefined) ?? null,
      );
    }
  }

  const resultado = verificarFilas(lote, null, prevHashes);
  if (resultado.rota) return resultado;
  return {
    ...resultado,
    ultimoId: lote.at(-1)?.id ?? desdeId ?? null,
    completa: !tieneMas,
  };
}

function camposCadena(fila: FilaCadena) {
  return {
    accion: fila.accion,
    actor_empresa_id: fila.actor_empresa_id,
    actor_rol: fila.actor_rol,
    actor_usuario_id: fila.actor_usuario_id,
    ...(fila.cadena === null ? {} : { cadena: fila.cadena }),
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
