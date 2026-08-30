import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas, type TransaccionAuditada } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import type { RolUsuario } from "@/lib/auth/sesion";
import { hoyLima, sumarDias } from "@/lib/fechas";
import type { Pagina } from "@/lib/tipos";
import type { TipoDocumento } from "@/lib/zod";

export type FilaUsuario = {
  id: string;
  username: string;
  nombres: string;
  apellidos: string;
  rol: RolUsuario;
  empresaId: string | null;
  empresaNombre: string | null;
  activo: boolean;
  empleadoId: string | null;
  sedePorDefectoId: string | null;
  ultimoAccesoAt: string | null;
  debeCambiarPassword: boolean;
  /** `true` mientras `bloqueado_hasta` siga en el futuro (5 intentos fallidos). */
  bloqueado: boolean;
  ventas30d: number;
};

export type EmpresaOpcion = { id: string; nombreComercial: string };
export type EmpleadoOpcion = {
  id: string;
  empresaId: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
};
export type SedeOpcion = { id: string; empresaId: string; nombre: string };

const POR_PAGINA = 20;
const LIMITE_OPCIONES = 50;

/** `listarUsuarios` (03 §5). El ADMIN_EMPRESA ve solo su empresa. */
export async function listarUsuarios(
  ctx: SessionContext,
  entrada: {
    empresaId?: string;
    rol?: RolUsuario;
    activo?: boolean;
    q?: string;
    cursor?: string;
  },
): Promise<Pagina<FilaUsuario>> {
  requireRol(ctx, ["SUPERADMIN"]);
  const hoy = hoyLima();

  const { empresaId, rol, activo, q, cursor } = entrada;
  const empresaFiltro =
    ctx.rol === "ADMIN_EMPRESA" ? ctx.empresaId : (empresaId ?? null);
  const cursorDatos = decodificarCursor(cursor);

  const condicion = [
    empresaFiltro ? sql`u.empresa_id = ${empresaFiltro}` : undefined,
    rol ? sql`u.rol = ${rol}` : undefined,
    activo !== undefined ? sql`u.activo = ${activo}` : undefined,
    q
      ? sql`((u.username || ' ' || u.nombres || ' ' || u.apellidos) ILIKE ${`%${q}%`})`
      : undefined,
    cursorDatos
      ? sql`(u.username, u.id) > (${cursorDatos.username}, ${cursorDatos.id})`
      : undefined,
  ].filter((c) => c !== undefined) as ReturnType<typeof sql>[];

  const where = condicion.length
    ? sql`WHERE ${sql.join(condicion, sql` AND `)}`
    : sql``;

  const filasPromise = db.execute(sql`
      SELECT u.id, u.username, u.nombres, u.apellidos, u.rol, u.empresa_id,
        e.nombre_comercial AS empresa_nombre, u.activo, u.ultimo_acceso_at,
        u.debe_cambiar_password, u.empleado_id, u.sede_por_defecto_id,
        (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > now()) AS bloqueado,
        COALESCE(metricas.ventas_30d, 0)::int AS ventas_30d
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      LEFT JOIN (
        SELECT v.vendedor_usuario_id, count(*)::int AS ventas_30d
        FROM ventas v
        WHERE v.estado = 'REGISTRADA'
          AND v.fecha_venta >= ${sumarDias(hoy, -29)}
        GROUP BY v.vendedor_usuario_id
      ) metricas ON metricas.vendedor_usuario_id = u.id
      ${where}
      ORDER BY u.username ASC, u.id ASC
      LIMIT ${POR_PAGINA + 1}
    `);
  const conteoPromise = cursor
    ? null
    : db.execute(sql`SELECT count(*)::int AS n FROM usuarios u ${where}`);
  const [filasResultado, conteoResultado] = await Promise.all([
    filasPromise,
    conteoPromise,
  ]);
  const filas = obtenerFilas(filasResultado);

  const haySiguiente = filas.length > POR_PAGINA;
  const pagina = haySiguiente ? filas.slice(0, POR_PAGINA) : filas;

  let total: number | undefined;
  if (conteoResultado) {
    const conteo = obtenerFilas(conteoResultado)[0];
    total = Number(conteo?.n ?? 0);
  }

  const ultimo = pagina[pagina.length - 1];
  return {
    items: pagina.map((f) => ({
      id: String(f.id),
      username: String(f.username),
      nombres: String(f.nombres),
      apellidos: String(f.apellidos),
      rol: String(f.rol) as RolUsuario,
      empresaId: f.empresa_id === null ? null : String(f.empresa_id),
      empresaNombre:
        f.empresa_nombre === null ? null : String(f.empresa_nombre),
      activo: Boolean(f.activo),
      empleadoId: f.empleado_id === null ? null : String(f.empleado_id),
      sedePorDefectoId:
        f.sede_por_defecto_id === null ? null : String(f.sede_por_defecto_id),
      ultimoAccesoAt:
        f.ultimo_acceso_at === null ? null : String(f.ultimo_acceso_at),
      debeCambiarPassword: Boolean(f.debe_cambiar_password),
      bloqueado: Boolean(f.bloqueado),
      ventas30d: Number(f.ventas_30d ?? 0),
    })),
    cursor: haySiguiente && ultimo ? codificarCursor(ultimo) : null,
    total,
  };
}

