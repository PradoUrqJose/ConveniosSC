import { createSerwistRoute } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";

/**
 * Revisión de las entradas de precaché: cambia con cada despliegue para que el
 * service worker las revalide. En Vercel viene dada; en local se pregunta a
 * git, y si tampoco hay repositorio se cae a un UUID (peor caché, nunca una
 * entrada obsoleta).
 */
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  (spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf-8",
  }).stdout?.trim() ||
    crypto.randomUUID());

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: [
      { url: "/~offline", revision },
      { url: "/icons/192.png", revision },
      { url: "/icons/512.png", revision },
      { url: "/icons/maskable-512.png", revision },
      { url: "/icons/apple-touch-icon.png", revision },
    ],
  });
