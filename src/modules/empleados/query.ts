import { sql } from "drizzle-orm";

import { db } from "@/db";
import { registrar } from "@/lib/audit/registrar";
import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { obtenerFilas } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import { hoyLima, sumarDias } from "@/lib/fechas";
import { rateLimit } from "@/lib/rate-limit";
import type { Pagina, Resultado } from "@/lib/tipos";
import { zDocumentoIdentidad, type TipoDocumento } from "@/lib/zod";

export type EstadoEmpleado =
  "PENDIENTE_VERIFICACION" | "ACTIVO" | "RECHAZADO" | "INACTIVO";

export type FilaEmpleado = {
  id: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  estado: EstadoEmpleado;
  empresaId: string;
  empresaNombre: string;
  creadoPorNombre: string | null;
  createdAt: string;
  comprasUltimos30d: number;
  montoUltimos30d: number;
};

export type EmpresaOpcion = { id: string; nombreComercial: string };

export type ResumenEmpleados = {
  total: number;
  activos: number;
  pendientes: number;
  inactivos: number;
  rechazados: number;
  ventasUltimos30d: number;
  montoUltimos30d: number;
};

const POR_PAGINA = 20;
const HOY = hoyLima();

export type EmpleadoEncontrado = {
  id: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  empresaId: string;
  empresaNombre: string;
  estado: EstadoEmpleado;
  convenioId: string;
  descuentoBps: number;
};

export type ResultadoBusquedaDocumento =
  | { encontrado: true; empleado: EmpleadoEncontrado }
  | { encontrado: false; motivo: "NO_EXISTE" }
  | { encontrado: false; motivo: "PROPIA_EMPRESA" }
  | { encontrado: false; motivo: "SIN_CONVENIO"; empresaNombre: string }
  | { encontrado: false; motivo: "NO_HABILITADO" };

/** @deprecated Usa ResultadoBusquedaDocumento. */
export type ResultadoBusquedaDni = ResultadoBusquedaDocumento;

const LIMITE_BUSQUEDAS = 20;
const VENTANA_BUSQUEDA_MS = 60 * 1000;

/**
 * Búsqueda de empleado por tipo y número de documento con rate limit y
 * auditoría siempre. Los resultados negativos nunca revelan datos personales.
 */
