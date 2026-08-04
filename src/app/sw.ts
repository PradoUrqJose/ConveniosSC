import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Cambiar este nombre si se cambia `injectionPoint` en la ruta que construye el SW.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const esNavegacion = (request: Request) => request.mode === "navigate";
const esAccionServidor = (request: Request) =>
  request.headers.has("next-action");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Páginas: siempre red. El fallback de abajo cubre el caso sin conexión.
    {
      matcher: ({ request }) => esNavegacion(request),
      handler: new NetworkOnly(),
    },
    // Server Actions (POST con header `Next-Action`): nunca se cachean.
    {
      matcher: ({ request }) => esAccionServidor(request),
      method: "POST",
      handler: new NetworkOnly(),
    },
    // /api/*: nunca se cachea, en ningún método.
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      method: "GET",
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      method: "POST",
      handler: new NetworkOnly(),
    },
    // Fuentes e iconos: una vez descargados, se sirven de caché.
    {
      matcher: ({ request }) => request.destination === "font",
      handler: new CacheFirst({ cacheName: "fuentes" }),
    },
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/icons/") || url.pathname === "/favicon.ico",
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
