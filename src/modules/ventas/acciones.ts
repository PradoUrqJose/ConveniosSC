import { sql } from "drizzle-orm";

import {
  obtenerFilas,
  registrar,
  type TransaccionAuditada,
} from "@/lib/audit/registrar";
import type { Datos } from "@/lib/audit/canonico";
import type { SessionContext } from "@/lib/auth/guardas";
import { calcularDescuento, type Centimos } from "@/lib/dinero";
import { compararFechas, fechaLimaDe, hoyLima, sumarDias } from "@/lib/fechas";
import type { TipoAdjunto } from "@/lib/archivos";
import { verificarArchivoSubido } from "@/lib/blob-verificacion";
import type { CodigoError, Resultado } from "@/lib/tipos";
import { textoFechaVenta } from "./query";

export type ArchivoVenta = {
  blobPath: string;
  sha256: string;
  mime: string;
  sizeBytes: number;
};

export type EvidenciaVenta = ArchivoVenta & { descripcion?: string | null };

export type DatosCrearVenta = {
  ventaId: string;
  empleadoCompradorId: string;
  sedeId: string;
  montoBrutoCentimos: Centimos;
  fechaVenta: string;
  observacion?: string | null;
  documento: ArchivoVenta;
  evidencias: EvidenciaVenta[];
};

export type VentaCreada = {
  ventaId: string;
  montoBrutoCentimos: Centimos;
  descuentoBps: number;
  montoDescuentoCentimos: Centimos;
  montoFinalCentimos: Centimos;
  fechaVenta: string;
  yaExistia: boolean;
};

type CtxVenta = {
  usuarioId: string;
  empresaId: string;
  rol: "SUPERADMIN" | "ADMIN_EMPRESA" | "VENDEDOR";
  requestId: string;
  ip: string | null;
  userAgent: string | null;
};

type VentaPreparada = {
  convenioId: string;
  terminoId: string;
  descuentoBps: number;
  empresaCompradoraId: string;
  documento: ArchivoVenta;
  evidencias: (ArchivoVenta & { descripcion: string | null })[];
};

function fallo(
  codigo: CodigoError,
  mensaje: string,
  campo?: string,
): Resultado<never> {
  return { ok: false, codigo, mensaje, campo };
}

