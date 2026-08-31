import type { SQL } from "drizzle-orm";

import type { TransaccionAuditada } from "@/lib/audit/registrar";

/**
 * Medición de servidor activable únicamente durante la captura de baselines.
 *
 * Los eventos se emiten como JSON de una línea para que el recolector del
 * entorno acordado pueda agrupar p50/p95 sin exponer datos de usuarios ni SQL.
 * No se registran cuando PERF_BASELINE no vale "1".
 */
export async function medirServidor<T>(
  etapa: string,
  operacion: () => Promise<T>,
  opciones?: { consultas?: number | (() => number) },
): Promise<T> {
  if (process.env.PERF_BASELINE !== "1") {
    return operacion();
  }

  const inicio = performance.now();
  try {
    const resultado = await operacion();
    registrar(etapa, performance.now() - inicio, "ok", opciones);
    return resultado;
  } catch (error) {
    registrar(etapa, performance.now() - inicio, "error", opciones);
    throw error;
  }
}

function registrar(
  etapa: string,
  duracionMs: number,
  resultado: "ok" | "error",
  opciones?: { consultas?: number | (() => number) },
) {
  const consultas = opciones?.consultas;
  const cantidadConsultas =
    typeof consultas === "function" ? consultas() : consultas;
  console.info(
    JSON.stringify({
      esquema: "convenios.perf.v1",
      tipo: "latencia-servidor",
      etapa,
      duracionMs: Number(duracionMs.toFixed(2)),
      resultado,
      ...(cantidadConsultas === undefined
        ? {}
        : { consultas: cantidadConsultas }),
    }),
  );
}

/**
 * Mide una operación que recibe un ejecutor de base de datos y cuenta sus
 * sentencias. El contador sólo se publica cuando `PERF_BASELINE=1`, igual que
 * el resto de la telemetría, y nunca incluye SQL ni datos de usuario.
 */
export async function medirConsultasServidor<T>(
  etapa: string,
  ejecutor: TransaccionAuditada,
  operacion: (ejecutor: TransaccionAuditada) => Promise<T>,
): Promise<T> {
  let consultas = 0;
  const ejecutorContado: TransaccionAuditada = {
    execute(query: SQL) {
      consultas += 1;
      return ejecutor.execute(query);
    },
  };
  return medirServidor(etapa, () => operacion(ejecutorContado), {
    consultas: () => consultas,
  });
}
