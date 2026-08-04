import { sql } from "drizzle-orm";

import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { obtenerFilas } from "@/lib/audit/registrar";

/**
 * Rate limit de ventana fija simple sobre la tabla `rate_limits`
 * (01-MODELO-DATOS.md §12). Suficiente para la escala de v1 (D10).
 *
 * El upsert es atómico (row lock en `clave`): el contador se incrementa en la
 * misma sentencia, así que dos peticiones concurrentes no lo corrompen. Si la
 * ventana expiró, se reinicia a 1.
 */
export async function rateLimit(
  ejecutor: TransaccionAuditada,
  clave: string,
  opciones: { limite: number; ventanaMs: number },
): Promise<{ permitido: boolean; contador: number }> {
  const { limite, ventanaMs } = opciones;

  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      INSERT INTO rate_limits (clave, ventana_inicio, contador)
      VALUES (${clave}, now(), 1)
      ON CONFLICT (clave) DO UPDATE SET
        ventana_inicio = CASE
          WHEN rate_limits.ventana_inicio < now() - make_interval(secs => ${
            ventanaMs / 1000
          })
          THEN now()
          ELSE rate_limits.ventana_inicio
        END,
        contador = CASE
          WHEN rate_limits.ventana_inicio < now() - make_interval(secs => ${
            ventanaMs / 1000
          })
          THEN 1
          ELSE rate_limits.contador + 1
        END
      RETURNING contador
    `),
  );

  const contador = Number(filas[0]?.contador ?? 1);
  return { permitido: contador <= limite, contador };
}
