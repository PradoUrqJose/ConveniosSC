import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas, type TransaccionAuditada } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import { calcularDescuento, type Centimos } from "@/lib/dinero";
import { fechaLimaDe, hoyLima } from "@/lib/fechas";
import type { CodigoError, Pagina, Resultado } from "@/lib/tipos";
import type { EstadoEmpleado } from "@/modules/empleados/query";

export type SedeOpcion = { id: string; nombre: string };

/**
 * Sedes activas de la propia empresa, para el selector del formulario de
 * venta (04 §4). A diferencia de `sedes/query.ts::listarSedes` (solo admin),
 * esta es accesible también al `VENDEDOR`: necesita elegir su sede para
 * registrar una venta.
 */
export async function sedesParaVenta(
  ctx: SessionContext,
  ejecutor: TransaccionAuditada = db,
): Promise<SedeOpcion[]> {
  requireRol(ctx, ["VENDEDOR", "ADMIN_EMPRESA"]);
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT id, nombre FROM sedes
      WHERE empresa_id = ${ctx.empresaId} AND activo
      ORDER BY nombre ASC
    `),
  );
  return filas.map((f) => ({ id: String(f.id), nombre: String(f.nombre) }));
}

export type ConfiguracionVenta = {
  topeMontoVentaCentimos: number;
  requiereEvidenciaEnVenta: boolean;
  diasRetroactivosVenta: number;
};

/**
 * Configuración de la propia empresa relevante para el formulario de venta
 * (tope, evidencia obligatoria, ventana retroactiva). No existía una query
 * de lectura de la propia empresa fuera de `SUPERADMIN`.
 */
export async function configuracionEmpresaVenta(
  ctx: SessionContext,
  ejecutor: TransaccionAuditada = db,
): Promise<ConfiguracionVenta> {
  requireRol(ctx, ["VENDEDOR", "ADMIN_EMPRESA"]);
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT tope_monto_venta_centimos, requiere_evidencia_en_venta,
             dias_retroactivos_venta
      FROM empresas WHERE id = ${ctx.empresaId}
    `),
  );
  const fila = filas[0];
  return {
    topeMontoVentaCentimos: Number(fila?.tope_monto_venta_centimos ?? 0),
    requiereEvidenciaEnVenta: Boolean(fila?.requiere_evidencia_en_venta),
    diasRetroactivosVenta: Number(fila?.dias_retroactivos_venta ?? 7),
  };
}

export type EmpleadoParaVenta = {
  id: string;
  empresaId: string;
  estado: EstadoEmpleado;
};

export type TerminoResuelto = {
  convenioId: string;
  terminoId: string;
  descuentoBps: number;
  empresaCompradoraId: string;
  empleado: EmpleadoParaVenta;
};

/**
 * Pasos 3-5 de `02-LOGICA-NEGOCIO.md §2`: resuelve el empleado comprador, el
 * convenio con mi empresa y el término vigente **a `fechaVenta`** (no a hoy —
 * una venta retroactiva usa el descuento que estaba vigente ese día). Se
 * comparte entre `crearVentaCore` y `previsualizarDescuento` para no
 * duplicar la lógica de resolución.
 */
