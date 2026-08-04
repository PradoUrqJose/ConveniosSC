import { NextRequest } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";

import { dbTx } from "@/db";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { leerAdjunto } from "@/modules/adjuntos/lectura";

const TTL_MS = 600_000;

/**
 * `GET /api/adjuntos/[id]` (02 §8 «Lectura»): devuelve 302 a una URL firmada
 * de Vercel Blob con TTL de 600 s. Nunca se sirve una URL pública ni se
 * cachea la respuesta.
 *
 * 401 sin sesión; 429 si se supera el rate limit; 404 si no existe o si no
 * hay permiso (mismo cuerpo, para no filtrar la existencia del recurso).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (e) {
    if (e instanceof ErrorAuth && e.codigo === "NO_AUTENTICADO") {
      return new Response("No hay sesión activa.", { status: 401 });
    }
    return new Response("No hay sesión activa.", { status: 401 });
  }
  const { id } = await ctx.params;

  const resultado = await dbTx().transaction((tx) =>
    leerAdjunto(tx, sesion, id),
  );
  if (!resultado.ok) {
    if (resultado.codigo === "LIMITE_EXCEDIDO") {
      return new Response(resultado.mensaje, { status: 429 });
    }
    return new Response("No se encontró el archivo.", { status: 404 });
  }

  const destino = await urlFirmada(resultado.data.blobPath);
  if (!destino) {
    return new Response("No se encontró el archivo.", { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: destino,
      "Cache-Control": "private, no-store",
    },
  });
}

/** URL firmada con TTL 600 s, o null si el blob no es de Vercel Blob. */
async function urlFirmada(blobPath: string): Promise<string | null> {
  if (blobPath.startsWith("/uploads/")) {
    // Fallback local de desarrollo (sin Vercel Blob).
    return blobPath;
  }
  try {
    const firmado = await issueSignedToken({
      pathname: blobPath,
      operations: ["get"],
      validUntil: Date.now() + TTL_MS,
    });
    const { presignedUrl } = await presignUrl(firmado, {
      access: "private",
      operation: "get",
      pathname: blobPath,
      validUntil: Date.now() + TTL_MS,
    });
    return presignedUrl;
  } catch {
    return null;
  }
}
