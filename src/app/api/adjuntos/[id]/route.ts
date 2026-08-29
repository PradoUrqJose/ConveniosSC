import { NextRequest } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";

import { db } from "@/db";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { leerAdjunto } from "@/modules/adjuntos/lectura";

const TTL_MS = 600_000;
/** Holgada respecto a `TTL_MS`, que es lo que dura la URL a la que redirige. */
const CACHE_MINIATURA_S = 240;

/**
 * `GET /api/adjuntos/[id]` (02 §8 «Lectura»): devuelve 302 a una URL firmada
 * de Vercel Blob con TTL de 600 s. Nunca se sirve una URL pública.
 *
 * `?miniatura=1` marca la petición que hace el `<img>` de la galería, no una
 * apertura deliberada del documento: esa sí se puede cachear en el navegador
 * (`private`, nunca en una caché compartida), y así volver a pintar la galería
 * deja de costar una vuelta al servidor por adjunto. La apertura del archivo
 * —el `<a href>` sin el parámetro— sigue con `no-store` para que cada acceso
 * real quede en `ADJUNTO_VISTO`: es el evento que la auditoría necesita.
 *
 * 401 sin sesión; 429 si se supera el rate limit; 404 si no existe o si no
 * hay permiso (mismo cuerpo, para no filtrar la existencia del recurso).
 */
export async function GET(
  req: NextRequest,
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

  // Sin la auditoría en el camino crítico ya no hace falta una transacción, y
  // con ella se va el handshake WebSocket de `dbTx()` en cada instancia fría.
  const resultado = await leerAdjunto(db, sesion, id, {
    diferirAuditoria: true,
  });
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

  const esMiniatura = req.nextUrl.searchParams.get("miniatura") === "1";

  return new Response(null, {
    status: 302,
    headers: {
      Location: destino,
      // Por debajo del TTL del token firmado, para no cachear un redirect a
      // una URL ya caducada.
      "Cache-Control": esMiniatura
        ? `private, max-age=${CACHE_MINIATURA_S}`
        : "private, no-store",
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
