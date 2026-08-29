import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy de redirección (06-BACKLOG.md T05). La autorización y la validez de la
 * sesión pertenecen al DAL (`requireSession`); consultar Neon desde el proxy
 * duplicaba ese trabajo y añadía una vuelta de red a cada navegación. Aquí solo
 * se descarta la ausencia de cookie y se propaga la ruta al layout.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.method !== "GET") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  const token = request.cookies.get(
    process.env.SESSION_COOKIE_NAME ?? "convenios_sesion",
  )?.value;
  if (!token) {
    return redirigirAlLogin(request);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-convenios-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
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
    "/((?!api|_next|login|~offline|serwist|pdfjs|sw\\.js|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