export async function resolverTerminoVigente(
  ejecutor: TransaccionAuditada,
  ctx: SessionContext,
  empleadoCompradorId: string,
  fechaVenta: string,
): Promise<Resultado<TerminoResuelto>> {
  const errorGenerico = (
    codigo: CodigoError,
    mensaje: string,
    campo?: string,
  ): Resultado<never> => ({ ok: false, codigo, mensaje, campo });

  const filasEmpleado = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT id, empresa_id, estado FROM empleados
      WHERE id = ${empleadoCompradorId}
    `),
  );
  const empleadoFila = filasEmpleado[0];
  if (!empleadoFila) {
    return errorGenerico(
      "NO_ENCONTRADO",
      "El empleado no existe.",
      "empleadoCompradorId",
    );
  }
  const estado = String(empleadoFila.estado) as EstadoEmpleado;
  const empresaEmpleado = String(empleadoFila.empresa_id);

  if (estado === "RECHAZADO" || estado === "INACTIVO") {
    return errorGenerico(
      "REGLA_NEGOCIO",
      "Este empleado no está habilitado para el beneficio.",
      "empleadoCompradorId",
    );
  }
  if (empresaEmpleado === ctx.empresaId) {
    return errorGenerico(
      "REGLA_NEGOCIO",
      "No se registra una venta a un empleado de tu propia empresa.",
      "empleadoCompradorId",
    );
  }

  const filasTermino = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT c.id AS convenio_id, ct.id AS termino_id, ct.descuento_bps
      FROM convenios c
      JOIN convenio_terminos ct
        ON ct.convenio_id = c.id
       AND ct.empresa_otorgante_id = ${ctx.empresaId}
      WHERE c.estado = 'VIGENTE'
        AND ((c.empresa_a_id = ${empresaEmpleado} AND c.empresa_b_id = ${ctx.empresaId})
          OR (c.empresa_b_id = ${empresaEmpleado} AND c.empresa_a_id = ${ctx.empresaId}))
        AND ${fechaVenta} >= c.vigencia_desde
        AND (c.vigencia_hasta IS NULL OR ${fechaVenta} <= c.vigencia_hasta)
        AND ct.vigencia_desde <= ${fechaVenta}
        AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${fechaVenta})
      LIMIT 1
    `),
  );
  const terminoFila = filasTermino[0];
  if (!terminoFila) {
    return errorGenerico(
      "REGLA_NEGOCIO",
      "El convenio no tiene un descuento definido para esa fecha.",
      "fechaVenta",
    );
  }

  return {
    ok: true,
    data: {
      convenioId: String(terminoFila.convenio_id),
      terminoId: String(terminoFila.termino_id),
      descuentoBps: Number(terminoFila.descuento_bps),
      empresaCompradoraId: empresaEmpleado,
      empleado: { id: empleadoCompradorId, empresaId: empresaEmpleado, estado },
    },
  };
}

export type PrevisualizacionDescuento = {
  descuentoBps: number;
  montoDescuentoCentimos: Centimos;
  montoFinalCentimos: Centimos;
};

/**
 * `previsualizarDescuento` (03 §7): solo cosmético para el campo read-only
 * del formulario. `crearVenta` recalcula todo desde cero de todas formas.
 */
export async function previsualizarDescuento(
  ctx: SessionContext,
  entrada: {
    empleadoCompradorId: string;
    montoBrutoCentimos: Centimos;
    fechaVenta: string;
  },
): Promise<Resultado<PrevisualizacionDescuento>> {
  requireRol(ctx, ["VENDEDOR", "ADMIN_EMPRESA"]);

  const resuelto = await resolverTerminoVigente(
    db,
    ctx,
    entrada.empleadoCompradorId,
    entrada.fechaVenta,
  );
  if (!resuelto.ok) {
    return resuelto;
  }

  const { descuento, final } = calcularDescuento(
    entrada.montoBrutoCentimos,
    resuelto.data.descuentoBps,
  );
  return {
    ok: true,
    data: {
      descuentoBps: resuelto.data.descuentoBps,
      montoDescuentoCentimos: descuento,
      montoFinalCentimos: final,
    },
  };
}

export type EstadoVenta = "REGISTRADA" | "ANULADA";
export type OrdenVentas =
  "fecha_desc" | "fecha_asc" | "monto_desc" | "monto_asc";
export type DireccionVentas = "vendidas" | "compradas";

export type FilaVenta = {
  id: string;
  fechaVenta: string;
  createdAt: string;
  empleado: { id: string; dni: string; nombres: string; apellidos: string };
  empresaCompradora: { id: string; nombre: string };
  empresaVendedora: { id: string; nombre: string };
  sede: { id: string; nombre: string };
  vendedor: { id: string; nombres: string; apellidos: string };
  montoBrutoCentimos: Centimos;
  descuentoBps: number;
  montoDescuentoCentimos: Centimos;
  montoFinalCentimos: Centimos;
  estado: EstadoVenta;
  requiereRevision: boolean;
  totalAdjuntos: number;
};

