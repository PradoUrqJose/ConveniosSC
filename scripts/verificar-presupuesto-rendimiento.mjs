import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const raiz = process.cwd();
const presupuesto = JSON.parse(
  await readFile(path.join(raiz, "performance/presupuestos.json"), "utf8"),
);
const manifest = JSON.parse(
  await readFile(path.join(raiz, ".next/build-manifest.json"), "utf8"),
);

const tamanoGzip = async (archivo) => {
  const contenido = await readFile(path.join(raiz, ".next", archivo));
  return gzipSync(contenido).byteLength;
};
const archivosCompartidos = new Set(manifest.rootMainFiles ?? []);
const bytesCompartidos = await Promise.all(
  [...archivosCompartidos].map(tamanoGzip),
);
const compartido = bytesCompartidos.reduce((total, bytes) => total + bytes, 0);
const errores = [];
if (compartido > presupuesto.jsGzipCompartidoBytes) {
  errores.push(
    `JS compartido: ${compartido} B gzip supera ${presupuesto.jsGzipCompartidoBytes} B`,
  );
}

// Next 16 no publica app-build-manifest.json con todos los bundlers. Los
// chunks `app/**/page-*.js` son la parte adicional de cada ruta App Router y
// están presentes tanto en Turbopack como en webpack.
const directorioChunks = path.join(raiz, ".next/static/chunks/app");
const entradas = await readdir(directorioChunks, { recursive: true });
const chunksRuta = entradas.filter(
  (entrada) => typeof entrada === "string" && /page-.*\.js$/.test(entrada),
);
const rutaPublica = (entrada) => {
  const segmentos = entrada
    .replace(/\\/g, "/")
    .replace(/\/page-.*$/, "")
    .split("/")
    .filter((segmento) => !/^\(.+\)$/.test(segmento));
  return `/${segmentos.join("/")}`.replace(/\/$/, "") || "/";
};
const rutas = [];
for (const entrada of chunksRuta) {
  const archivo = path.posix.join("static/chunks/app", entrada);
  const total = await tamanoGzip(archivo);
  const ruta = rutaPublica(entrada);
  rutas.push({ ruta, archivo, gzipBytes: total });
  if (total > presupuesto.jsGzipAdicionalRutaBytes) {
    errores.push(
      `${ruta}: ${total} B gzip adicional supera ${presupuesto.jsGzipAdicionalRutaBytes} B`,
    );
  }
}

const reporte = {
  presupuesto,
  compartidoGzipBytes: compartido,
  rutas,
};
const directorioReporte = path.join(raiz, "artifacts", "bundle");
await mkdir(directorioReporte, { recursive: true });
await writeFile(
  path.join(directorioReporte, "reporte-rutas.json"),
  `${JSON.stringify(reporte, null, 2)}\n`,
);
console.info(JSON.stringify(reporte, null, 2));
if (errores.length) throw new Error(errores.join("\n"));
