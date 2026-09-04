/**
 * Política de caché del service worker — issue #56 (PWA-MOB-06).
 *
 * El criterio de aceptación «DNI, ventas y documentos no se cachean» no se
 * puede comprobar leyendo `sw.ts`: los matchers viven dentro de la
 * construcción de Serwist y solo existen dentro de un worker. Acá quedan
 * como una función pura que `sw.ts` consume y que la suite verifica ruta por
 * ruta, así que una regla nueva mal puesta se cae en `npm test` y no en
 * producción con datos de un empleado servidos desde el disco del teléfono.
 *
 * Regla de fondo: **ninguna respuesta autenticada se guarda**. Fabricar
 * velocidad cacheando ventas o documentos de identidad significaría dejarlos
 * legibles en un dispositivo compartido y mostrar importes viejos como si
 * fueran de ahora.
 *
 * Import relativo a propósito: este módulo lo compila esbuild para el worker,
 * fuera del resolutor de alias de Next.
 */

export type PoliticaCache =
  /** Siempre red; si no hay red, falla (y navegación cae en `~offline`). */
  | "red-siempre"
  /** Estático e inmutable: se sirve de caché apenas se descarga una vez. */
  | "cache-primero"
  /** Sin regla propia: lo resuelve el precaché del build. */
  | "sin-regla";

export type PeticionClasificable = {
  /** URL absoluta o ruta; solo se mira el `pathname`. */
  url: string;
  metodo: string;
  /** `request.mode`: "navigate" en una navegación de página. */
  modo?: string;
  /** `request.destination`: "font", "image", … */
  destino?: string;
  /** ¿Trae la cabecera `Next-Action`? (Server Action de Next). */
  esAccionServidor?: boolean;
};

function rutaDe(url: string): string {
  try {
    return new URL(url, "http://local").pathname;
  } catch {
    return url;
  }
}

export function politicaDeCache(peticion: PeticionClasificable): PoliticaCache {
  const ruta = rutaDe(peticion.url);
  const metodo = peticion.metodo.toUpperCase();

  // 1. Navegaciones: son HTML autenticado y con datos del periodo actual.
  if (peticion.modo === "navigate") return "red-siempre";

  // 2. Server Actions (búsqueda de DNI, alta de venta, verificación…).
  if (peticion.esAccionServidor) return "red-siempre";

  // 3. API: adjuntos (documentos de identidad y evidencias), exportaciones,
  //    subidas a blob y cron. Ningún método se guarda.
  if (ruta.startsWith("/api/")) return "red-siempre";

  // 4. Datos de Next para navegaciones cliente (RSC payload): mismo
  //    contenido autenticado que el HTML, mismo trato.
  if (ruta.endsWith(".rsc") || ruta.endsWith(".txt?_rsc")) {
    return "red-siempre";
  }

  // 5. Estáticos sin sesión: tipografías e iconos de la PWA.
  if (peticion.destino === "font") return "cache-primero";
  if (ruta.startsWith("/icons/") || ruta === "/favicon.ico") {
    return "cache-primero";
  }

  // 6. El resto (chunks de `/_next/static`, manifest, sw) lo cubre el
  //    precaché versionado por commit; no se le pone regla encima.
  if (metodo !== "GET") return "red-siempre";
  return "sin-regla";
}

/** Azúcar para los matchers de Serwist. */
export function esRedSiempre(peticion: PeticionClasificable): boolean {
  return politicaDeCache(peticion) === "red-siempre";
}

export function esCachePrimero(peticion: PeticionClasificable): boolean {
  return politicaDeCache(peticion) === "cache-primero";
}
