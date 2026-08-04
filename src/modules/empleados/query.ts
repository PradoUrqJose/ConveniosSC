import { sql } from "drizzle-orm";

import { db } from "@/db";
import { registrar } from "@/lib/audit/registrar";
import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { obtenerFilas } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import { hoyLima, sumarDias } from "@/lib/fechas";
import { rateLimit } from "@/lib/rate-limit";
import type { Pagina, Resultado } from "@/lib/tipos";
import { zDni } from "@/lib/zod";

export type EstadoEmpleado =
  "PENDIENTE_VERIFICACION" | "ACTIVO" | "RECHAZADO" | "INACTIVO";

export type FilaEmpleado = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  estado: EstadoEmpleado;
  empresaId: string;
  empresaNombre: string;
  tieneFotoDni: boolean;
  fotoDniBlobPath: string | null;
  creadoPorNombre: string | null;
  createdAt: string;
  comprasUltimos30d: number;
  montoUltimos30d: number;
};

export type EmpresaOpcion = { id: string; nombreComercial: string };

const POR_PAGINA = 20;
const HOY = hoyLima();

export type EmpleadoEncontrado = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  empresaId: string;
  empresaNombre: string;
  estado: EstadoEmpleado;
  tieneFotoDni: boolean;
  convenioId: string;
  descuentoBps: number;
};

export type ResultadoBusquedaDni =
  | { encontrado: true; empleado: EmpleadoEncontrado }
  | { encontrado: false; motivo: "NO_EXISTE"; puedeCrear: true }
  | { encontrado: false; motivo: "PROPIA_EMPRESA" }
  | { encontrado: false; motivo: "SIN_CONVENIO"; empresaNombre: string }
  | { encontrado: false; motivo: "NO_HABILITADO" };

const LIMITE_BUSQUEDAS = 20;
const VENTANA_BUSQUEDA_MS = 60 * 1000;

/**
 * `buscarPorDni` (03 §6): búsqueda de empleado por DNI con rate limit
 * (02 §5: 20/min por usuario) y auditoría siempre (BUSQUEDA_DNI). Los casos
 * b, d y e revelan la existencia del DNI pero nunca datos personales.
 */
export async function buscarPorDni(
  ctx: SessionContext,
  entrada: { dni: string },
  ejecutor: TransaccionAuditada = db,
): Promise<Resultado<ResultadoBusquedaDni>> {
  const parsed = zDni.safeParse(entrada.dni);
  if (!parsed.success) {
    return {
      ok: false,
      codigo: "VALIDACION",
      mensaje: "El DNI debe tener 8 dígitos",
      campo: "dni",
    };
  }
  const dni = parsed.data;

  const control = await rateLimit(ejecutor, `dni:${ctx.usuarioId}`, {
    limite: LIMITE_BUSQUEDAS,
    ventanaMs: VENTANA_BUSQUEDA_MS,
  });
  if (!control.permitido) {
    return {
      ok: false,
      codigo: "LIMITE_EXCEDIDO",
      mensaje: "Demasiadas búsquedas por DNI. Inténtalo de nuevo en un minuto.",
    };
  }

  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT e.id, e.empresa_id, e.dni, e.nombres, e.apellidos, e.telefono,
             e.estado, emp.nombre_comercial AS empresa_nombre,
        EXISTS (
          SELECT 1 FROM adjuntos a
          WHERE a.empleado_id = e.id AND a.tipo = 'FOTO_DNI'
        ) AS tiene_foto
      FROM empleados e
      JOIN empresas emp ON emp.id = e.empresa_id
      WHERE e.dni = ${dni}
      LIMIT 1
    `),
  );
  const fila = filas[0];
  if (!fila) {
    await auditar(ejecutor, ctx, dni, null, "NO_EXISTE");
    return {
      ok: true,
      data: { encontrado: false, motivo: "NO_EXISTE", puedeCrear: true },
    };
  }

  const estado = String(fila.estado) as EstadoEmpleado;
  const empleadoId = String(fila.id);
  const empresaEmpleado = String(fila.empresa_id);

  if (estado === "RECHAZADO" || estado === "INACTIVO") {
    await auditar(ejecutor, ctx, dni, empleadoId, "NO_HABILITADO");
    return {
      ok: true,
      data: { encontrado: false, motivo: "NO_HABILITADO" },
    };
  }

  if (ctx.empresaId !== null && empresaEmpleado === ctx.empresaId) {
    await auditar(ejecutor, ctx, dni, empleadoId, "PROPIA_EMPRESA");
    return {
      ok: true,
      data: { encontrado: false, motivo: "PROPIA_EMPRESA" },
    };
  }

  const convenio = await buscarConvenioVigente(
    ejecutor,
    ctx,
    dni,
    empleadoId,
    empresaEmpleado,
  );
  if (!convenio) {
    await auditar(ejecutor, ctx, dni, empleadoId, "SIN_CONVENIO");
    return {
      ok: true,
      data: {
        encontrado: false,
        motivo: "SIN_CONVENIO",
        empresaNombre: String(fila.empresa_nombre),
      },
    };
  }

  await auditar(ejecutor, ctx, dni, empleadoId, "ENCONTRADO");
  return {
    ok: true,
    data: {
      encontrado: true,
      empleado: {
        id: empleadoId,
        dni: String(fila.dni),
        nombres: String(fila.nombres),
        apellidos: String(fila.apellidos),
        telefono: (fila.telefono as string | null) ?? null,
        empresaId: empresaEmpleado,
        empresaNombre: String(fila.empresa_nombre),
        estado,
        tieneFotoDni: fila.tiene_foto === true,
        convenioId: convenio.convenioId,
        descuentoBps: convenio.descuentoBps,
      },
    },
  };
}

async function buscarConvenioVigente(
  ejecutor: TransaccionAuditada,
  ctx: SessionContext,
  dni: string,
  empleadoId: string,
  empresaEmpleado: string,
): Promise<{ convenioId: string; descuentoBps: number } | null> {
  if (ctx.empresaId === null) {
    return null;
  }
  const hoy = hoyLima();
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT c.id AS convenio_id, ct.descuento_bps
      FROM convenios c
      JOIN convenio_terminos ct
        ON ct.convenio_id = c.id
       AND ct.empresa_otorgante_id = ${ctx.empresaId}
      WHERE c.estado = 'VIGENTE'
        AND ((c.empresa_a_id = ${empresaEmpleado}
              AND c.empresa_b_id = ${ctx.empresaId})
          OR (c.empresa_b_id = ${empresaEmpleado}
              AND c.empresa_a_id = ${ctx.empresaId}))
        AND ${hoy} >= c.vigencia_desde
        AND (c.vigencia_hasta IS NULL OR ${hoy} <= c.vigencia_hasta)
        AND ct.vigencia_desde <= ${hoy}
        AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${hoy})
      ORDER BY ct.vigencia_desde DESC
      LIMIT 1
    `),
  );
  const fila = filas[0];
  if (!fila) {
    return null;
  }
  return {
    convenioId: String(fila.convenio_id),
    descuentoBps: Number(fila.descuento_bps),
  };
}

