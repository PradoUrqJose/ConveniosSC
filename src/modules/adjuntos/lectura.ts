import { sql } from "drizzle-orm";

import { after } from "next/server";

import { db, dbTx } from "@/db";
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
};

/**
 * `leerAdjunto` (02 §8 «Lectura» + 03 §10): autoriza la lectura de un
 * adjunto y audita `ADJUNTO_VISTO`.
 *
 * Reglas de autorización (02 §3):
 * - Adjuntos de venta (DOCUMENTO_VENTA / EVIDENCIA): solo la empresa vendedora;
 *   el VENDEDOR solo los de sus propias ventas.
 * - SUPERADMIN siempre.
 *
 * No distingue 404 de 403 en el resultado: el route devuelve el mismo cuerpo
 * para no filtrar la existencia del recurso.
 */
export async function leerAdjunto(
  ejecutor: TransaccionAuditada,
  ctx: SessionContext,
  adjuntoId: string,
  /**
   * `diferirAuditoria` saca el registro de `ADJUNTO_VISTO` del camino crítico
   * con `after`, igual que `buscarPorDocumento`. Son tres idas y vueltas (lock,
   * último hash, insert) de las seis que tenía cada lectura, y ninguna cambia
   * la respuesta. Lo activa el route; las pruebas de aceptación, que traen su
   * propia transacción, lo dejan apagado para poder afirmar sobre la fila.
   */
  opciones: { diferirAuditoria?: boolean } = {},
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
             v.vendedor_usuario_id AS venta_vendedor
      FROM adjuntos a
      LEFT JOIN ventas v ON v.id = a.venta_id
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

  if (opciones.diferirAuditoria) {
    const blobPath = fila.blob_path;
    after(async () => {
      try {
        // En una transacción real: `pg_advisory_xact_lock` solo protege la
        // cadena de hashes mientras dura la transacción, y sobre neon-http
        // cada sentencia es la suya, así que el lock se soltaría de inmediato.
        await dbTx().transaction((tx) =>
          auditarVisto(tx, ctx, adjuntoId, blobPath),
        );
      } catch (error) {
        console.error("[auditoria] ADJUNTO_VISTO vía dbTx", error);
        try {
          // Sin `DATABASE_URL_UNPOOLED` no hay transacción posible. Se registra
          // igual por HTTP: la cadena queda sin el lock, pero perder el rastro
          // del acceso a un documento es peor que un hash disputado.
          await auditarVisto(db, ctx, adjuntoId, blobPath);
        } catch (error2) {
          console.error("[auditoria] ADJUNTO_VISTO perdida", error2);
        }
      }
    });
  } else {
    await auditarVisto(ejecutor, ctx, adjuntoId, fila.blob_path);
  }

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

async function auditarVisto(
  ejecutor: TransaccionAuditada,
  ctx: SessionContext,
  adjuntoId: string,
  blobPath: string,
): Promise<void> {
  await registrar(ejecutor, {
    accion: "ADJUNTO_VISTO",
    entidad: "adjunto",
    entidadId: adjuntoId,
    actor: {
      usuarioId: ctx.usuarioId,
      empresaId: ctx.empresaId,
      rol: ctx.rol,
    },
    datosDespues: { path: blobPath },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });
}

function tienePermiso(ctx: SessionContext, fila: FilaAdjunto): boolean {
  // Los adjuntos históricos de empleados ya no forman parte del producto.
  // Se conservan por retención, pero no se exponen ni siquiera a SUPERADMIN.
  if (fila.venta_id === null) {
    return false;
  }
  if (ctx.rol === "SUPERADMIN") {
    return true;
  }
  if (fila.venta_empresa_vendedora !== ctx.empresaId) {
    return false;
  }
  if (ctx.rol === "VENDEDOR" && fila.venta_vendedor !== ctx.usuarioId) {
    return false;
  }
  return true;
}