export type ResumenVentas = {
  cantidad: number;
  sumaBruto: Centimos;
  sumaDescuento: Centimos;
  sumaFinal: Centimos;
};

export type FiltrosVentas = {
  desde?: string;
  hasta?: string;
  empresaId?: string;
  estado?: EstadoVenta | "TODAS";
  q?: string;
  vendedorId?: string;
  sedeId?: string;
  montoMinCentimos?: number;
  montoMaxCentimos?: number;
  soloRevision?: boolean;
  direccion?: DireccionVentas;
  orden?: OrdenVentas;
  cursor?: string;
};

const POR_PAGINA_VENTAS = 25;

const CAMPOS_VENTA = sql`
  v.id, v.fecha_venta, v.created_at,
  e.id AS empleado_id, e.dni AS empleado_dni, e.nombres AS empleado_nombres,
  e.apellidos AS empleado_apellidos,
  v.empresa_compradora_id, ecomp.nombre_comercial AS empresa_compradora_nombre,
  v.empresa_vendedora_id, evend.nombre_comercial AS empresa_vendedora_nombre,
  v.sede_id, s.nombre AS sede_nombre,
  v.vendedor_usuario_id, u.nombres AS vendedor_nombres, u.apellidos AS vendedor_apellidos,
  v.monto_bruto_centimos, v.descuento_bps, v.monto_descuento_centimos, v.monto_final_centimos,
  v.estado, v.requiere_revision,
  (SELECT count(*)::int FROM adjuntos a WHERE a.venta_id = v.id) AS total_adjuntos
`;

const JOINS_VENTA = sql`
  FROM ventas v
  JOIN empleados e ON e.id = v.empleado_comprador_id
  JOIN empresas ecomp ON ecomp.id = v.empresa_compradora_id
  JOIN empresas evend ON evend.id = v.empresa_vendedora_id
  JOIN sedes s ON s.id = v.sede_id
  JOIN usuarios u ON u.id = v.vendedor_usuario_id
`;

/**
 * `date_venta` es `DATE` (sin hora): drivers distintos lo devuelven distinto
 * — el driver HTTP de Neon (`db`, producción) ya da un string `YYYY-MM-DD`,
 * pero `node-postgres` (usado en los tests de aceptación) lo parsea a un
 * `Date` en medianoche UTC. `String(Date)` da el formato largo del `Date`,
 * no ISO — de ahí extraer siempre el `YYYY-MM-DD` explícitamente.
 */
export function textoFechaVenta(valor: unknown): string {
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }
  return String(valor);
}

function mapearFilaVenta(f: Record<string, unknown>): FilaVenta {
  return {
    id: String(f.id),
    fechaVenta: textoFechaVenta(f.fecha_venta),
    createdAt: String(f.created_at),
    empleado: {
      id: String(f.empleado_id),
      dni: String(f.empleado_dni),
      nombres: String(f.empleado_nombres),
      apellidos: String(f.empleado_apellidos),
    },
    empresaCompradora: {
      id: String(f.empresa_compradora_id),
      nombre: String(f.empresa_compradora_nombre),
    },
    empresaVendedora: {
      id: String(f.empresa_vendedora_id),
      nombre: String(f.empresa_vendedora_nombre),
    },
    sede: { id: String(f.sede_id), nombre: String(f.sede_nombre) },
    vendedor: {
      id: String(f.vendedor_usuario_id),
      nombres: String(f.vendedor_nombres),
      apellidos: String(f.vendedor_apellidos),
    },
    montoBrutoCentimos: Number(f.monto_bruto_centimos),
    descuentoBps: Number(f.descuento_bps),
    montoDescuentoCentimos: Number(f.monto_descuento_centimos),
    montoFinalCentimos: Number(f.monto_final_centimos),
    estado: String(f.estado) as EstadoVenta,
    requiereRevision: f.requiere_revision === true,
    totalAdjuntos: Number(f.total_adjuntos ?? 0),
  };
}

