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
const VERSION_CACHE_PUBLICA = "v2";
const CACHE_FUENTES = `convenios-publicos-${VERSION_CACHE_PUBLICA}-fuentes`;
const CACHE_ICONOS = `convenios-publicos-${VERSION_CACHE_PUBLICA}-iconos`;
const CACHE_FALLBACK = `convenios-publicos-${VERSION_CACHE_PUBLICA}-fallback`;

/** Solo se retiran cachés públicas que esta aplicación creó. */
const limpiarCachesPublicasObsoletas = async () => {
  const actuales = new Set([CACHE_FUENTES, CACHE_ICONOS, CACHE_FALLBACK]);
  const obsoletos = (await caches.keys()).filter(
    (nombre) =>
      (nombre === "fuentes" ||
        nombre === "iconos" ||
        nombre.startsWith("convenios-publicos-")) &&
      !actuales.has(nombre),
  );
  await Promise.all(obsoletos.map((nombre) => caches.delete(nombre)));
};

self.addEventListener("activate", (evento) => {
  evento.waitUntil(limpiarCachesPublicasObsoletas());
});

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_FALLBACK).then((cache) => cache.add("/~offline")),
  );
});

// Las navegaciones necesitan una respuesta HTML completa. Se resuelven a red
// y, si esta no existe, directamente desde el fallback público; así no se
// depende de que el manifiesto inyectado esté disponible en desarrollo.
self.addEventListener("fetch", (evento) => {
  if (!esNavegacion(evento.request)) return;
  evento.respondWith(
    fetch(evento.request).catch(
      async () => (await caches.match("/~offline")) ?? Response.error(),
    ),
  );
});

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
  esRsc: request.headers.get("rsc") === "1",
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // La activación la solicita el aviso de UI con `SKIP_WAITING`, después de
  // persistir un posible borrador. Nunca se reemplaza una pestaña a mitad de
  // una venta sin que la persona lo decida.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Todo lo autenticado —navegaciones, Server Actions (incluida la
    // búsqueda por DNI), /api/* y el payload RSC— va siempre a la red.
    {
      matcher: (opciones) =>
        !esNavegacion(opciones.request) && esRedSiempre(describir(opciones)),
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
      handler: new CacheFirst({ cacheName: CACHE_FUENTES }),
    },
    {
      matcher: (opciones) => esCachePrimero(describir(opciones)),
      handler: new CacheFirst({ cacheName: CACHE_ICONOS }),
    },
  ],
});

serwist.addEventListeners();
