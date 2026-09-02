import { sql, type SQL } from "drizzle-orm";

import { after } from "next/server";

import { db, dbTx } from "@/db";
import { registrar } from "@/lib/audit/registrar";
import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { obtenerFilas } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import { hoyLima, sumarDias } from "@/lib/fechas";
import type { Pagina, Resultado } from "@/lib/tipos";
import { zDocumentoIdentidad, type TipoDocumento } from "@/lib/zod";

export type EstadoEmpleado =
  "PENDIENTE_VERIFICACION" | "ACTIVO" | "RECHAZADO" | "INACTIVO";

export type OrdenEmpleados =
  "nombre_asc" | "nombre_desc" | "monto_desc" | "reciente";
export type ActividadEmpleados = "con_compras" | "sin_compras";

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

export const POR_PAGINA_EMPLEADOS = 20;
/** Tope defensivo de filas por exportación (03 §6, issue #41). */
const LIMITE_EXPORTACION = 20_000;

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
  /**
   * Solo lo pasan las pruebas de aceptación, que abren su propia transacción.
   * Sin él se usa la conexión normal y la auditoría se difiere.
   */
  ejecutor?: TransaccionAuditada,
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
  const ventanaSegundos = VENTANA_BUSQUEDA_MS / 1000;
  const enTransaccionAjena = ejecutor !== undefined;
  const ex = ejecutor ?? db;

  /**
   * La auditoría no cambia la respuesta, así que no debe hacerla esperar: son
   * tres idas y vueltas (lock, último hash, insert) de las seis que tenía esta
   * búsqueda. `after` la deja correr tras responder, igual que `requireSession`
   * hace con `refrescarUltimoUso`.
   *
   * Va en una transacción real (`dbTx`) y no en la conexión HTTP: la cadena de
   * hashes se protege con `pg_advisory_xact_lock`, que solo dura lo que dura la
   * transacción. Sobre neon-http cada sentencia es su propia transacción, así
   * que ese lock se soltaba de inmediato y no protegía nada.
   */
  const anotar = async (empleadoId: string | null, resultado: string) => {
    if (enTransaccionAjena) {
      await auditar(
        ex,
        ctx,
        tipoDocumento,
        numeroDocumento,
        empleadoId,
        resultado,
      );
      return;
    }
    after(async () => {
      try {
        await dbTx().transaction((tx) =>
          auditar(
            tx,
            ctx,
            tipoDocumento,
            numeroDocumento,
            empleadoId,
            resultado,
          ),
        );
      } catch (error) {
        console.error("[auditoria] BUSQUEDA_DOCUMENTO vía dbTx", error);
        try {
          // Sin `DATABASE_URL_UNPOOLED` no hay transacción posible. Se registra
          // igual por HTTP: la cadena queda sin el lock, pero perder el rastro
          // de una búsqueda de datos personales es peor que un hash disputado.
          await auditar(
            db,
            ctx,
            tipoDocumento,
            numeroDocumento,
            empleadoId,
            resultado,
          );
        } catch (error2) {
          console.error("[auditoria] BUSQUEDA_DOCUMENTO perdida", error2);
        }
      }
    });
  };

  // Un único viaje a la base: el control de frecuencia y la búsqueda van en la
  // misma sentencia. Eran dos idas y vueltas de ~95 ms contra Neon y el
  // resultado de la primera solo servía para decidir si seguir.
  const filas = obtenerFilas(
    await ex.execute(sql`
      WITH limite AS (
        INSERT INTO rate_limits (clave, ventana_inicio, contador)
        VALUES (${`documento:${ctx.usuarioId}`}, now(), 1)
        ON CONFLICT (clave) DO UPDATE SET
          ventana_inicio = CASE
            WHEN rate_limits.ventana_inicio
                 < now() - make_interval(secs => ${ventanaSegundos})
            THEN now() ELSE rate_limits.ventana_inicio
          END,
          contador = CASE
            WHEN rate_limits.ventana_inicio
                 < now() - make_interval(secs => ${ventanaSegundos})
            THEN 1 ELSE rate_limits.contador + 1
          END
        RETURNING contador
      ),
      encontrado AS (
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
      )
      -- \`limite\` siempre devuelve una fila; \`encontrado\`, cero o una.
      SELECT l.contador, e.*
      FROM limite l
      LEFT JOIN encontrado e ON TRUE
    `),
  );
  const fila = filas[0];

  if (Number(fila?.contador ?? 1) > LIMITE_BUSQUEDAS) {
    return {
      ok: false,
      codigo: "LIMITE_EXCEDIDO",
      mensaje:
        "Demasiadas búsquedas por documento. Inténtalo de nuevo en un minuto.",
    };
  }

  if (!fila?.id) {
    await anotar(null, "NO_EXISTE");
    return {
      ok: true,
      data: { encontrado: false, motivo: "NO_EXISTE" },
    };
  }

  const estado = String(fila.estado) as EstadoEmpleado;
  const empleadoId = String(fila.id);
  const empresaEmpleado = String(fila.empresa_id);

  if (estado === "RECHAZADO" || estado === "INACTIVO") {
    await anotar(empleadoId, "NO_HABILITADO");
    return {
      ok: true,
      data: { encontrado: false, motivo: "NO_HABILITADO" },
    };
  }

  if (ctx.empresaId !== null && empresaEmpleado === ctx.empresaId) {
    await anotar(empleadoId, "PROPIA_EMPRESA");
    return {
      ok: true,
      data: { encontrado: false, motivo: "PROPIA_EMPRESA" },
    };
  }

  if (fila.convenio_id === null || fila.convenio_id === undefined) {
    await anotar(empleadoId, "SIN_CONVENIO");
    return {
      ok: true,
      data: {
        encontrado: false,
        motivo: "SIN_CONVENIO",
        empresaNombre: String(fila.empresa_nombre),
      },
    };
  }

  await anotar(empleadoId, "ENCONTRADO");
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

