import { sql } from "drizzle-orm";

import { registrar, type TransaccionAuditada } from "@/lib/audit/registrar";
import { obtenerFilas } from "@/lib/audit/registrar";
import type { SessionContext } from "@/lib/auth/guardas";
import { rateLimit } from "@/lib/rate-limit";
import type { Resultado } from "@/lib/tipos";

const LIMITE_ADJUNTOS = 100;
const VENTANA_ADJUNTOS_MS = 5 * 60 * 1000;

export type AdjuntoLeido = {
  id: string;
  blobPath: string;
  mime: string;
  sizeBytes: number;
  nombreArchivo: string;
};

type FilaAdjunto = {
  id: string;
  tipo: string;
  blob_path: string;
  mime: string;
  size_bytes: number;
  venta_id: string | null;
  venta_empresa_vendedora: string | null;
  venta_vendedor: string | null;
  empleado_id: string | null;
  empleado_empresa: string | null;
};

/**
 * `leerAdjunto` (02 §8 «Lectura» + 03 §10): autoriza la lectura de un
 * adjunto y audita `ADJUNTO_VISTO`.
 *
 * Reglas de autorización (02 §3):
 * - Adjuntos de venta (DOCUMENTO_VENTA / EVIDENCIA): solo la empresa vendedora;
 *   el VENDEDOR solo los de sus propias ventas.
 * - FOTO_DNI de un empleado: solo la empresa del empleado.
 * - SUPERADMIN siempre.
 *
 * No distingue 404 de 403 en el resultado: el route devuelve el mismo cuerpo
 * para no filtrar la existencia del recurso.
 */
export async function leerAdjunto(
  ejecutor: TransaccionAuditada,
  ctx: SessionContext,
  adjuntoId: string,
): Promise<Resultado<AdjuntoLeido>> {
  const control = await rateLimit(ejecutor, `adjunto:${ctx.usuarioId}`, {
    limite: LIMITE_ADJUNTOS,
    ventanaMs: VENTANA_ADJUNTOS_MS,
  });
  if (!control.permitido) {
    return {
      ok: false,
      codigo: "LIMITE_EXCEDIDO",
      mensaje:
        "Demasiados accesos a archivos. Inténtalo de nuevo en unos minutos.",
    };
  }

  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT a.id, a.tipo, a.blob_path, a.mime, a.size_bytes,
             a.venta_id,
             v.empresa_vendedora_id AS venta_empresa_vendedora,
             v.vendedor_usuario_id AS venta_vendedor,
             a.empleado_id,
             e.empresa_id AS empleado_empresa
      FROM adjuntos a
      LEFT JOIN ventas v ON v.id = a.venta_id
      LEFT JOIN empleados e ON e.id = a.empleado_id
      WHERE a.id = ${adjuntoId}
      LIMIT 1
    `),
  );
  const fila = filas[0] as FilaAdjunto | undefined;
  if (!fila) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "No se encontró el archivo.",
    };
  }

  if (!tienePermiso(ctx, fila)) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "No se encontró el archivo.",
    };
  }

  await registrar(ejecutor, {
    accion: "ADJUNTO_VISTO",
    entidad: "adjunto",
    entidadId: adjuntoId,
    actor: {
      usuarioId: ctx.usuarioId,
      empresaId: ctx.empresaId,
      rol: ctx.rol,
    },
    datosDespues: { path: fila.blob_path },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });

  return {
    ok: true,
    data: {
      id: adjuntoId,
      blobPath: fila.blob_path,
      mime: fila.mime,
      sizeBytes: Number(fila.size_bytes),
      nombreArchivo: fila.blob_path.split("/").pop() ?? "archivo",
    },
  };
}

function tienePermiso(ctx: SessionContext, fila: FilaAdjunto): boolean {
  if (ctx.rol === "SUPERADMIN") {
    return true;
  }
  if (fila.venta_id !== null) {
    if (fila.venta_empresa_vendedora !== ctx.empresaId) {
      return false;
    }
    if (ctx.rol === "VENDEDOR" && fila.venta_vendedor !== ctx.usuarioId) {
      return false;
    }
    return true;
  }
  if (fila.empleado_id !== null) {
    return fila.empleado_empresa === ctx.empresaId;
  }
  return false;
}