async function auditar(
  ejecutor: TransaccionAuditada,
  ctx: SessionContext,
  dni: string,
  empleadoId: string | null,
  resultado: string,
): Promise<void> {
  await registrar(ejecutor, {
    accion: "BUSQUEDA_DNI",
    entidad: "empleado",
    entidadId: empleadoId ?? `dni:${dni}`,
    actor: {
      usuarioId: ctx.usuarioId,
      empresaId: ctx.empresaId,
      rol: ctx.rol,
    },
    datosDespues: { dni, resultado },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });
}

/**
 * `existeConvenioVigenteCon` (02 §4 «Crear empleado desde el formulario de
 * venta»): hay convenio VIGENTE hoy entre la empresa del actor y la del
 * empleado que se quiere crear. No requiere término: el descuento se evalúa al
 * registrar la venta.
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
      SELECT em.id, em.dni, em.nombres, em.apellidos, em.telefono, em.estado,
        em.empresa_id, em.created_at,
        emp.nombre_comercial AS empresa_nombre,
        (u.nombres || ' ' || u.apellidos) AS creado_por_nombre,
        EXISTS (
          SELECT 1 FROM adjuntos a
          WHERE a.empleado_id = em.id AND a.tipo = 'FOTO_DNI'
        ) AS tiene_foto,
        (SELECT a.blob_path FROM adjuntos a
           WHERE a.empleado_id = em.id AND a.tipo = 'FOTO_DNI' LIMIT 1) AS foto_dni_path,
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
      dni: String(f.dni),
      nombres: String(f.nombres),
      apellidos: String(f.apellidos),
      telefono: (f.telefono as string | null) ?? null,
      estado: String(f.estado) as EstadoEmpleado,
      empresaId: String(f.empresa_id),
      empresaNombre: String(f.empresa_nombre),
      tieneFotoDni: f.tiene_foto === true,
      fotoDniBlobPath:
        f.foto_dni_path === null ? null : String(f.foto_dni_path),
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

/**
 * Empresas entre las que se puede crear un empleado: para ADMIN_EMPRESA y
 * VENDEDOR, la propia y las que tienen convenio vigente; para SUPERADMIN, todas.
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