export async function buscarPorDocumento(
  ctx: SessionContext,
  entrada:
    { tipoDocumento: TipoDocumento; numeroDocumento: string } | { dni: string },
  ejecutor: TransaccionAuditada = db,
): Promise<Resultado<ResultadoBusquedaDocumento>> {
  const parsed = zDocumentoIdentidad.safeParse(
    "dni" in entrada
      ? { tipoDocumento: "DNI", numeroDocumento: entrada.dni }
      : entrada,
  );
  if (!parsed.success) {
    return {
      ok: false,
      codigo: "VALIDACION",
      mensaje: parsed.error.issues[0]?.message ?? "Documento inválido",
      campo: "numeroDocumento",
    };
  }
  const { tipoDocumento, numeroDocumento } = parsed.data;
  const hoy = hoyLima();

  const control = await rateLimit(ejecutor, `documento:${ctx.usuarioId}`, {
    limite: LIMITE_BUSQUEDAS,
    ventanaMs: VENTANA_BUSQUEDA_MS,
  });
  if (!control.permitido) {
    return {
      ok: false,
      codigo: "LIMITE_EXCEDIDO",
      mensaje:
        "Demasiadas búsquedas por documento. Inténtalo de nuevo en un minuto.",
    };
  }

  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT e.id, e.empresa_id, e.tipo_documento, e.dni AS numero_documento,
             e.nombres, e.apellidos, e.telefono,
             e.estado, emp.nombre_comercial AS empresa_nombre,
             convenio.convenio_id, convenio.descuento_bps
      FROM empleados e
      JOIN empresas emp ON emp.id = e.empresa_id
      LEFT JOIN LATERAL (
        SELECT c.id AS convenio_id, ct.descuento_bps
        FROM convenios c
        JOIN convenio_terminos ct
          ON ct.convenio_id = c.id
         AND ct.empresa_otorgante_id = ${ctx.empresaId}::uuid
        WHERE c.estado = 'VIGENTE'
          AND ((c.empresa_a_id = e.empresa_id
                AND c.empresa_b_id = ${ctx.empresaId}::uuid)
            OR (c.empresa_b_id = e.empresa_id
                AND c.empresa_a_id = ${ctx.empresaId}::uuid))
          AND ${hoy} >= c.vigencia_desde
          AND (c.vigencia_hasta IS NULL OR ${hoy} <= c.vigencia_hasta)
          AND ct.vigencia_desde <= ${hoy}
          AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${hoy})
        ORDER BY ct.vigencia_desde DESC
        LIMIT 1
      ) convenio ON TRUE
      WHERE e.tipo_documento = ${tipoDocumento}
        AND e.dni = ${numeroDocumento}
      LIMIT 1
    `),
  );
  const fila = filas[0];
  if (!fila) {
    await auditar(
      ejecutor,
      ctx,
      tipoDocumento,
      numeroDocumento,
      null,
      "NO_EXISTE",
    );
    return {
      ok: true,
      data: { encontrado: false, motivo: "NO_EXISTE" },
    };
  }

  const estado = String(fila.estado) as EstadoEmpleado;
  const empleadoId = String(fila.id);
  const empresaEmpleado = String(fila.empresa_id);

  if (estado === "RECHAZADO" || estado === "INACTIVO") {
    await auditar(
      ejecutor,
      ctx,
      tipoDocumento,
      numeroDocumento,
      empleadoId,
      "NO_HABILITADO",
    );
    return {
      ok: true,
      data: { encontrado: false, motivo: "NO_HABILITADO" },
    };
  }

  if (ctx.empresaId !== null && empresaEmpleado === ctx.empresaId) {
    await auditar(
      ejecutor,
      ctx,
      tipoDocumento,
      numeroDocumento,
      empleadoId,
      "PROPIA_EMPRESA",
    );
    return {
      ok: true,
      data: { encontrado: false, motivo: "PROPIA_EMPRESA" },
    };
  }

  if (fila.convenio_id === null || fila.convenio_id === undefined) {
    await auditar(
      ejecutor,
      ctx,
      tipoDocumento,
      numeroDocumento,
      empleadoId,
      "SIN_CONVENIO",
    );
    return {
      ok: true,
      data: {
        encontrado: false,
        motivo: "SIN_CONVENIO",
        empresaNombre: String(fila.empresa_nombre),
      },
    };
  }

  await auditar(
    ejecutor,
    ctx,
    tipoDocumento,
    numeroDocumento,
    empleadoId,
    "ENCONTRADO",
  );
  return {
    ok: true,
    data: {
      encontrado: true,
      empleado: {
        id: empleadoId,
        tipoDocumento: String(fila.tipo_documento) as TipoDocumento,
        numeroDocumento: String(fila.numero_documento),
        nombres: String(fila.nombres),
        apellidos: String(fila.apellidos),
        telefono: (fila.telefono as string | null) ?? null,
        empresaId: empresaEmpleado,
        empresaNombre: String(fila.empresa_nombre),
        estado,
        convenioId: String(fila.convenio_id),
        descuentoBps: Number(fila.descuento_bps),
      },
    },
  };
}

/** @deprecated Adaptador transitorio para consumidores que todavía envían DNI. */
export async function buscarPorDni(
  ctx: SessionContext,
  entrada: { dni: string },
  ejecutor: TransaccionAuditada = db,
): Promise<Resultado<ResultadoBusquedaDocumento>> {
  return buscarPorDocumento(ctx, entrada, ejecutor);
}

async function auditar(
  ejecutor: TransaccionAuditada,
  ctx: SessionContext,
  tipoDocumento: TipoDocumento,
  numeroDocumento: string,
  empleadoId: string | null,
  resultado: string,
): Promise<void> {
  await registrar(ejecutor, {
    accion: "BUSQUEDA_DOCUMENTO",
    entidad: "empleado",
    entidadId: empleadoId ?? `documento:${tipoDocumento}:${numeroDocumento}`,
    actor: {
      usuarioId: ctx.usuarioId,
      empresaId: ctx.empresaId,
      rol: ctx.rol,
    },
    datosDespues: { tipoDocumento, numeroDocumento, resultado },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });
}

/**
 * Hay convenio VIGENTE hoy entre la empresa del administrador y la empresa en
 * la que se quiere crear el empleado. No requiere término.
 */
export async function existeConvenioVigenteCon(
  ctx: SessionContext,
  empresaId: string,
  ejecutor: TransaccionAuditada = db,
): Promise<boolean> {
  if (ctx.empresaId === null) {
    return false;
  }
  const hoy = hoyLima();
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT 1
      FROM convenios c
      WHERE c.estado = 'VIGENTE'
        AND ((c.empresa_a_id = ${empresaId}
              AND c.empresa_b_id = ${ctx.empresaId})
          OR (c.empresa_b_id = ${empresaId}
              AND c.empresa_a_id = ${ctx.empresaId}))
        AND ${hoy} >= c.vigencia_desde
        AND (c.vigencia_hasta IS NULL OR ${hoy} <= c.vigencia_hasta)
      LIMIT 1
    `),
  );
  return filas.length > 0;
}

