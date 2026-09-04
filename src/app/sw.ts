import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkOnly, Serwist } from "serwist";

import {
  esCachePrimero,
  esRedSiempre,
  type PeticionClasificable,
} from "../lib/politica-cache";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Cambiar este nombre si se cambia `injectionPoint` en la ruta que construye el SW.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const esNavegacion = (request: Request) => request.mode === "navigate";

/**
 * Traduce la petición del worker a la entrada de `politica-cache.ts`. Las
 * reglas de qué se guarda y qué no viven ahí, fuera del worker, para poder
 * comprobarlas en la suite (issue #56).
 */
const describir = ({
  request,
  url,
}: {
  request: Request;
  url: URL;
}): PeticionClasificable => ({
  url: url.href,
  metodo: request.method,
  modo: request.mode,
  destino: request.destination,
  esAccionServidor: request.headers.has("next-action"),
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Todo lo autenticado —navegaciones, Server Actions (incluida la
    // búsqueda por DNI), /api/* y el payload RSC— va siempre a la red. El
    // fallback de abajo cubre el caso sin conexión.
    {
      matcher: (opciones) => esRedSiempre(describir(opciones)),
      handler: new NetworkOnly(),
    },
    {
      matcher: (opciones) => esRedSiempre(describir(opciones)),
      method: "POST",
      handler: new NetworkOnly(),
    },
    // Fuentes e iconos: sin sesión y estables, se sirven de caché. Se
    // mantienen los dos cachés históricos para no dejar huérfano el que ya
    // existe en los dispositivos instalados.
    {
      matcher: (opciones) =>
        esCachePrimero(describir(opciones)) &&
        opciones.request.destination === "font",
      handler: new CacheFirst({ cacheName: "fuentes" }),
    },
    {
      matcher: (opciones) => esCachePrimero(describir(opciones)),
      handler: new CacheFirst({ cacheName: "iconos" }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => esNavegacion(request),
      },
    ],
  },
});

serwist.addEventListeners();