/** Empresas para el filtro y el formulario (solo SUPERADMIN). */
export async function listarEmpresasOpciones(
  ctx: SessionContext,
  entrada: { q?: string } = {},
  ejecutor: TransaccionAuditada = db,
): Promise<EmpresaOpcion[]> {
  requireRol(ctx, ["SUPERADMIN"]);
  const where = entrada.q
    ? sql`WHERE (nombre_comercial || ' ' || razon_social) ILIKE ${`%${entrada.q}%`}`
    : sql``;
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT id, nombre_comercial FROM empresas ${where}
      ORDER BY nombre_comercial ASC LIMIT ${LIMITE_OPCIONES}
    `),
  );
  return filas.map((f) => ({
    id: String(f.id),
    nombreComercial: String(f.nombre_comercial),
  }));
}

/** Empleados (formulario de usuario). El ADMIN_EMPRESA ve solo los suyos. */
export async function listarEmpleadosOpciones(
  ctx: SessionContext,
  entrada: { q?: string; empresaId?: string } = {},
  ejecutor: TransaccionAuditada = db,
): Promise<EmpleadoOpcion[]> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  const condicion = [
    ctx.rol === "ADMIN_EMPRESA"
      ? sql`em.empresa_id = ${ctx.empresaId}`
      : entrada.empresaId
        ? sql`em.empresa_id = ${entrada.empresaId}`
        : undefined,
    entrada.q
      ? sql`(em.dni = ${entrada.q} OR (em.nombres || ' ' || em.apellidos) ILIKE ${`%${entrada.q}%`})`
      : undefined,
  ].filter((c) => c !== undefined) as ReturnType<typeof sql>[];
  const where = condicion.length
    ? sql`WHERE ${sql.join(condicion, sql` AND `)}`
    : sql``;
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT em.id, em.empresa_id, em.tipo_documento, em.dni AS numero_documento, em.nombres, em.apellidos
      FROM empleados em
      ${where}
      ORDER BY em.apellidos ASC, em.nombres ASC LIMIT ${LIMITE_OPCIONES}
    `),
  );
  return filas.map((f) => ({
    id: String(f.id),
    empresaId: String(f.empresa_id),
    tipoDocumento: String(f.tipo_documento) as TipoDocumento,
    numeroDocumento: String(f.numero_documento),
    nombres: String(f.nombres),
    apellidos: String(f.apellidos),
  }));
}

/** Sedes (formulario de usuario). El ADMIN_EMPRESA ve solo las suyas. */
export async function listarSedesOpciones(
  ctx: SessionContext,
  entrada: { q?: string; empresaId?: string } = {},
  ejecutor: TransaccionAuditada = db,
): Promise<SedeOpcion[]> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  const condicion = [
    ctx.rol === "ADMIN_EMPRESA"
      ? sql`s.empresa_id = ${ctx.empresaId}`
      : entrada.empresaId
        ? sql`s.empresa_id = ${entrada.empresaId}`
        : undefined,
    entrada.q ? sql`s.nombre ILIKE ${`%${entrada.q}%`}` : undefined,
  ].filter((c) => c !== undefined) as ReturnType<typeof sql>[];
  const where = condicion.length
    ? sql`WHERE ${sql.join(condicion, sql` AND `)}`
    : sql``;
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT s.id, s.empresa_id, s.nombre FROM sedes s
      ${where}
      ORDER BY s.nombre ASC LIMIT ${LIMITE_OPCIONES}
    `),
  );
  return filas.map((f) => ({
    id: String(f.id),
    empresaId: String(f.empresa_id),
    nombre: String(f.nombre),
  }));
}

function decodificarCursor(
  cursor: string | undefined,
): { username: string; id: string } | null {
  if (!cursor) {
    return null;
  }
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof raw.username === "string" &&
      typeof raw.id === "string" &&
      raw.username &&
      raw.id
    ) {
      return { username: raw.username, id: raw.id };
    }
  } catch {
    // cursor inválido: se ignora
  }
  return null;
}

function codificarCursor(fila: Record<string, unknown>): string {
  return Buffer.from(
    JSON.stringify({
      username: String(fila.username),
      id: String(fila.id),
    }),
    "utf8",
  ).toString("base64url");
}