/**
 * `listarEmpleados` (03 §6): listado con filtros y paginación por cursor.
 * El ADMIN_EMPRESA ve solo los de su empresa.
 */
export async function listarEmpleados(
  ctx: SessionContext,
  entrada: {
    empresaId?: string;
    estado?: EstadoEmpleado;
    q?: string;
    cursor?: string;
  },
): Promise<Pagina<FilaEmpleado>> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

  const { empresaId, estado, q, cursor } = entrada;
  const empresaFiltro =
    ctx.rol === "ADMIN_EMPRESA" ? ctx.empresaId : (empresaId ?? null);
  const cursorDatos = decodificarCursor(cursor);

  const condicion = [
    empresaFiltro ? sql`em.empresa_id = ${empresaFiltro}` : undefined,
    estado ? sql`em.estado = ${estado}` : undefined,
    q
      ? sql`(em.dni = ${q} OR em.nombres ILIKE ${`%${q}%`} OR em.apellidos ILIKE ${`%${q}%`})`
      : undefined,
    cursorDatos
      ? sql`(em.apellidos, em.nombres, em.id) > (${cursorDatos.apellidos}, ${cursorDatos.nombres}, ${cursorDatos.id})`
      : undefined,
  ].filter((c) => c !== undefined) as ReturnType<typeof sql>[];

  const where = condicion.length
    ? sql`WHERE ${sql.join(condicion, sql` AND `)}`
    : sql``;

  const filasPromise = db.execute(sql`
      SELECT em.id, em.tipo_documento, em.dni AS numero_documento, em.nombres, em.apellidos, em.telefono, em.estado,
        em.empresa_id, em.created_at,
        emp.nombre_comercial AS empresa_nombre,
        (u.nombres || ' ' || u.apellidos) AS creado_por_nombre,
        (SELECT count(*)::int FROM ventas v
           WHERE v.empleado_comprador_id = em.id
             AND v.estado = 'REGISTRADA'
             AND v.fecha_venta >= ${sumarDias(HOY, -29)}) AS compras_30d,
        (SELECT COALESCE(sum(v.monto_bruto_centimos), 0)::bigint FROM ventas v
           WHERE v.empleado_comprador_id = em.id
             AND v.estado = 'REGISTRADA'
             AND v.fecha_venta >= ${sumarDias(HOY, -29)}) AS monto_30d
      FROM empleados em
      JOIN empresas emp ON emp.id = em.empresa_id
      LEFT JOIN usuarios u ON u.id = em.creado_por_usuario_id
      ${where}
      ORDER BY em.apellidos ASC, em.nombres ASC, em.id ASC
      LIMIT ${POR_PAGINA + 1}
    `);
  const conteoPromise = cursor
    ? null
    : db.execute(sql`SELECT count(*)::int AS n FROM empleados em ${where}`);
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
      tipoDocumento: String(f.tipo_documento) as TipoDocumento,
      numeroDocumento: String(f.numero_documento),
      nombres: String(f.nombres),
      apellidos: String(f.apellidos),
      telefono: (f.telefono as string | null) ?? null,
      estado: String(f.estado) as EstadoEmpleado,
      empresaId: String(f.empresa_id),
      empresaNombre: String(f.empresa_nombre),
      creadoPorNombre:
        f.creado_por_nombre === null ? null : String(f.creado_por_nombre),
      createdAt: String(f.created_at),
      comprasUltimos30d: Number(f.compras_30d ?? 0),
      montoUltimos30d: Number(f.monto_30d ?? 0),
    })),
    cursor: haySiguiente && ultimo ? codificarCursor(ultimo) : null,
    total,
  };
}

/**
 * `contarPendientesVerificacion` (03 §6): badge de la navegación del admin.
 * El ADMIN_EMPRESA cuenta solo los de su empresa.
 */
export async function contarPendientesVerificacion(
  ctx: SessionContext,
  ejecutor: TransaccionAuditada = db,
): Promise<{ total: number }> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  const condicion =
    ctx.rol === "ADMIN_EMPRESA"
      ? sql`WHERE em.estado = 'PENDIENTE_VERIFICACION' AND em.empresa_id = ${ctx.empresaId}`
      : sql`WHERE em.estado = 'PENDIENTE_VERIFICACION'`;
  const conteo = obtenerFilas(
    await ejecutor.execute(
      sql`SELECT count(*)::int AS n FROM empleados em ${condicion}`,
    ),
  )[0];
  return { total: Number(conteo?.n ?? 0) };
}

