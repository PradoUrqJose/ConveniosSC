/**
 * Copia las fuentes estándar de pdf.js a `public/` (ver `src/lib/miniatura-pdf.ts`).
 *
 * pdf.js las pide por HTTP al rasterizar un PDF que usa una de las 14 fuentes
 * base (Helvetica, Times…) en vez de incrustarlas; sin ellas la página se
 * dibuja sin texto. Se copian en lugar de versionarlas para no meter ~800 KB de
 * binarios en el repo: por eso `public/pdfjs` está en `.gitignore` y este
 * script corre en `postinstall` y antes de `build`.
 */
import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const raizPdfJs = dirname(require.resolve("pdfjs-dist/package.json"));
const destino = join(process.cwd(), "public", "pdfjs", "standard_fonts");

await mkdir(dirname(destino), { recursive: true });
await cp(join(raizPdfJs, "standard_fonts"), destino, { recursive: true });
console.log(`[pdfjs] fuentes estándar copiadas a ${destino}`);
