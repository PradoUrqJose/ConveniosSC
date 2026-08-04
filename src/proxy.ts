import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy de redirección (06-BACKLOG.md T05). Solo redirige a nivel de
 * navegación; la autorización real vive en cada Server Action (`requireSession`
 * / `requireRol`). No aplica a peticiones no-GET ni a `/api`, `/_next`, `/login`
 * ni assets estáticos. Tampoco a `/sw.js` (el service worker se precachea y
 * se sirve sin sesión) ni a `/~offline` (el fallback offline debe cargar sin red).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.method !== "GET") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  const { SESSION_COOKIE_NAME } = await import("@/lib/auth/sesion");
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return redirigirAlLogin(request);
  }

  const { db } = await import("@/db");
  const { obtenerSesionValida, refrescarUltimoUso } =
    await import("@/lib/auth/sesion");

  const sesion = await obtenerSesionValida(db, token);
  if (!sesion) {
    return redirigirAlLogin(request);
  }

  await refrescarUltimoUso(db, sesion.sesionId);

  if (sesion.debeCambiarPassword && pathname !== "/perfil/password") {
    return NextResponse.redirect(new URL("/perfil/password", request.url));
  }

  return NextResponse.next();
}

function redirigirAlLogin(request: NextRequest): NextResponse {
  const url = new URL("/login", request.url);
  const destino = request.nextUrl.pathname + request.nextUrl.search;
  if (destino !== "/login") {
    url.searchParams.set("volver", destino);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!api|_next|login|~offline|sw\\.js|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
