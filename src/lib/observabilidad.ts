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
): Promise<T> {
  if (process.env.PERF_BASELINE !== "1") {
    return operacion();
  }

  const inicio = performance.now();
  try {
    const resultado = await operacion();
    registrar(etapa, performance.now() - inicio, "ok");
    return resultado;
  } catch (error) {
    registrar(etapa, performance.now() - inicio, "error");
    throw error;
  }
}

function registrar(
  etapa: string,
  duracionMs: number,
  resultado: "ok" | "error",
) {
  console.info(
    JSON.stringify({
      esquema: "convenios.perf.v1",
      tipo: "latencia-servidor",
      etapa,
      duracionMs: Number(duracionMs.toFixed(2)),
      resultado,
    }),
  );
}