function fragmentoOrden(orden: OrdenVentas): SQL {
  switch (orden) {
    case "fecha_asc":
      return sql`v.fecha_venta ASC, v.id ASC`;
    case "monto_desc":
      return sql`v.monto_final_centimos DESC, v.id DESC`;
    case "monto_asc":
      return sql`v.monto_final_centimos ASC, v.id ASC`;
    case "fecha_desc":
    default:
      return sql`v.fecha_venta DESC, v.id DESC`;
  }
}

function condicionCursor(
  orden: OrdenVentas,
  cursor: { v: string; id: string } | null,
): SQL | undefined {
  if (!cursor) {
    return undefined;
  }
  switch (orden) {
    case "fecha_asc":
      return sql`(v.fecha_venta, v.id) > (${cursor.v}, ${cursor.id})`;
    case "monto_desc":
      return sql`(v.monto_final_centimos, v.id) < (${Number(cursor.v)}, ${cursor.id})`;
    case "monto_asc":
      return sql`(v.monto_final_centimos, v.id) > (${Number(cursor.v)}, ${cursor.id})`;
    case "fecha_desc":
    default:
      return sql`(v.fecha_venta, v.id) < (${cursor.v}, ${cursor.id})`;
  }
}

function decodificarCursorVenta(
  cursor: string | undefined,
): { v: string; id: string } | null {
  if (!cursor) {
    return null;
  }
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof raw.v === "string" &&
      typeof raw.id === "string" &&
      raw.v &&
      raw.id
    ) {
      return { v: raw.v, id: raw.id };
    }
  } catch {
    // cursor inválido: se ignora
  }
  return null;
}

function codificarCursorVenta(
  fila: Record<string, unknown>,
  orden: OrdenVentas,
): string {
  const v = orden.startsWith("fecha")
    ? textoFechaVenta(fila.fecha_venta)
    : String(fila.monto_final_centimos);
  return Buffer.from(
    JSON.stringify({ v, id: String(fila.id) }),
    "utf8",
  ).toString("base64url");
}

/**
 * `listarVentas` (03 §7, filtros en 02 §12): el alcance lo determina el rol,
 * no el parámetro — el `VENDEDOR` siempre recibe solo sus propias ventas
 * (dirección forzada a "vendidas") aunque mande otro `vendedorId`. Los
 * filtros `vendedorId`, `sedeId` y `soloRevision` son solo de admin.
 *
 * `resumen` corresponde siempre al filtro completo (sin cursor), no a la
 * página visible; `total` solo se calcula en la primera página, y coincide
 * con `resumen.cantidad`.
 */