function mapearFilaEmpleado(f: Record<string, unknown>): FilaEmpleado {
  return {
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
  };
}

/** Fragmento `ORDER BY` para cada valor de `OrdenEmpleados`. */
function fragmentoOrdenEmpleados(orden: OrdenEmpleados): SQL {
  switch (orden) {
    case "nombre_desc":
      return sql`em.apellidos DESC, em.nombres DESC, em.id DESC`;
    case "monto_desc":
      return sql`COALESCE(metricas.monto_30d, 0) DESC, em.id DESC`;
    case "reciente":
      return sql`em.created_at DESC, em.id DESC`;
    case "nombre_asc":
    default:
      return sql`em.apellidos ASC, em.nombres ASC, em.id ASC`;
  }
}

type CursorEmpleados =
  | { apellidos: string; nombres: string; id: string }
  | { monto: string; id: string }
  | { creadoEn: string; id: string };

/**
 * Condición de keyset pagination para el siguiente registro tras `cursor`,
 * coherente con `fragmentoOrdenEmpleados`. `metricas` ya está unida en
 * `listarEmpleados`, así que `monto_desc` puede referenciarla directamente.
 */
function condicionCursorEmpleados(
  orden: OrdenEmpleados,
  cursor: CursorEmpleados | null,
): SQL | undefined {
  if (!cursor) return undefined;
  switch (orden) {
    case "nombre_desc": {
      const c = cursor as { apellidos: string; nombres: string; id: string };
      return sql`(em.apellidos, em.nombres, em.id) < (${c.apellidos}, ${c.nombres}, ${c.id})`;
    }
    case "monto_desc": {
      const c = cursor as { monto: string; id: string };
      return sql`(COALESCE(metricas.monto_30d, 0), em.id) < (${Number(c.monto)}, ${c.id})`;
    }
    case "reciente": {
      const c = cursor as { creadoEn: string; id: string };
      return sql`(em.created_at, em.id) < (${c.creadoEn}, ${c.id})`;
    }
    case "nombre_asc":
    default: {
      const c = cursor as { apellidos: string; nombres: string; id: string };
      return sql`(em.apellidos, em.nombres, em.id) > (${c.apellidos}, ${c.nombres}, ${c.id})`;
    }
  }
}

function decodificarCursor(
  cursor: string | undefined,
  orden: OrdenEmpleados,
): CursorEmpleados | null {
  if (!cursor) return null;
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof raw.id !== "string" || !raw.id) return null;
    if (orden === "monto_desc") {
      return typeof raw.monto === "string" && Number.isFinite(Number(raw.monto))
        ? { monto: raw.monto, id: raw.id }
        : null;
    }
    if (orden === "reciente") {
      return typeof raw.creadoEn === "string" && raw.creadoEn
        ? { creadoEn: raw.creadoEn, id: raw.id }
        : null;
    }
    return typeof raw.apellidos === "string" &&
      typeof raw.nombres === "string" &&
      raw.apellidos &&
      raw.nombres
      ? { apellidos: raw.apellidos, nombres: raw.nombres, id: raw.id }
      : null;
  } catch {
    return null;
  }
}

function codificarCursor(
  fila: Record<string, unknown>,
  orden: OrdenEmpleados,
): string {
  const base =
    orden === "monto_desc"
      ? { monto: String(fila.monto_30d ?? 0) }
      : orden === "reciente"
        ? { creadoEn: String(fila.created_at) }
        : { apellidos: String(fila.apellidos), nombres: String(fila.nombres) };
  return Buffer.from(
    JSON.stringify({ ...base, id: String(fila.id) }),
    "utf8",
  ).toString("base64url");
}