/** Busca una venta ya creada para que los reintentos de red sean idempotentes. */
export async function buscarVentaExistente(
  ejecutor: TransaccionAuditada,
  ctx: CtxVenta,
  ventaId: string,
): Promise<Resultado<VentaCreada> | null> {
  const existentes = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT id, vendedor_usuario_id, monto_bruto_centimos, descuento_bps,
             monto_descuento_centimos, monto_final_centimos, fecha_venta
      FROM ventas WHERE id = ${ventaId}
    `),
  );
  const existente = existentes[0];
  if (!existente) return null;
  if (String(existente.vendedor_usuario_id) !== ctx.usuarioId) {
    return fallo("CONFLICTO", "Ya existe una venta con ese identificador.");
  }
  return {
    ok: true,
    data: {
      ventaId,
      montoBrutoCentimos: Number(existente.monto_bruto_centimos),
      descuentoBps: Number(existente.descuento_bps),
      montoDescuentoCentimos: Number(existente.monto_descuento_centimos),
      montoFinalCentimos: Number(existente.monto_final_centimos),
      fechaVenta: String(existente.fecha_venta),
      yaExistia: true,
    },
  };
}

/**
 * Validaciones que no escriben se realizan antes de abrir la transacción.
 * La consulta CTE reúne empleado, término, sede y configuración; las llamadas
 * a Blob también se lanzan en paralelo. `crearVentaCore` conserva el fallback
 * sin preparación para los consumidores internos y los tests de aceptación.
 */
export async function prepararVenta(
  ejecutor: TransaccionAuditada,
  ctx: CtxVenta,
  datos: DatosCrearVenta,
): Promise<Resultado<VentaPreparada>> {
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      WITH empleado AS (
        SELECT id, empresa_id, estado
        FROM empleados WHERE id = ${datos.empleadoCompradorId}
      ),
      termino AS (
        SELECT c.id AS convenio_id, ct.id AS termino_id, ct.descuento_bps
        FROM empleado e
        JOIN convenios c
          ON ((c.empresa_a_id = e.empresa_id AND c.empresa_b_id = ${ctx.empresaId})
           OR (c.empresa_b_id = e.empresa_id AND c.empresa_a_id = ${ctx.empresaId}))
        JOIN convenio_terminos ct
          ON ct.convenio_id = c.id
         AND ct.empresa_otorgante_id = ${ctx.empresaId}
        WHERE c.estado = 'VIGENTE'
          AND ${datos.fechaVenta} >= c.vigencia_desde
          AND (c.vigencia_hasta IS NULL OR ${datos.fechaVenta} <= c.vigencia_hasta)
          AND ct.vigencia_desde <= ${datos.fechaVenta}
          AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${datos.fechaVenta})
        LIMIT 1
      ),
      sede AS (
        SELECT empresa_id, activo FROM sedes WHERE id = ${datos.sedeId}
      ),
      empresa AS (
        SELECT tope_monto_venta_centimos, dias_retroactivos_venta,
               requiere_evidencia_en_venta
        FROM empresas WHERE id = ${ctx.empresaId}
      )
      SELECT
        (SELECT id FROM empleado) AS empleado_id,
        (SELECT empresa_id FROM empleado) AS empleado_empresa_id,
        (SELECT estado FROM empleado) AS empleado_estado,
        (SELECT convenio_id FROM termino) AS convenio_id,
        (SELECT termino_id FROM termino) AS termino_id,
        (SELECT descuento_bps FROM termino) AS descuento_bps,
        (SELECT empresa_id FROM sede) AS sede_empresa_id,
        (SELECT activo FROM sede) AS sede_activa,
        (SELECT tope_monto_venta_centimos FROM empresa) AS tope_monto_venta_centimos,
        (SELECT dias_retroactivos_venta FROM empresa) AS dias_retroactivos_venta,
        (SELECT requiere_evidencia_en_venta FROM empresa) AS requiere_evidencia_en_venta
    `),
  );
  const fila = filas[0];

  // Se conserva el orden y los códigos de error del algoritmo original.
  if (!fila?.empleado_id) {
    return fallo(
      "NO_ENCONTRADO",
      "El empleado no existe.",
      "empleadoCompradorId",
    );
  }
  const empresaCompradoraId = String(fila.empleado_empresa_id);
  const estadoEmpleado = String(fila.empleado_estado);
  if (estadoEmpleado === "RECHAZADO" || estadoEmpleado === "INACTIVO") {
    return fallo(
      "REGLA_NEGOCIO",
      "Este empleado no está habilitado para el beneficio.",
      "empleadoCompradorId",
    );
  }
  if (empresaCompradoraId === ctx.empresaId) {
    return fallo(
      "REGLA_NEGOCIO",
      "No se registra una venta a un empleado de tu propia empresa.",
      "empleadoCompradorId",
    );
  }
  if (!fila.termino_id) {
    return fallo(
      "REGLA_NEGOCIO",
      "El convenio no tiene un descuento definido para esa fecha.",
      "fechaVenta",
    );
  }
  if (!fila.sede_empresa_id) {
    return fallo("NO_ENCONTRADO", "La sede no existe.", "sedeId");
  }
  if (String(fila.sede_empresa_id) !== ctx.empresaId || !fila.sede_activa) {
    return fallo(
      "REGLA_NEGOCIO",
      "La sede seleccionada no está disponible.",
      "sedeId",
    );
  }

  const tope = Number(fila.tope_monto_venta_centimos ?? 0);
  const diasRetroactivos = Number(fila.dias_retroactivos_venta ?? 7);
  const requiereEvidencia = Boolean(fila.requiere_evidencia_en_venta);

  const hoy = hoyLima();
  const minima = sumarDias(hoy, -diasRetroactivos);
  if (compararFechas(datos.fechaVenta, hoy) === 1) {
    return fallo(
      "VALIDACION",
      "La fecha de venta no puede ser futura.",
      "fechaVenta",
    );
  }
  if (compararFechas(datos.fechaVenta, minima) === -1) {
    return fallo(
      "VALIDACION",
      `La fecha de venta no puede ser anterior a ${diasRetroactivos} días atrás.`,
      "fechaVenta",
    );
  }
  if (datos.montoBrutoCentimos <= 0) {
    return fallo("VALIDACION", "El monto debe ser mayor a cero.", "montoBruto");
  }
  if (datos.montoBrutoCentimos > tope) {
    return fallo(
      "VALIDACION",
      `El monto no puede superar S/ ${(tope / 100).toFixed(2)}. Si la venta es mayor, coordina con tu administrador.`,
      "montoBruto",
    );
  }
  if (datos.evidencias.length > 5) {
    return fallo(
      "VALIDACION",
      "Puedes adjuntar como máximo 5 evidencias.",
      "evidencias",
    );
  }
  if (requiereEvidencia && datos.evidencias.length === 0) {
    return fallo(
      "VALIDACION",
      "Esta empresa exige al menos una evidencia adicional en cada venta.",
      "evidencias",
    );
  }

  const archivos = [datos.documento, ...datos.evidencias];
  const rutas = sql.join(
    archivos.map((archivo) => sql`${archivo.blobPath}`),
    sql`, `,
  );
  const usados = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT blob_path FROM adjuntos
      WHERE blob_path IN (${rutas})
    `),
  );
  if (usados.length > 0) {
    return fallo(
      "CONFLICTO",
      "Uno de los archivos ya fue usado en otra venta o empleado.",
    );
  }

  const resultados = await Promise.all(
    archivos.map((archivo, indice) =>
      verificarAdjunto(archivo, indice === 0 ? "documento" : "evidencia"),
    ),
  );
  const verificados: ArchivoVenta[] = [];
  for (const resultado of resultados) {
    if (!resultado.ok) return resultado;
    verificados.push(resultado.data);
  }

  return {
    ok: true,
    data: {
      convenioId: String(fila.convenio_id),
      terminoId: String(fila.termino_id),
      descuentoBps: Number(fila.descuento_bps),
      empresaCompradoraId,
      documento: verificados[0]!,
      evidencias: datos.evidencias.map((evidencia, indice) => ({
        ...verificados[indice + 1]!,
        descripcion: evidencia.descripcion ?? null,
      })),
    },
  };
}

/**
 * `crearVenta` — la action central (03 §7, algoritmo completo en 02 §2).
 * El `ventaId` lo genera el cliente: reenviar el mismo id es la idempotencia
 * contra reintentos de red en móvil (D09).
 */
export async function crearVentaCore(
  tx: TransaccionAuditada,
  ctx: CtxVenta,
  datos: DatosCrearVenta,
  preparada?: VentaPreparada,
): Promise<Resultado<VentaCreada>> {
  let ventaPreparada = preparada;
  if (!ventaPreparada) {
    const existente = await buscarVentaExistente(tx, ctx, datos.ventaId);
    if (existente) return existente;

    const resultadoPreparacion = await prepararVenta(tx, ctx, datos);
    if (!resultadoPreparacion.ok) return resultadoPreparacion;
    ventaPreparada = resultadoPreparacion.data;
  }

  const {
    convenioId,
    terminoId,
    descuentoBps,
    empresaCompradoraId,
    documento,
    evidencias,
  } = ventaPreparada;
  const archivos = [documento, ...evidencias];

  // Calcular, ignorando cualquier monto que haya mandado el cliente.
  const { descuento, final } = calcularDescuento(
    datos.montoBrutoCentimos,
    descuentoBps,
  );

  const filasAdjuntos = [
    sql`('DOCUMENTO_VENTA', 0, ${null}, ${documento.blobPath}, ${documento.mime},
         ${documento.sizeBytes}, ${documento.sha256}, ${ctx.usuarioId})`,
    ...evidencias.map(
      (evidencia, indice) =>
        sql`('EVIDENCIA', ${indice + 1}, ${evidencia.descripcion},
             ${evidencia.blobPath}, ${evidencia.mime}, ${evidencia.sizeBytes},
             ${evidencia.sha256}, ${ctx.usuarioId})`,
    ),
  ];

  // Una carrera por el mismo ventaId conserva la idempotencia sin una lectura
  // adicional en el camino normal; la venta y sus adjuntos se escriben juntos.
  const escritura = obtenerFilas(
    await tx.execute(sql`
      WITH venta_insertada AS (
        INSERT INTO ventas
          (id, empresa_vendedora_id, empresa_compradora_id, convenio_id, termino_id,
           sede_id, vendedor_usuario_id, empleado_comprador_id,
           monto_bruto_centimos, descuento_bps, monto_descuento_centimos,
           monto_final_centimos, fecha_venta, observacion)
        VALUES
          (${datos.ventaId}, ${ctx.empresaId}, ${empresaCompradoraId},
           ${convenioId}, ${terminoId}, ${datos.sedeId}, ${ctx.usuarioId},
           ${datos.empleadoCompradorId}, ${datos.montoBrutoCentimos}, ${descuentoBps},
           ${descuento}, ${final}, ${datos.fechaVenta}, ${datos.observacion ?? null})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      ),
      adjuntos_insertados AS (
        INSERT INTO adjuntos
          (venta_id, tipo, orden, descripcion, blob_path, mime, size_bytes, sha256,
           subido_por_usuario_id)
        SELECT venta_insertada.id, valores.tipo::tipo_adjunto,
               valores.orden::smallint, valores.descripcion, valores.blob_path,
               valores.mime, valores.size_bytes::integer, valores.sha256,
               valores.subido_por_usuario_id::uuid
        FROM venta_insertada
        CROSS JOIN LATERAL (
          VALUES ${sql.join(filasAdjuntos, sql`, `)}
        ) AS valores
          (tipo, orden, descripcion, blob_path, mime, size_bytes, sha256,
           subido_por_usuario_id)
      )
      SELECT EXISTS (SELECT 1 FROM venta_insertada) AS insertada
  `),
  );
  const insertada = escritura[0]?.insertada;
  if (insertada !== true && insertada !== "t") {
    return (
      (await buscarVentaExistente(tx, ctx, datos.ventaId)) ??
      fallo("ERROR_INTERNO", "No se pudo confirmar la venta registrada.")
    );
  }

  // Documentos reutilizados: no bloquea, solo queda rastro en la auditoría.
  const posiblesDuplicados = await buscarShaReutilizado(
    tx,
    ctx.empresaId,
    datos.ventaId,
    archivos.map((a) => a.sha256),
  );

  const datosDespues: Datos = {
    empresaVendedoraId: ctx.empresaId,
    empresaCompradoraId,
    convenioId,
    terminoId,
    sedeId: datos.sedeId,
    empleadoCompradorId: datos.empleadoCompradorId,
    montoBrutoCentimos: datos.montoBrutoCentimos,
    descuentoBps,
    montoDescuentoCentimos: descuento,
    montoFinalCentimos: final,
    fechaVenta: datos.fechaVenta,
    totalAdjuntos: archivos.length,
  };
  if (posiblesDuplicados.length > 0) {
    datosDespues.posiblesDocumentosReutilizados = posiblesDuplicados;
  }

  await registrar(tx, {
    accion: "VENTA_CREADA",
    entidad: "venta",
    entidadId: datos.ventaId,
    actor: ctx,
    datosDespues,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });

  return {
    ok: true,
    data: {
      ventaId: datos.ventaId,
      montoBrutoCentimos: datos.montoBrutoCentimos,
      descuentoBps,
      montoDescuentoCentimos: descuento,
      montoFinalCentimos: final,
      fechaVenta: datos.fechaVenta,
      yaExistia: false,
    },
  };
}

/**
 * Un adjunto entra en la venta solo si: su blob no está ya asociado a otro
 * adjunto, el archivo existe, y su contenido real coincide con lo declarado.
 *
 * Nada de lo que manda el cliente se persiste tal cual (02 §8, P0-02): el
 * `mime`, el tamaño y el `sha256` que se guardan salen de los bytes que el
 * servidor leyó. El formulario los manda igual y aquí se contrastan: si no
 * coinciden, el archivo que subió el navegador no es el que dice ser y la
 * venta se rechaza en vez de guardar metadatos falsos. Un `sha256` inventado
 * dejaría ciega la detección de documentos reutilizados de 02 §11.d.
 *
 * No se usa el rastro `ADJUNTO_SUBIDO` de auditoría para confirmar la subida:
 * ese evento lo escribe `onUploadCompleted` de Vercel Blob, un callback
 * asíncrono que Vercel invoca contra una URL pública — nunca llega en
 * `localhost` y, aun en producción, no hay garantía de que llegue antes de que
 * el cliente envíe la venta.
 */
async function verificarAdjunto(
  archivo: ArchivoVenta,
  tipo: TipoAdjunto,
): Promise<Resultado<ArchivoVenta>> {
  const verificado = await verificarArchivoSubido(archivo.blobPath, tipo);
  if (!verificado.ok) {
    return fallo(
      verificado.motivo === "NO_EXISTE" ? "REGLA_NEGOCIO" : "VALIDACION",
      verificado.mensaje,
      tipo === "documento" ? "documento" : "evidencias",
    );
  }

  const real = verificado.data;
  if (
    real.mime !== archivo.mime ||
    real.sizeBytes !== archivo.sizeBytes ||
    real.sha256 !== archivo.sha256
  ) {
    return fallo(
      "VALIDACION",
      "Uno de los archivos no coincide con lo que se subió. Vuelve a adjuntarlo.",
      tipo === "documento" ? "documento" : "evidencias",
    );
  }

  return { ok: true, data: { blobPath: archivo.blobPath, ...real } };
}

async function buscarShaReutilizado(
  tx: TransaccionAuditada,
  empresaVendedoraId: string,
  ventaIdActual: string,
  hashes: string[],
): Promise<{ sha256: string; ventaId: string }[]> {
  const desde = sumarDias(hoyLima(), -90);
  const hashesSql = sql.join(
    hashes.map((sha256) => sql`${sha256}`),
    sql`, `,
  );
  const filas = obtenerFilas(
    await tx.execute(sql`
      SELECT DISTINCT ON (a.sha256) a.sha256, v.id AS venta_id
      FROM adjuntos a
      JOIN ventas v ON v.id = a.venta_id
      WHERE a.sha256 IN (${hashesSql})
        AND v.empresa_vendedora_id = ${empresaVendedoraId}
        AND v.id <> ${ventaIdActual}
        AND v.fecha_venta >= ${desde}
      ORDER BY a.sha256, v.id
    `),
  );
  return filas.map((fila) => ({
    sha256: String(fila.sha256),
    ventaId: String(fila.venta_id),
  }));
}

export type DatosAnularVenta = {
  ventaId: string;
  motivo: string;
};

/**
 * `anularVenta` (02 §9, D20): quién puede anular depende del rol y, para el
 * `VENDEDOR`, de una ventana de tiempo — su propia venta, solo el mismo día
 * (hora Lima) en que la registró. El `ADMIN_EMPRESA` puede anular cualquier
 * venta donde su empresa sea la vendedora, sin límite de tiempo.
 * Una venta `ANULADA` no se reactiva: si fue un error, se registra una venta
 * nueva. Los adjuntos no se borran.
 */
export async function anularVentaCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosAnularVenta,
): Promise<Resultado<Record<string, never>>> {
  const filas = obtenerFilas(
    await tx.execute(sql`
      SELECT estado, vendedor_usuario_id, empresa_vendedora_id,
             monto_bruto_centimos, monto_final_centimos, fecha_venta, created_at
      FROM ventas WHERE id = ${datos.ventaId}
    `),
  );
  const fila = filas[0];
  if (!fila) {
    return fallo("NO_ENCONTRADO", "La venta no existe.");
  }
  if (String(fila.estado) === "ANULADA") {
    return fallo("REGLA_NEGOCIO", "La venta ya fue anulada.");
  }

  const puedeAnular =
    ctx.rol === "SUPERADMIN" ||
    (ctx.rol === "ADMIN_EMPRESA" &&
      String(fila.empresa_vendedora_id) === ctx.empresaId) ||
    (ctx.rol === "VENDEDOR" &&
      String(fila.vendedor_usuario_id) === ctx.usuarioId &&
      fechaLimaDe(fila.created_at as Date | string) === hoyLima());
  if (!puedeAnular) {
    return fallo("SIN_PERMISO", "No tienes permiso para anular esta venta.");
  }

  await tx.execute(sql`
    UPDATE ventas SET estado = 'ANULADA', anulada_at = now(),
      anulada_por_usuario_id = ${ctx.usuarioId}, motivo_anulacion = ${datos.motivo}
    WHERE id = ${datos.ventaId} AND estado = 'REGISTRADA'
  `);

  const datosAntes: Datos = {
    estado: String(fila.estado),
    montoBrutoCentimos: Number(fila.monto_bruto_centimos),
    montoFinalCentimos: Number(fila.monto_final_centimos),
    fechaVenta: textoFechaVenta(fila.fecha_venta),
  };

  await registrar(tx, {
    accion: "VENTA_ANULADA",
    entidad: "venta",
    entidadId: datos.ventaId,
    actor: ctx,
    datosAntes,
    datosDespues: { motivo: datos.motivo },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });

  return { ok: true, data: {} };
}