/** Resumen del padrón visible para la cabecera de gestión de empleados. */
export async function resumirEmpleados(
  ctx: SessionContext,
): Promise<ResumenEmpleados> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

  const condicion =
    ctx.rol === "ADMIN_EMPRESA"
      ? sql`WHERE em.empresa_id = ${ctx.empresaId}`
      : sql``;
  const fila = obtenerFilas(
    await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE em.estado = 'ACTIVO')::int AS activos,
        count(*) FILTER (WHERE em.estado = 'PENDIENTE_VERIFICACION')::int AS pendientes,
        count(*) FILTER (WHERE em.estado = 'INACTIVO')::int AS inactivos,
        count(*) FILTER (WHERE em.estado = 'RECHAZADO')::int AS rechazados,
        COALESCE((
          SELECT count(*)::int
          FROM ventas v
          JOIN empleados comprador ON comprador.id = v.empleado_comprador_id
          WHERE v.estado = 'REGISTRADA'
            AND v.fecha_venta >= ${sumarDias(HOY, -29)}
            ${ctx.rol === "ADMIN_EMPRESA" ? sql`AND comprador.empresa_id = ${ctx.empresaId}` : sql``}
        ), 0)::int AS ventas_30d,
        COALESCE((
          SELECT sum(v.monto_bruto_centimos)::bigint
          FROM ventas v
          JOIN empleados comprador ON comprador.id = v.empleado_comprador_id
          WHERE v.estado = 'REGISTRADA'
            AND v.fecha_venta >= ${sumarDias(HOY, -29)}
            ${ctx.rol === "ADMIN_EMPRESA" ? sql`AND comprador.empresa_id = ${ctx.empresaId}` : sql``}
        ), 0)::bigint AS monto_30d
      FROM empleados em
      ${condicion}
    `),
  )[0];

  return {
    total: Number(fila?.total ?? 0),
    activos: Number(fila?.activos ?? 0),
    pendientes: Number(fila?.pendientes ?? 0),
    inactivos: Number(fila?.inactivos ?? 0),
    rechazados: Number(fila?.rechazados ?? 0),
    ventasUltimos30d: Number(fila?.ventas_30d ?? 0),
    montoUltimos30d: Number(fila?.monto_30d ?? 0),
  };
}

/**
 * Empresas entre las que se puede crear un empleado: para ADMIN_EMPRESA, la
 * propia y las que tienen convenio vigente; para SUPERADMIN, todas.
 */
export async function listarEmpresasParaEmpleado(
  ctx: SessionContext,
  ejecutor: TransaccionAuditada = db,
): Promise<EmpresaOpcion[]> {
  if (ctx.empresaId === null) {
    const filas = obtenerFilas(
      await ejecutor.execute(sql`
        SELECT id, nombre_comercial FROM empresas
        WHERE activo ORDER BY nombre_comercial ASC
      `),
    );
    return filas.map((f) => ({
      id: String(f.id),
      nombreComercial: String(f.nombre_comercial),
    }));
  }
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT DISTINCT e.id, e.nombre_comercial
      FROM empresas e
      LEFT JOIN convenios c
        ON ((c.empresa_a_id = e.id AND c.empresa_b_id = ${ctx.empresaId})
         OR (c.empresa_b_id = e.id AND c.empresa_a_id = ${ctx.empresaId}))
         AND c.estado = 'VIGENTE'
      WHERE e.activo
        AND (e.id = ${ctx.empresaId} OR c.id IS NOT NULL)
      ORDER BY e.nombre_comercial ASC
    `),
  );
  return filas.map((f) => ({
    id: String(f.id),
    nombreComercial: String(f.nombre_comercial),
  }));
}

function decodificarCursor(
  cursor: string | undefined,
): { apellidos: string; nombres: string; id: string } | null {
  if (!cursor) {
    return null;
  }
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof raw.apellidos === "string" &&
      typeof raw.nombres === "string" &&
      typeof raw.id === "string" &&
      raw.apellidos &&
      raw.nombres &&
      raw.id
    ) {
      return { apellidos: raw.apellidos, nombres: raw.nombres, id: raw.id };
    }
  } catch {
    // cursor inválido: se ignora
  }
  return null;
}

function codificarCursor(fila: Record<string, unknown>): string {
  return Buffer.from(
    JSON.stringify({
      apellidos: String(fila.apellidos),
      nombres: String(fila.nombres),
      id: String(fila.id),
    }),
    "utf8",
  ).toString("base64url");
}
