import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import { hoyLima, sumarDias } from "@/lib/fechas";

export type FilaSede = {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  totalVentas30d: number;
};

/** `listarSedes` (03 §3). Un ADMIN solo ve (y siempre) su propia empresa. */
export async function listarSedes(
  ctx: SessionContext,
  entrada: { empresaId?: string; soloActivas?: boolean },
): Promise<FilaSede[]> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

  const empresaId =
    ctx.rol === "SUPERADMIN"
      ? (entrada.empresaId ?? null)
      : (ctx.empresaId ?? null);

  const desde = sumarDias(hoyLima(), -30);
  const condiciones = [
    empresaId ? sql`s.empresa_id = ${empresaId}` : undefined,
    entrada.soloActivas ? sql`s.activo` : undefined,
  ].filter((c) => c !== undefined) as ReturnType<typeof sql>[];

  const where = condiciones.length
    ? sql`WHERE ${sql.join(condiciones, sql` AND `)}`
    : sql``;

  const filas = obtenerFilas(
    await db.execute(sql`
      SELECT s.id, s.nombre, s.direccion, s.activo,
        COALESCE(metricas.total_ventas_30d, 0)::int AS total_ventas_30d
      FROM sedes s
      LEFT JOIN (
        SELECT v.sede_id, count(*)::int AS total_ventas_30d
        FROM ventas v
        WHERE v.estado = 'REGISTRADA'
          AND v.fecha_venta >= ${desde}
        GROUP BY v.sede_id
      ) metricas ON metricas.sede_id = s.id
      ${where}
      ORDER BY s.nombre ASC
    `),
  );

  return filas.map((f) => ({
    id: String(f.id),
    nombre: String(f.nombre),
    direccion: f.direccion === null ? null : String(f.direccion),
    activo: Boolean(f.activo),
    totalVentas30d: Number(f.total_ventas_30d ?? 0),
  }));
}
