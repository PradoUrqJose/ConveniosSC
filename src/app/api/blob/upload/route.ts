import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { sql } from "drizzle-orm";

import { db, dbTx } from "@/db";
import { obtenerFilas, registrar } from "@/lib/audit/registrar";
import { requireSession } from "@/lib/auth/guardas";
import { rateLimit } from "@/lib/rate-limit";
import { MIME_PERMITIDOS, validarRutaBlob } from "@/lib/archivos";

const MAX_BYTES = 10_485_760;
const LIMITE_SUBIDAS = 60;
const VENTANA_SUBIDAS_MS = 5 * 60 * 1000;

/**
 * `POST /api/blob/upload` (03 §10): implementa `handleUpload` de Vercel Blob.
 * Emite tokens de subida con restricciones y, al completarse la subida,
 * audita `ADJUNTO_SUBIDO`. La fila en `adjuntos` se crea recién al guardar
 * la venta. Los documentos de identidad ya no se cargan.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const respuesta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const ctx = await requireSession();

        const control = await rateLimit(db, `upload:${ctx.usuarioId}`, {
          limite: LIMITE_SUBIDAS,
          ventanaMs: VENTANA_SUBIDAS_MS,
        });
        if (!control.permitido) {
          throw new Error(
            "Demasiadas subidas. Inténtalo de nuevo en unos minutos.",
          );
        }

        if (!validarRutaBlob(pathname)) {
          throw new Error("La ruta del archivo no es válida.");
        }

        return {
          allowedContentTypes: [...MIME_PERMITIDOS],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ usuarioId: ctx.usuarioId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let usuarioId: string | null = null;
        if (tokenPayload) {
          try {
            const decodificado = JSON.parse(tokenPayload) as {
              usuarioId?: string;
            };
            usuarioId = decodificado.usuarioId ?? null;
          } catch {
            usuarioId = null;
          }
        }
        if (!usuarioId) {
          return;
        }

        await dbTx().transaction(async (tx) => {
          const fila = obtenerFilas(
            await tx.execute(sql`
              SELECT id, empresa_id, rol FROM usuarios WHERE id = ${usuarioId}
            `),
          )[0];
          if (!fila) {
            return;
          }
          await registrar(tx, {
            accion: "ADJUNTO_SUBIDO",
            entidad: "adjunto",
            entidadId: blob.pathname,
            actor: {
              usuarioId,
              empresaId: (fila.empresa_id as string | null) ?? null,
              rol: String(fila.rol) as
                "SUPERADMIN" | "ADMIN_EMPRESA" | "VENDEDOR",
            },
            datosDespues: {
              path: blob.pathname,
              url: blob.url,
              contentType: blob.contentType,
            },
            requestId: null,
          });
        });
      },
    });
    return NextResponse.json(respuesta);
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : "No se pudo subir el archivo.";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
