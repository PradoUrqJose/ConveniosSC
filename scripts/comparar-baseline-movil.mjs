import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [archivo] = process.argv.slice(2);
if (!archivo)
  throw new Error(
    "Uso: node scripts/comparar-baseline-movil.mjs <reporte.json>",
  );
const muestras = JSON.parse(await readFile(archivo, "utf8"));
const presupuesto = JSON.parse(
  await readFile("performance/presupuestos.json", "utf8"),
);
const percentil = (valores, p) => {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[
    Math.min(ordenados.length - 1, Math.ceil(ordenados.length * p) - 1)
  ];
};
const grupos = Object.groupBy(muestras, (muestra) =>
  [
    muestra.ruta,
    muestra.rol,
    muestra.dispositivo,
    muestra.red,
    muestra.tipo,
  ].join("|"),
);
const errores = [];
const resumen = [];
for (const [clave, grupo] of Object.entries(grupos)) {
  const esperadas = grupo[0].tipo === "fria" ? 3 : 5;
  if (grupo.length !== esperadas) {
    errores.push(
      `${clave}: se esperaban ${esperadas} muestras ${grupo[0].tipo} y llegaron ${grupo.length}`,
    );
    continue;
  }
  const p75 = (campo) =>
    percentil(
      grupo.map((muestra) => muestra[campo]),
      0.75,
    );
  const p95 = (campo) =>
    percentil(
      grupo.map((muestra) => muestra[campo]),
      0.95,
    );
  const actual = {
    LCP: p75("lcpMs"),
    INP: p75("inpMs"),
    CLS: p75("cls"),
    shell: p95("shellMs"),
  };
  resumen.push({ grupo: clave, ...actual, muestras: grupo.length });
  for (const metrica of ["LCP", "INP", "CLS"]) {
    if (actual[metrica] > presupuesto.webVitalsP75[metrica])
      errores.push(
        `${clave}: p75 ${metrica}=${actual[metrica]} excede ${presupuesto.webVitalsP75[metrica]}`,
      );
  }
  if (
    grupo[0].tipo === "caliente" &&
    actual.shell > presupuesto.shellCalienteP95Ms
  ) {
    errores.push(
      `${clave}: p95 shell=${actual.shell} excede ${presupuesto.shellCalienteP95Ms}`,
    );
  }
}
const salida = path.join(path.dirname(archivo), "movil-resumen.json");
await writeFile(salida, `${JSON.stringify(resumen, null, 2)}\n`);
console.info(JSON.stringify(resumen, null, 2));
if (errores.length) throw new Error(errores.join("\n"));
