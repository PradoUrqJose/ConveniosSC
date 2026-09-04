import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda de semántica de controles — issue #55 (PWA-MOB-05).
 *
 * La auditoría móvil encontró la consola repitiendo el aviso de Base UI por
 * pérdida de semántica nativa. El origen es siempre el mismo patrón: una
 * primitiva que espera un `<button>` nativo (`Button`, `*.Trigger`,
 * `*.Close`) recibe por `render` un `<a>`, un `<Link>` o un `<div>`. Las
 * dos salidas fáciles son peores que el aviso:
 *
 * - `nativeButton={false}` calla la consola pero le pone `role="button"` a
 *   un enlace, y el lector de pantalla deja de anunciarlo como destino.
 * - Dejarlo como está rompe el teclado (un `<div>` no recibe foco ni
 *   responde a Espacio) y el menú contextual del enlace.
 *
 * La salida correcta es elegir bien el elemento: si navega, es un `<a>` con
 * pinta de control (`.mob-enlace-accion` / `EnlaceAccionMovil`); si ejecuta
 * una acción, es un `<button>` de verdad. Ese arreglo ya se hizo en el #52 y
 * el #55; este test es lo que impide que vuelva, porque el aviso solo se ve
 * abriendo la consola en la ruta exacta y nadie lo mira en un code review.
 *
 * Es un análisis de texto, no de AST: prefiere un falso positivo evidente
 * (que se arregla eligiendo el elemento correcto) a dejar pasar el caso.
 */

const RAIZ = path.join(process.cwd(), "src");

function archivosTsx(directorio: string): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const completo = path.join(directorio, entrada);
    if (statSync(completo).isDirectory()) return archivosTsx(completo);
    return completo.endsWith(".tsx") ? [completo] : [];
  });
}

/** El archivo sin comentarios: la prosa de este repo cita los patrones
 *  prohibidos para explicarlos, y citarlos no es cometerlos. */
function codigo(archivo: string): string {
  return readFileSync(archivo, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** Elemento que `render` recibe. */
function elementosEnRender(fuente: string): string[] {
  return [...fuente.matchAll(/render=\{\s*<\s*([A-Za-z][\w.]*)/g)].flatMap(
    (coincidencia) => coincidencia[1] ?? [],
  );
}

/**
 * Elementos de navegación. Son los que disparan el aviso: una primitiva de
 * botón que recibe un destino. El resto de lo que puede aparecer en un
 * `render` (un ícono para `Select.Icon`, un `<span>` presentacional) no
 * tiene nada que ver con la semántica de botón y no se juzga acá.
 */
const NAVEGACION = new Set(["a", "Link", "NextLink", "EnlaceAccionMovil"]);

const ARCHIVOS = archivosTsx(RAIZ);

describe("semántica de controles (issue #55)", () => {
  it("encuentra los componentes del proyecto", () => {
    expect(ARCHIVOS.length).toBeGreaterThan(20);
  });

  it("ninguna primitiva recibe un enlace o un contenedor en `render`", () => {
    const infracciones: string[] = [];
    for (const archivo of ARCHIVOS) {
      for (const elemento of elementosEnRender(codigo(archivo))) {
        if (!NAVEGACION.has(elemento)) continue;
        infracciones.push(
          `${path.relative(process.cwd(), archivo)}: render={<${elemento} …>}`,
        );
      }
    }
    expect(
      infracciones,
      `Base UI espera un <button> nativo en \`render\`. Si el control navega, usá un <a>/<Link> propio (EnlaceAccionMovil o .mob-enlace-accion) en vez de envolverlo en una primitiva de botón:\n${infracciones.join("\n")}`,
    ).toEqual([]);
  });

  it("nadie apaga `nativeButton` para silenciar el aviso", () => {
    const infracciones = ARCHIVOS.filter((archivo) =>
      /nativeButton=\{false\}/.test(codigo(archivo)),
    ).map((archivo) => path.relative(process.cwd(), archivo));
    expect(
      infracciones,
      "`nativeButton={false}` calla la consola poniéndole role=button a un enlace: el lector de pantalla deja de anunciarlo como destino.",
    ).toEqual([]);
  });

  it("los controles móviles declaran type en el <button>", () => {
    // Un <button> sin type dentro de un formulario lo envía. Es el bug
    // silencioso más caro de esta familia y no lo ve ningún test de UI.
    const fuente = codigo(path.join(RAIZ, "components/ui/controles-movil.tsx"));
    const sinType = [...fuente.matchAll(/<button\b([\s\S]{0,300}?)>/g)].filter(
      (etiqueta) => !/\btype=/.test(etiqueta[1] ?? ""),
    );
    expect(sinType.map((etiqueta) => etiqueta[0])).toEqual([]);
  });
});