/**
 * Condiciones de filtro comunes a `listarEmpleados` y `exportarEmpleados`:
 * alcance por empresa, estado, texto y actividad de compra. No incluyen el
 * cursor de paginación, que cada consumidor añade por separado.
 */
function condicionesFiltroEmpleados(
  ctx: SessionContext,
  entrada: {
    empresaId?: string;
    estado?: EstadoEmpleado;
    q?: string;
    actividad?: ActividadEmpleados;
  },
  ventana30d: string,
): SQL[] {
  const empresaFiltro =
    ctx.rol === "ADMIN_EMPRESA" ? ctx.empresaId : (entrada.empresaId ?? null);
  const existeCompra30d = sql`EXISTS (
    SELECT 1 FROM ventas v
    WHERE v.empleado_comprador_id = em.id
      AND v.estado = 'REGISTRADA'
      AND v.fecha_venta >= ${ventana30d}
  )`;
  return [
    empresaFiltro ? sql`em.empresa_id = ${empresaFiltro}` : undefined,
    entrada.estado ? sql`em.estado = ${entrada.estado}` : undefined,
    entrada.q
      ? sql`(em.dni = ${entrada.q} OR (em.nombres || ' ' || em.apellidos) ILIKE ${`%${entrada.q}%`})`
      : undefined,
    entrada.actividad === "con_compras"
      ? existeCompra30d
      : entrada.actividad === "sin_compras"
        ? sql`NOT ${existeCompra30d}`
        : undefined,
  ].filter((c) => c !== undefined) as SQL[];
}

const CAMPOS_EMPLEADO = sql`
  em.id, em.tipo_documento, em.dni AS numero_documento, em.nombres, em.apellidos, em.telefono, em.estado,
  em.empresa_id, em.created_at,
  emp.nombre_comercial AS empresa_nombre,
  (u.nombres || ' ' || u.apellidos) AS creado_por_nombre,
  COALESCE(metricas.compras_30d, 0)::int AS compras_30d,
  COALESCE(metricas.monto_30d, 0)::bigint AS monto_30d
`;

function joinsEmpleado(ventana30d: string): SQL {
  return sql`
    FROM empleados em
    JOIN empresas emp ON emp.id = em.empresa_id
    LEFT JOIN usuarios u ON u.id = em.creado_por_usuario_id
    LEFT JOIN (
      SELECT v.empleado_comprador_id,
        count(*)::int AS compras_30d,
        COALESCE(sum(v.monto_bruto_centimos), 0)::bigint AS monto_30d
      FROM ventas v
      WHERE v.estado = 'REGISTRADA'
        AND v.fecha_venta >= ${ventana30d}
      GROUP BY v.empleado_comprador_id
    ) metricas ON metricas.empleado_comprador_id = em.id
  `;
}

/**
 * `listarEmpleados` (03 §6): listado con filtros, orden y paginación por
 * cursor sobre todo el padrón filtrado (no solo la página visible — issue
 * #41). El ADMIN_EMPRESA ve solo los de su empresa.
 */
export async function listarEmpleados(
  ctx: SessionContext,
  entrada: {
    empresaId?: string;
    estado?: EstadoEmpleado;
    q?: string;
    orden?: OrdenEmpleados;
    actividad?: ActividadEmpleados;
    cursor?: string;
  },
): Promise<Pagina<FilaEmpleado>> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  const hoy = hoyLima();
  const ventana30d = sumarDias(hoy, -29);
  const orden = entrada.orden ?? "nombre_asc";
  const cursorDatos = decodificarCursor(entrada.cursor, orden);

  const condicionesFiltro = condicionesFiltroEmpleados(
    ctx,
    entrada,
    ventana30d,
  );
  const whereFiltros = condicionesFiltro.length
    ? sql`WHERE ${sql.join(condicionesFiltro, sql` AND `)}`
    : sql``;

  const condicionCursor = condicionCursorEmpleados(orden, cursorDatos);
  const condicionesPagina = condicionCursor
    ? [...condicionesFiltro, condicionCursor]
    : condicionesFiltro;
  const wherePagina = condicionesPagina.length
    ? sql`WHERE ${sql.join(condicionesPagina, sql` AND `)}`
    : sql``;

  const filasPromise = db.execute(sql`
      SELECT ${CAMPOS_EMPLEADO}
      ${joinsEmpleado(ventana30d)}
      ${wherePagina}
      ORDER BY ${fragmentoOrdenEmpleados(orden)}
      LIMIT ${POR_PAGINA_EMPLEADOS + 1}
    `);
  // Sin la optimización de reutilizar el conteo entre páginas que tiene
  // Ventas (navegación cliente con caché): aquí cada página es una
  // navegación de servidor completa, así que se recalcula siempre — es la
  // única forma de que "Mostrando X a Y de N" sea correcto en cualquier
  // página, no solo en la primera.
  const conteoPromise = db.execute(
    sql`SELECT count(*)::int AS n FROM empleados em ${whereFiltros}`,
  );
  const [filasResultado, conteoResultado] = await Promise.all([
    filasPromise,
    conteoPromise,
  ]);
  const filas = obtenerFilas(filasResultado);

  const haySiguiente = filas.length > POR_PAGINA_EMPLEADOS;
  const pagina = haySiguiente ? filas.slice(0, POR_PAGINA_EMPLEADOS) : filas;
  const total = Number(obtenerFilas(conteoResultado)[0]?.n ?? 0);
  const ultimo = pagina[pagina.length - 1];

  return {
    items: pagina.map(mapearFilaEmpleado),
    cursor: haySiguiente && ultimo ? codificarCursor(ultimo, orden) : null,
    total,
  };
}

