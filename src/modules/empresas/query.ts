import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import type { Pagina } from "@/lib/tipos";

export type FilaEmpresa = {
  id: string;
  ruc: string;
  nombreComercial: string;
  razonSocial: string;
  activo: boolean;
  topeMontoVentaCentimos: number;
  requiereEvidenciaEnVenta: boolean;
  diasRetroactivosVenta: number;
  totalUsuarios: number;
  totalEmpleados: number;
  totalConvenios: number;
};

const POR_PAGINA = 20;

/** `listarEmpresas` (03 §2). Paginación por cursor sobre (nombre_comercial, id). */
export async function listarEmpresas(
  ctx: SessionContext,
  entrada: { q?: string; activo?: boolean; cursor?: string },
): Promise<Pagina<FilaEmpresa>> {
  requireRol(ctx, ["SUPERADMIN"]);

  const { q, activo, cursor } = entrada;
  const cursorDatos = decodificarCursor(cursor);
  const condicion = [
    q
      ? sql`(e.nombre_comercial ILIKE ${`%${q}%`} OR e.razon_social ILIKE ${`%${q}%`} OR e.ruc LIKE ${`%${q}%`})`
      : undefined,
    activo !== undefined ? sql`e.activo = ${activo}` : undefined,
    cursorDatos
      ? sql`(e.nombre_comercial, e.id) > (${cursorDatos.nombre}, ${cursorDatos.id})`
      : undefined,
  ].filter((c) => c !== undefined) as ReturnType<typeof sql>[];

  const where = condicion.length
    ? sql`WHERE ${sql.join(condicion, sql` AND `)}`
    : sql``;

  const filas = obtenerFilas(
    await db.execute(sql`
      SELECT e.id, e.ruc, e.nombre_comercial, e.razon_social, e.activo,
        e.tope_monto_venta_centimos, e.requiere_evidencia_en_venta,
        e.dias_retroactivos_venta,
        (SELECT count(*)::int FROM usuarios u WHERE u.empresa_id = e.id) AS total_usuarios,
        (SELECT count(*)::int FROM empleados em WHERE em.empresa_id = e.id) AS total_empleados,
        (SELECT count(*)::int FROM convenios c
          WHERE c.empresa_a_id = e.id OR c.empresa_b_id = e.id) AS total_convenios
      FROM empresas e
      ${where}
      ORDER BY e.nombre_comercial ASC, e.id ASC
      LIMIT ${POR_PAGINA + 1}
    `),
  );

  const haySiguiente = filas.length > POR_PAGINA;
  const pagina = haySiguiente ? filas.slice(0, POR_PAGINA) : filas;

  let total: number | undefined;
  if (!cursor) {
    const conteo = obtenerFilas(
      await db.execute(sql`SELECT count(*)::int AS n FROM empresas e ${where}`),
    )[0];
    total = Number(conteo?.n ?? 0);
  }

  const ultimo = pagina[pagina.length - 1];
  return {
    items: pagina.map((f) => ({
      id: String(f.id),
      ruc: String(f.ruc),
      nombreComercial: String(f.nombre_comercial),
      razonSocial: String(f.razon_social),
      activo: Boolean(f.activo),
      topeMontoVentaCentimos: Number(f.tope_monto_venta_centimos ?? 0),
      requiereEvidenciaEnVenta: Boolean(f.requiere_evidencia_en_venta),
      diasRetroactivosVenta: Number(f.dias_retroactivos_venta ?? 0),
      totalUsuarios: Number(f.total_usuarios ?? 0),
      totalEmpleados: Number(f.total_empleados ?? 0),
      totalConvenios: Number(f.total_convenios ?? 0),
    })),
    cursor: haySiguiente && ultimo ? codificarCursor(ultimo) : null,
    total,
  };
}

/** Cuántos usuarios tiene la empresa (diálogo de confirmación al desactivar). */
export async function contarUsuariosEmpresa(
  ctx: SessionContext,
  empresaId: string,
): Promise<number> {
  requireRol(ctx, ["SUPERADMIN"]);
  const filas = obtenerFilas(
    await db.execute(
      sql`SELECT count(*)::int AS n FROM usuarios WHERE empresa_id = ${empresaId}`,
    ),
  );
  return Number(filas[0]?.n ?? 0);
}

function decodificarCursor(
  cursor: string | undefined,
): { nombre: string; id: string } | null {
  if (!cursor) {
    return null;
  }
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof raw.nombre === "string" &&
      typeof raw.id === "string" &&
      raw.nombre &&
      raw.id
    ) {
      return { nombre: raw.nombre, id: raw.id };
    }
  } catch {
    // cursor inválido: se ignora
  }
  return null;
}

function codificarCursor(fila: Record<string, unknown>): string {
  return Buffer.from(
    JSON.stringify({
      nombre: String(fila.nombre_comercial),
      id: String(fila.id),
    }),
    "utf8",
  ).toString("base64url");
}