export async function listarVentas(
  ctx: SessionContext,
  entrada: FiltrosVentas,
  ejecutor: TransaccionAuditada = db,
): Promise<Pagina<FilaVenta> & { resumen: ResumenVentas }> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA", "VENDEDOR"]);

  const orden = entrada.orden ?? "fecha_desc";
  const direccion: DireccionVentas =
    ctx.rol === "VENDEDOR" ? "vendidas" : (entrada.direccion ?? "vendidas");

  const filtros: SQL[] = [];

  if (ctx.rol === "VENDEDOR") {
    filtros.push(sql`v.vendedor_usuario_id = ${ctx.usuarioId}`);
  } else if (ctx.rol === "ADMIN_EMPRESA") {
    filtros.push(
      direccion === "vendidas"
        ? sql`v.empresa_vendedora_id = ${ctx.empresaId}`
        : sql`v.empresa_compradora_id = ${ctx.empresaId}`,
    );
    if (entrada.vendedorId) {
      filtros.push(sql`v.vendedor_usuario_id = ${entrada.vendedorId}`);
    }
    if (entrada.sedeId) {
      filtros.push(sql`v.sede_id = ${entrada.sedeId}`);
    }
    if (entrada.soloRevision) {
      filtros.push(sql`v.requiere_revision`);
    }
  }

  if (entrada.empresaId) {
    filtros.push(
      direccion === "vendidas"
        ? sql`v.empresa_compradora_id = ${entrada.empresaId}`
        : sql`v.empresa_vendedora_id = ${entrada.empresaId}`,
    );
  }
  if (entrada.desde) {
    filtros.push(sql`v.fecha_venta >= ${entrada.desde}`);
  }
  if (entrada.hasta) {
    filtros.push(sql`v.fecha_venta <= ${entrada.hasta}`);
  }
  if (entrada.estado && entrada.estado !== "TODAS") {
    filtros.push(sql`v.estado = ${entrada.estado}`);
  }
  if (entrada.q) {
    filtros.push(
      sql`(e.dni = ${entrada.q} OR e.nombres ILIKE ${`%${entrada.q}%`} OR e.apellidos ILIKE ${`%${entrada.q}%`})`,
    );
  }
  if (entrada.montoMinCentimos !== undefined) {
    filtros.push(sql`v.monto_bruto_centimos >= ${entrada.montoMinCentimos}`);
  }
  if (entrada.montoMaxCentimos !== undefined) {
    filtros.push(sql`v.monto_bruto_centimos <= ${entrada.montoMaxCentimos}`);
  }

  const whereFiltros = filtros.length
    ? sql`WHERE ${sql.join(filtros, sql` AND `)}`
    : sql``;

  const resumenFilas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT count(*)::int AS cantidad,
        COALESCE(sum(v.monto_bruto_centimos), 0)::bigint AS suma_bruto,
        COALESCE(sum(v.monto_descuento_centimos), 0)::bigint AS suma_descuento,
        COALESCE(sum(v.monto_final_centimos), 0)::bigint AS suma_final
      FROM ventas v
      JOIN empleados e ON e.id = v.empleado_comprador_id
      ${whereFiltros}
    `),
  );
  const resumenFila = resumenFilas[0];
  const resumen: ResumenVentas = {
    cantidad: Number(resumenFila?.cantidad ?? 0),
    sumaBruto: Number(resumenFila?.suma_bruto ?? 0),
    sumaDescuento: Number(resumenFila?.suma_descuento ?? 0),
    sumaFinal: Number(resumenFila?.suma_final ?? 0),
  };

  const cursorDatos = decodificarCursorVenta(entrada.cursor);
  const condicionCursorSql = condicionCursor(orden, cursorDatos);
  const filtrosPagina = condicionCursorSql
    ? [...filtros, condicionCursorSql]
    : filtros;
  const wherePagina = filtrosPagina.length
    ? sql`WHERE ${sql.join(filtrosPagina, sql` AND `)}`
    : sql``;

  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT ${CAMPOS_VENTA}
      ${JOINS_VENTA}
      ${wherePagina}
      ORDER BY ${fragmentoOrden(orden)}
      LIMIT ${POR_PAGINA_VENTAS + 1}
    `),
  );

  const haySiguiente = filas.length > POR_PAGINA_VENTAS;
  const pagina = haySiguiente ? filas.slice(0, POR_PAGINA_VENTAS) : filas;
  const ultimo = pagina[pagina.length - 1];

  return {
    items: pagina.map(mapearFilaVenta),
    cursor: haySiguiente && ultimo ? codificarCursorVenta(ultimo, orden) : null,
    total: entrada.cursor ? undefined : resumen.cantidad,
    resumen,
  };
}

export type AdjuntoVenta = {
  id: string;
  tipo: "DOCUMENTO_VENTA" | "EVIDENCIA";
  descripcion: string | null;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  puedeVer: boolean;
};

export type DetalleVenta = FilaVenta & {
  observacion: string | null;
  motivoAnulacion: string | null;
  anuladaPor: { id: string; nombres: string; apellidos: string } | null;
  anuladaAt: string | null;
  adjuntos: AdjuntoVenta[];
  puedeAnular: boolean;
};

/**
 * `obtenerVenta` (03 §7): `puedeVer` (de los adjuntos) y `puedeAnular` los
 * calcula el servidor — la UI solo los obedece. No distingue 404 de 403: el
 * mismo `NO_ENCONTRADO` cubre ambos para no filtrar la existencia del
 * recurso a quien no tiene por qué verlo.
 */