/**
 * `exportarEmpleados` (issue #41): la misma consulta de `listarEmpleados`
 * pero sin paginación — el CSV debe cubrir el universo filtrado completo, no
 * solo la página visible. `LIMITE_EXPORTACION` es un tope defensivo; si se
 * alcanza, el resultado se marca `truncado` para que la ruta lo declare.
 */
export async function exportarEmpleados(
  ctx: SessionContext,
  entrada: {
    empresaId?: string;
    estado?: EstadoEmpleado;
    q?: string;
    orden?: OrdenEmpleados;
    actividad?: ActividadEmpleados;
  },
): Promise<{ filas: FilaEmpleado[]; total: number; truncado: boolean }> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  const hoy = hoyLima();
  const ventana30d = sumarDias(hoy, -29);
  const orden = entrada.orden ?? "nombre_asc";

  const condicionesFiltro = condicionesFiltroEmpleados(
    ctx,
    entrada,
    ventana30d,
  );
  const whereFiltros = condicionesFiltro.length
    ? sql`WHERE ${sql.join(condicionesFiltro, sql` AND `)}`
    : sql``;

  const [filasResultado, conteoResultado] = await Promise.all([
    db.execute(sql`
      SELECT ${CAMPOS_EMPLEADO}
      ${joinsEmpleado(ventana30d)}
      ${whereFiltros}
      ORDER BY ${fragmentoOrdenEmpleados(orden)}
      LIMIT ${LIMITE_EXPORTACION + 1}
    `),
    db.execute(
      sql`SELECT count(*)::int AS n FROM empleados em ${whereFiltros}`,
    ),
  ]);
  const filas = obtenerFilas(filasResultado);
  const truncado = filas.length > LIMITE_EXPORTACION;
  const pagina = truncado ? filas.slice(0, LIMITE_EXPORTACION) : filas;
  const total = Number(obtenerFilas(conteoResultado)[0]?.n ?? 0);

  return { filas: pagina.map(mapearFilaEmpleado), total, truncado };
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
  const hoy = hoyLima();

  const condicion =
    ctx.rol === "ADMIN_EMPRESA"
      ? sql`WHERE em.empresa_id = ${ctx.empresaId}`
      : sql``;
  // Antes eran dos subconsultas correlacionadas idénticas salvo el agregado
  // (count vs sum), cada una escaneando `ventas` completo: un único
  // `CROSS JOIN LATERAL` calcula ambos agregados en un solo recorrido.
  // `MAX(...)` es solo la forma de proyectar una columna no agrupada de una
  // fuente ya reducida a una fila junto a los `count(*) FILTER` de arriba,
  // sin repetir el `GROUP BY` de todo el SELECT.
  const fila = obtenerFilas(
    await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE em.estado = 'ACTIVO')::int AS activos,
        count(*) FILTER (WHERE em.estado = 'PENDIENTE_VERIFICACION')::int AS pendientes,
        count(*) FILTER (WHERE em.estado = 'INACTIVO')::int AS inactivos,
        count(*) FILTER (WHERE em.estado = 'RECHAZADO')::int AS rechazados,
        MAX(agregados.ventas_30d)::int AS ventas_30d,
        MAX(agregados.monto_30d)::bigint AS monto_30d
      FROM empleados em
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS ventas_30d,
          COALESCE(sum(v.monto_bruto_centimos), 0)::bigint AS monto_30d
        FROM ventas v
        JOIN empleados comprador ON comprador.id = v.empleado_comprador_id
        WHERE v.estado = 'REGISTRADA'
          AND v.fecha_venta >= ${sumarDias(hoy, -29)}
          ${ctx.rol === "ADMIN_EMPRESA" ? sql`AND comprador.empresa_id = ${ctx.empresaId}` : sql``}
      ) agregados
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
