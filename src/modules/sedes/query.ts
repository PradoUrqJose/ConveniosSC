import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import { hoyLima, sumarDias } from "@/lib/fechas";
import type { Pagina } from "@/lib/tipos";

export type FilaSede = {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  empresaId: string;
  empresaNombre: string;
  totalVentas30d: number;
};

export type EmpresaSedeOpcion = { id: string; nombreComercial: string };

export const POR_PAGINA_SEDES = 18;
const LIMITE_OPCIONES = 50;

/** Lista paginada; un ADMIN_EMPRESA siempre queda acotado a su empresa. */
export async function listarSedes(
  ctx: SessionContext,
  entrada: {
    empresaId?: string;
    activo?: boolean;
    q?: string;
    cursor?: string;
  },
): Promise<Pagina<FilaSede>> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

  const empresaId =
    ctx.rol === "SUPERADMIN" ? (entrada.empresaId ?? null) : ctx.empresaId;
  const cursor = decodificarCursor(entrada.cursor);
  const desde = sumarDias(hoyLima(), -30);
  const condiciones = [
    empresaId ? sql`s.empresa_id = ${empresaId}` : undefined,
    entrada.activo !== undefined
      ? sql`s.activo = ${entrada.activo}`
      : undefined,
    entrada.q
      ? sql`(s.nombre ILIKE ${`%${entrada.q}%`} OR COALESCE(s.direccion, '') ILIKE ${`%${entrada.q}%`})`
      : undefined,
    cursor
      ? sql`(s.nombre, s.id) > (${cursor.nombre}, ${cursor.id})`
      : undefined,
  ].filter((condicion) => condicion !== undefined) as ReturnType<typeof sql>[];
  const where = condiciones.length
    ? sql`WHERE ${sql.join(condiciones, sql` AND `)}`
    : sql``;

  const filasPromise = db.execute(sql`
      WITH pagina AS (
        SELECT s.id, s.nombre, s.direccion, s.activo, s.empresa_id
        FROM sedes s
        ${where}
        ORDER BY s.nombre ASC, s.id ASC
        LIMIT ${POR_PAGINA_SEDES + 1}
      )
      SELECT s.id, s.nombre, s.direccion, s.activo, s.empresa_id,
        e.nombre_comercial AS empresa_nombre,
        COALESCE(metricas.total_ventas_30d, 0)::int AS total_ventas_30d
      FROM pagina s
      JOIN empresas e ON e.id = s.empresa_id
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS total_ventas_30d
        FROM ventas v
        WHERE v.sede_id = s.id
          AND v.estado = 'REGISTRADA'
          AND v.fecha_venta >= ${desde}
      ) metricas ON TRUE
      ORDER BY s.nombre ASC, s.id ASC
    `);
  const conteoPromise = cursor
    ? null
    : db.execute(sql`SELECT count(*)::int AS n FROM sedes s ${where}`);
  const [filasResultado, conteoResultado] = await Promise.all([
    filasPromise,
    conteoPromise,
  ]);
  const filas = obtenerFilas(filasResultado);
  const haySiguiente = filas.length > POR_PAGINA_SEDES;
  const pagina = haySiguiente ? filas.slice(0, POR_PAGINA_SEDES) : filas;
  const ultimo = pagina[pagina.length - 1];

  return {
    items: pagina.map((fila) => ({
      id: String(fila.id),
      nombre: String(fila.nombre),
      direccion: fila.direccion === null ? null : String(fila.direccion),
      activo: Boolean(fila.activo),
      empresaId: String(fila.empresa_id),
      empresaNombre: String(fila.empresa_nombre),
      totalVentas30d: Number(fila.total_ventas_30d ?? 0),
    })),
    cursor: haySiguiente && ultimo ? codificarCursor(ultimo) : null,
    total: conteoResultado
      ? Number(obtenerFilas(conteoResultado)[0]?.n ?? 0)
      : undefined,
  };
}

/** Opciones acotadas para que el selector no descargue todo el catálogo. */
export async function buscarEmpresasParaSedes(
  ctx: SessionContext,
  q = "",
): Promise<EmpresaSedeOpcion[]> {
  requireRol(ctx, ["SUPERADMIN"]);
  const where = q
    ? sql`WHERE (nombre_comercial || ' ' || razon_social) ILIKE ${`%${q}%`}`
    : sql``;
  const filas = obtenerFilas(
    await db.execute(sql`
      SELECT id, nombre_comercial FROM empresas
      ${where}
      ORDER BY nombre_comercial ASC
      LIMIT ${LIMITE_OPCIONES}
    `),
  );
  return filas.map((fila) => ({
    id: String(fila.id),
    nombreComercial: String(fila.nombre_comercial),
  }));
}

/** Etiqueta del filtro seleccionado al restaurar una URL compartida. */
export async function obtenerEmpresaSedes(
  ctx: SessionContext,
  empresaId: string | undefined,
): Promise<EmpresaSedeOpcion | null> {
  if (!empresaId || ctx.rol !== "SUPERADMIN") return null;
  const filas = obtenerFilas(
    await db.execute(sql`
      SELECT id, nombre_comercial FROM empresas WHERE id = ${empresaId} LIMIT 1
    `),
  );
  const fila = filas[0];
  return fila
    ? { id: String(fila.id), nombreComercial: String(fila.nombre_comercial) }
    : null;
}

function decodificarCursor(
  cursor: string | undefined,
): { nombre: string; id: string } | null {
  if (!cursor) return null;
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return typeof raw.nombre === "string" &&
      raw.nombre &&
      typeof raw.id === "string" &&
      raw.id
      ? { nombre: raw.nombre, id: raw.id }
      : null;
  } catch {
    return null;
  }
}

function codificarCursor(fila: Record<string, unknown>): string {
  return Buffer.from(
    JSON.stringify({ nombre: String(fila.nombre), id: String(fila.id) }),
    "utf8",
  ).toString("base64url");
}