export async function obtenerVenta(
  ctx: SessionContext,
  ventaId: string,
  ejecutor: TransaccionAuditada = db,
): Promise<Resultado<DetalleVenta>> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA", "VENDEDOR"]);

  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT ${CAMPOS_VENTA},
        v.observacion, v.motivo_anulacion, v.anulada_at,
        anu.id AS anulada_por_id, anu.nombres AS anulada_por_nombres,
        anu.apellidos AS anulada_por_apellidos
      ${JOINS_VENTA}
      LEFT JOIN usuarios anu ON anu.id = v.anulada_por_usuario_id
      WHERE v.id = ${ventaId}
      LIMIT 1
    `),
  );
  const fila = filas[0];
  if (!fila) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "No se encontró la venta.",
    };
  }

  const esVendedora =
    ctx.rol === "SUPERADMIN" ||
    (ctx.rol === "ADMIN_EMPRESA" &&
      String(fila.empresa_vendedora_id) === ctx.empresaId) ||
    (ctx.rol === "VENDEDOR" &&
      String(fila.vendedor_usuario_id) === ctx.usuarioId);
  const esCompradora =
    ctx.rol === "ADMIN_EMPRESA" &&
    String(fila.empresa_compradora_id) === ctx.empresaId;

  if (!esVendedora && !esCompradora) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "No se encontró la venta.",
    };
  }

  // Solo la empresa vendedora (y, dentro de ella, el propio vendedor) puede
  // abrir los adjuntos (02 §3): la compradora ve montos, no los archivos.
  const puedeVerAdjuntos = esVendedora;

  const adjuntosFilas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT id, tipo, descripcion, mime, size_bytes, created_at
      FROM adjuntos WHERE venta_id = ${ventaId} ORDER BY orden ASC
    `),
  );

  const estado = String(fila.estado) as EstadoVenta;
  const puedeAnular =
    estado === "REGISTRADA" &&
    (ctx.rol === "SUPERADMIN" ||
      (ctx.rol === "ADMIN_EMPRESA" &&
        String(fila.empresa_vendedora_id) === ctx.empresaId) ||
      (ctx.rol === "VENDEDOR" &&
        String(fila.vendedor_usuario_id) === ctx.usuarioId &&
        fechaLimaDe(fila.created_at as Date | string) === hoyLima()));

  return {
    ok: true,
    data: {
      ...mapearFilaVenta(fila),
      observacion: (fila.observacion as string | null) ?? null,
      motivoAnulacion: (fila.motivo_anulacion as string | null) ?? null,
      anuladaAt: fila.anulada_at ? String(fila.anulada_at) : null,
      anuladaPor: fila.anulada_por_id
        ? {
            id: String(fila.anulada_por_id),
            nombres: String(fila.anulada_por_nombres),
            apellidos: String(fila.anulada_por_apellidos),
          }
        : null,
      adjuntos: adjuntosFilas.map((a) => ({
        id: String(a.id),
        tipo: String(a.tipo) as "DOCUMENTO_VENTA" | "EVIDENCIA",
        descripcion: (a.descripcion as string | null) ?? null,
        mime: String(a.mime),
        sizeBytes: Number(a.size_bytes),
        createdAt: String(a.created_at),
        puedeVer: puedeVerAdjuntos,
      })),
      puedeAnular,
    },
  };
}

export type VendedorOpcion = { id: string; nombres: string; apellidos: string };

/** Vendedores de mi propia empresa, para el filtro de admin del listado de ventas. */
export async function listarVendedoresPropios(
  ctx: SessionContext,
  ejecutor: TransaccionAuditada = db,
): Promise<VendedorOpcion[]> {
  requireRol(ctx, ["ADMIN_EMPRESA"]);
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT id, nombres, apellidos FROM usuarios
      WHERE empresa_id = ${ctx.empresaId} AND rol = 'VENDEDOR' AND activo
      ORDER BY apellidos ASC, nombres ASC
    `),
  );
  return filas.map((f) => ({
    id: String(f.id),
    nombres: String(f.nombres),
    apellidos: String(f.apellidos),
  }));
}
