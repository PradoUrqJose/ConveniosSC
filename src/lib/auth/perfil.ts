import { sql } from "drizzle-orm";

import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { obtenerFilas } from "@/lib/audit/registrar";

export type PerfilNav = {
  nombres: string;
  apellidos: string;
  empresaNombre: string | null;
};

/** Datos del usuario que muestra el header del shell (04-UI §0). */
export async function cargarPerfilNav(
  ejecutor: TransaccionAuditada,
  usuarioId: string,
): Promise<PerfilNav> {
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT u.nombres, u.apellidos, e.nombre_comercial
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      WHERE u.id = ${usuarioId}
    `),
  );
  const fila = filas[0];
  return {
    nombres: String(fila?.nombres ?? ""),
    apellidos: String(fila?.apellidos ?? ""),
    empresaNombre:
      fila?.nombre_comercial === null || fila?.nombre_comercial === undefined
        ? null
        : String(fila.nombre_comercial),
  };
}

/** Empleados `PENDIENTE_VERIFICACION` de la empresa; alimenta el badge del menú. */
export async function contarPendientesVerificacion(
  ejecutor: TransaccionAuditada,
  empresaId: string,
): Promise<number> {
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT count(*)::int AS n
      FROM empleados
      WHERE empresa_id = ${empresaId}
        AND estado = 'PENDIENTE_VERIFICACION'
    `),
  );
  return Number(filas[0]?.n ?? 0);
}
