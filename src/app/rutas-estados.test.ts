import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Contrato estructural del issue #56: «cada ruta crítica define carga,
 * vacío, error y retry».
 *
 * El vacío y el retry son de cada pantalla y se comprueban en la e2e; lo
 * que sí se puede fijar acá —y es lo que se olvida al añadir una ruta— es
 * que toda pantalla tenga un `loading.tsx` y quede cubierta por un
 * `error.tsx`, propio o heredado del segmento padre. Sin este test, la
 * ruta número dieciséis nace sin frontera de error y nadie se entera hasta
 * que un usuario ve la pantalla en blanco de Next.
 */
const RAIZ = join(import.meta.dirname);

/** Segmentos que no son rutas de aplicación. */
const IGNORADOS = new Set(["api", "serwist"]);

function esGrupo(nombre: string): boolean {
  return nombre.startsWith("(") && nombre.endsWith(")");
}

type Segmento = { ruta: string; dir: string };

function recorrer(dir: string, ruta: string, salida: Segmento[]) {
  const entradas = readdirSync(dir);
  if (entradas.includes("page.tsx")) salida.push({ ruta, dir });
  for (const entrada of entradas) {
    if (IGNORADOS.has(entrada)) continue;
    const completo = join(dir, entrada);
    if (!statSync(completo).isDirectory()) continue;
    recorrer(completo, esGrupo(entrada) ? ruta : `${ruta}/${entrada}`, salida);
  }
}

const segmentos: Segmento[] = [];
recorrer(RAIZ, "", segmentos);

/** ¿Existe `archivo` en el segmento o en alguno de sus ancestros? */
function cubiertoPor(dir: string, archivo: string): boolean {
  let actual = dir;
  for (;;) {
    if (readdirSync(actual).includes(archivo)) return true;
    if (actual === RAIZ) return false;
    actual = join(actual, "..");
  }
}

describe("estados de ruta", () => {
  it("encuentra todas las pantallas", () => {
    // Red de seguridad del propio test: si el recorrido se rompe, los
    // `it.each` de abajo pasarían con cero casos.
    expect(segmentos.length).toBeGreaterThanOrEqual(15);
  });

  it.each(segmentos.map((s) => [s.ruta || "/", s.dir] as const))(
    "%s tiene esqueleto de carga",
    (_ruta, dir) => {
      expect(cubiertoPor(dir, "loading.tsx")).toBe(true);
    },
  );

  it.each(segmentos.map((s) => [s.ruta || "/", s.dir] as const))(
    "%s está cubierta por una frontera de error",
    (_ruta, dir) => {
      expect(cubiertoPor(dir, "error.tsx")).toBe(true);
    },
  );

  it("existe el último recinto para un fallo del layout raíz", () => {
    expect(readdirSync(RAIZ)).toContain("global-error.tsx");
  });
});
