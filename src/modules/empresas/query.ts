import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas, type TransaccionAuditada } from "@/lib/audit/registrar";
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
  ejecutor: TransaccionAuditada = db,
): Promise<Pagina<FilaEmpresa>> {
  requireRol(ctx, ["SUPERADMIN"]);

  const { q, activo, cursor } = entrada;
  const cursorDatos = decodificarCursor(cursor);
  const condicion = [
    q
      ? sql`((e.nombre_comercial || ' ' || e.razon_social) ILIKE ${`%${q}%`} OR e.ruc LIKE ${`%${q}%`})`
      : undefined,
    activo !== undefined ? sql`e.activo = ${activo}` : undefined,
    cursorDatos
      ? sql`(e.nombre_comercial, e.id) > (${cursorDatos.nombre}, ${cursorDatos.id})`
      : undefined,
  ].filter((c) => c !== undefined) as ReturnType<typeof sql>[];

  const where = condicion.length
    ? sql`WHERE ${sql.join(condicion, sql` AND `)}`
    : sql``;

  // La página base se resuelve antes de contar relaciones. Así los GROUP BY
  // recorren solo los IDs que se van a mostrar y no todas las empresas.
  const filasPromise = ejecutor.execute(sql`
      WITH empresas_candidatas AS (
        SELECT e.id, e.ruc, e.nombre_comercial, e.razon_social, e.activo,
          e.tope_monto_venta_centimos, e.requiere_evidencia_en_venta,
          e.dias_retroactivos_venta
        FROM empresas e
        ${where}
        ORDER BY e.nombre_comercial ASC, e.id ASC
        LIMIT ${POR_PAGINA + 1}
      ),
      empresas_pagina AS (
        SELECT * FROM empresas_candidatas
        LIMIT ${POR_PAGINA}
      ),
      usuarios_pagina AS (
        SELECT u.empresa_id, count(*)::int AS total_usuarios
        FROM usuarios u
        JOIN empresas_pagina ep ON ep.id = u.empresa_id
        GROUP BY u.empresa_id
      ),
      empleados_pagina AS (
        SELECT em.empresa_id, count(*)::int AS total_empleados
        FROM empleados em
        JOIN empresas_pagina ep ON ep.id = em.empresa_id
        GROUP BY em.empresa_id
      ),
      convenios_pagina AS (
        SELECT ep.id AS empresa_id, count(c.id)::int AS total_convenios
        FROM empresas_pagina ep
        LEFT JOIN convenios c ON c.empresa_a_id = ep.id OR c.empresa_b_id = ep.id
        GROUP BY ep.id
      )
      SELECT ep.id, ep.ruc, ep.nombre_comercial, ep.razon_social, ep.activo,
        ep.tope_monto_venta_centimos, ep.requiere_evidencia_en_venta,
        ep.dias_retroactivos_venta,
        COALESCE(u.total_usuarios, 0)::int AS total_usuarios,
        COALESCE(em.total_empleados, 0)::int AS total_empleados,
        COALESCE(c.total_convenios, 0)::int AS total_convenios,
        (SELECT count(*) > ${POR_PAGINA} FROM empresas_candidatas) AS hay_siguiente
      FROM empresas_pagina ep
      LEFT JOIN usuarios_pagina u ON u.empresa_id = ep.id
      LEFT JOIN empleados_pagina em ON em.empresa_id = ep.id
      LEFT JOIN convenios_pagina c ON c.empresa_id = ep.id
      ORDER BY ep.nombre_comercial ASC, ep.id ASC
    `);
  const conteoPromise = cursor
    ? null
    : ejecutor.execute(sql`SELECT count(*)::int AS n FROM empresas e ${where}`);
  const [filasResultado, conteoResultado] = await Promise.all([
    filasPromise,
    conteoPromise,
  ]);
  const filas = obtenerFilas(filasResultado);

  const haySiguiente = Boolean(filas[0]?.hay_siguiente);
  const pagina = filas;

  let total: number | undefined;
  if (conteoResultado) {
    const conteo = obtenerFilas(conteoResultado)[0];
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
