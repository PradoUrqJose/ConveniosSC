import { access } from "node:fs/promises";
import path from "node:path";

import { head } from "@vercel/blob";
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
import type { CodigoError, Resultado } from "@/lib/tipos";
import { resolverTerminoVigente, textoFechaVenta } from "./query";

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

function fallo(
  codigo: CodigoError,
  mensaje: string,
  campo?: string,
): Resultado<never> {
  return { ok: false, codigo, mensaje, campo };
}

/**
 * `crearVenta` — la action central (03 §7, algoritmo completo en 02 §2).
 * Los 12 pasos, en orden. El `ventaId` lo genera el cliente: reenviar el
 * mismo id es la idempotencia contra reintentos de red en móvil (D09).
 */
export async function crearVentaCore(
  tx: TransaccionAuditada,
  ctx: CtxVenta,
  datos: DatosCrearVenta,
): Promise<Resultado<VentaCreada>> {
  // 2. Idempotencia.
  const existentes = obtenerFilas(
    await tx.execute(sql`
      SELECT id, vendedor_usuario_id, monto_bruto_centimos, descuento_bps,
             monto_descuento_centimos, monto_final_centimos, fecha_venta
      FROM ventas WHERE id = ${datos.ventaId}
    `),
  );
  const existente = existentes[0];
  if (existente) {
    if (String(existente.vendedor_usuario_id) !== ctx.usuarioId) {
      return fallo("CONFLICTO", "Ya existe una venta con ese identificador.");
    }
    return {
      ok: true,
      data: {
        ventaId: datos.ventaId,
        montoBrutoCentimos: Number(existente.monto_bruto_centimos),
        descuentoBps: Number(existente.descuento_bps),
        montoDescuentoCentimos: Number(existente.monto_descuento_centimos),
        montoFinalCentimos: Number(existente.monto_final_centimos),
        fechaVenta: String(existente.fecha_venta),
        yaExistia: true,
      },
    };
  }

  // 3-5. Empleado, convenio y término vigente A LA FECHA DE VENTA.
  const resuelto = await resolverTerminoVigente(
    tx,
    ctx,
    datos.empleadoCompradorId,
    datos.fechaVenta,
  );
  if (!resuelto.ok) {
    return resuelto;
  }
  const { convenioId, terminoId, descuentoBps } = resuelto.data;

  // 6. Sede: de mi empresa y activa.
  const sedeFilas = obtenerFilas(
    await tx.execute(
      sql`SELECT empresa_id, activo FROM sedes WHERE id = ${datos.sedeId}`,
    ),
  );
  const sede = sedeFilas[0];
  if (!sede) {
    return fallo("NO_ENCONTRADO", "La sede no existe.", "sedeId");
  }
  if (String(sede.empresa_id) !== ctx.empresaId || !sede.activo) {
    return fallo(
      "REGLA_NEGOCIO",
      "La sede seleccionada no está disponible.",
      "sedeId",
    );
  }

  // Config de la empresa vendedora: tope, ventana retroactiva, evidencia obligatoria.
  const empresaFilas = obtenerFilas(
    await tx.execute(sql`
      SELECT tope_monto_venta_centimos, dias_retroactivos_venta,
             requiere_evidencia_en_venta
      FROM empresas WHERE id = ${ctx.empresaId}
    `),
  );
  const empresa = empresaFilas[0];
  const tope = Number(empresa?.tope_monto_venta_centimos ?? 0);
  const diasRetroactivos = Number(empresa?.dias_retroactivos_venta ?? 7);
  const requiereEvidencia = Boolean(empresa?.requiere_evidencia_en_venta);

  // 7. Fecha: no futura, dentro de la ventana retroactiva de la empresa.
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

  // 8. Monto: mayor que cero y dentro del tope de la empresa.
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

  // 9. Adjuntos: documento obligatorio + evidencias (obligatorias si la empresa lo exige).
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
  for (const archivo of archivos) {
    const validacion = await validarBlobDisponible(tx, archivo.blobPath);
    if (!validacion.ok) {
      return validacion;
    }
  }

  // 10. Calcular, ignorando cualquier monto que haya mandado el cliente.
  const { descuento, final } = calcularDescuento(
    datos.montoBrutoCentimos,
    descuentoBps,
  );

  // 11. Transacción: venta, adjuntos, auditoría.
  await tx.execute(sql`
    INSERT INTO ventas
      (id, empresa_vendedora_id, empresa_compradora_id, convenio_id, termino_id,
       sede_id, vendedor_usuario_id, empleado_comprador_id,
       monto_bruto_centimos, descuento_bps, monto_descuento_centimos,
       monto_final_centimos, fecha_venta, observacion)
    VALUES
      (${datos.ventaId}, ${ctx.empresaId}, ${resuelto.data.empresaCompradoraId},
       ${convenioId}, ${terminoId}, ${datos.sedeId}, ${ctx.usuarioId},
       ${datos.empleadoCompradorId}, ${datos.montoBrutoCentimos}, ${descuentoBps},
       ${descuento}, ${final}, ${datos.fechaVenta}, ${datos.observacion ?? null})
  `);

  await tx.execute(sql`
    INSERT INTO adjuntos
      (venta_id, tipo, orden, blob_path, mime, size_bytes, sha256,
       subido_por_usuario_id)
    VALUES
      (${datos.ventaId}, 'DOCUMENTO_VENTA', 0, ${datos.documento.blobPath},
       ${datos.documento.mime}, ${datos.documento.sizeBytes},
       ${datos.documento.sha256}, ${ctx.usuarioId})
  `);
  for (const [indice, evidencia] of datos.evidencias.entries()) {
    await tx.execute(sql`
      INSERT INTO adjuntos
        (venta_id, tipo, orden, descripcion, blob_path, mime, size_bytes,
         sha256, subido_por_usuario_id)
      VALUES
        (${datos.ventaId}, 'EVIDENCIA', ${indice + 1}, ${evidencia.descripcion ?? null},
         ${evidencia.blobPath}, ${evidencia.mime}, ${evidencia.sizeBytes},
         ${evidencia.sha256}, ${ctx.usuarioId})
    `);
  }

  // 11.d. Documentos reutilizados: no bloquea, solo queda rastro en la auditoría.
  const posiblesDuplicados = await buscarShaReutilizado(
    tx,
    ctx.empresaId,
    datos.ventaId,
    archivos.map((a) => a.sha256),
  );

  const datosDespues: Datos = {
    empresaVendedoraId: ctx.empresaId,
    empresaCompradoraId: resuelto.data.empresaCompradoraId,
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
 * Un blob es válido para una venta si: no está ya asociado a otro adjunto
 * (documento u otra venta), y el archivo realmente existe.
 *
 * No se usa el rastro `ADJUNTO_SUBIDO` de auditoría para esto: ese evento lo
 * escribe `onUploadCompleted` de Vercel Blob, un callback asíncrono que
 * Vercel invoca contra una URL pública — nunca llega en `localhost` y, aun en
 * producción, no hay garantía de que llegue antes de que el cliente envíe la
 * venta. En su lugar se confirma la existencia del archivo directamente:
 * contra Vercel Blob (`head`), o contra el respaldo local de desarrollo de
 * `subirArchivoLocal` (`public/uploads/...`).
 */
async function validarBlobDisponible(
  tx: TransaccionAuditada,
  blobPath: string,
): Promise<Resultado<true>> {
  const yaUsado = obtenerFilas(
    await tx.execute(
      sql`SELECT 1 FROM adjuntos WHERE blob_path = ${blobPath} LIMIT 1`,
    ),
  );
  if (yaUsado.length > 0) {
    return fallo(
      "CONFLICTO",
      "Uno de los archivos ya fue usado en otra venta o empleado.",
    );
  }

  if (!(await blobExiste(blobPath))) {
    return fallo(
      "REGLA_NEGOCIO",
      "No pudimos verificar la subida de uno de los archivos. Vuelve a adjuntarlo.",
    );
  }

  return { ok: true, data: true };
}

async function blobExiste(blobPath: string): Promise<boolean> {
  if (blobPath.startsWith("/uploads/")) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    try {
      await access(path.join(process.cwd(), "public", blobPath));
      return true;
    } catch {
      return false;
    }
  }
  try {
    await head(blobPath);
    return true;
  } catch {
    return false;
  }
}

async function buscarShaReutilizado(
  tx: TransaccionAuditada,
  empresaVendedoraId: string,
  ventaIdActual: string,
  hashes: string[],
): Promise<{ sha256: string; ventaId: string }[]> {
  const desde = sumarDias(hoyLima(), -90);
  const encontrados: { sha256: string; ventaId: string }[] = [];
  for (const sha256 of hashes) {
    const filas = obtenerFilas(
      await tx.execute(sql`
        SELECT v.id FROM adjuntos a
        JOIN ventas v ON v.id = a.venta_id
        WHERE a.sha256 = ${sha256}
          AND v.empresa_vendedora_id = ${empresaVendedoraId}
          AND v.id <> ${ventaIdActual}
          AND v.fecha_venta >= ${desde}
        LIMIT 1
      `),
    );
    const fila = filas[0];
    if (fila) {
      encontrados.push({ sha256, ventaId: String(fila.id) });
    }
  }
  return encontrados;
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
