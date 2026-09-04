import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { componer, contraste, resolverColor, type Rgb } from "@/lib/color";

/**
 * Auditoría de contraste del sistema móvil — issue #55 (PWA-MOB-05).
 *
 * Lee los tokens reales de `src/app/globals.css` (no una copia: si alguien
 * cambia un `--mob-*`, este test lo ve) y comprueba cada par
 * texto-sobre-fondo que el sistema pinta, en claro y en oscuro.
 *
 * Umbrales WCAG 2.2: 4.5:1 para texto normal (AA, criterio 1.4.3) y 3:1
 * para texto grande y para componentes de interfaz (1.4.11) — el indicador
 * de la barra inferior o el anillo de foco son formas, no párrafos.
 *
 * Los pares translúcidos (los pills semánticos, el fondo de los controles
 * de cabecera) se componen antes de medir: el contraste real es contra el
 * color que queda después de la mezcla, no contra el color declarado.
 */

// Los comentarios se van antes de parsear: dentro de uno hay llaves y
// puntos y comas que arruinan cualquier lectura por expresión regular.
const CSS = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Aplana las custom properties de todos los bloques de un selector en orden
 * de aparición. Para un viewport móvil todos los `:root` del archivo
 * aplican, incluido el que vive dentro del `@media (max-width: 1023.98px)`,
 * y el último gana — que es exactamente lo que hace el navegador.
 */
function tokensDe(selector: string): Record<string, string> {
  const mapa: Record<string, string> = {};
  const bloques = CSS.matchAll(
    new RegExp(`(?:^|[\\s{])${selector}\\s*\\{([^{}]*)\\}`, "g"),
  );
  for (const bloque of bloques) {
    const declaraciones = (bloque[1] ?? "").matchAll(
      /(--[\w-]+)\s*:\s*([^;]+);/g,
    );
    for (const declaracion of declaraciones) {
      const nombre = declaracion[1];
      const valor = declaracion[2];
      if (nombre && valor) mapa[nombre] = valor.trim();
    }
  }
  return mapa;
}

const CLARO = tokensDe(":root");
const OSCURO = { ...CLARO, ...tokensDe("\\.dark") };
const MODOS = { claro: CLARO, oscuro: OSCURO } as const;

function color(valor: string, tokens: Record<string, string>): Rgb {
  return resolverColor(valor, tokens);
}

/** Ratio del `frente` sobre `fondo`, componiendo si el frente es translúcido. */
function ratio(
  frente: string,
  fondo: string,
  tokens: Record<string, string>,
): number {
  const base = color(fondo, tokens);
  return contraste(componer(color(frente, tokens), base), base);
}

/** Pares texto/fondo del sistema móvil. `minimo` según 1.4.3 vs 1.4.11. */
const PARES = [
  {
    que: "texto sobre el fondo de pantalla",
    frente: "var(--mob-bg-foreground)",
    fondo: "var(--mob-bg)",
    minimo: 4.5,
  },
  {
    que: "texto sobre la tarjeta",
    frente: "var(--mob-superficie-foreground)",
    fondo: "var(--mob-superficie)",
    minimo: 4.5,
  },
  {
    que: "texto secundario sobre la tarjeta",
    frente: "var(--mob-superficie-tenue-foreground)",
    fondo: "var(--mob-superficie)",
    minimo: 4.5,
  },
  {
    que: "texto secundario sobre el bloque tenue",
    frente: "var(--mob-superficie-tenue-foreground)",
    fondo: "var(--mob-superficie-tenue)",
    minimo: 4.5,
  },
  {
    que: "etiqueta del botón primario",
    frente: "var(--mob-acento-foreground)",
    fondo: "var(--mob-acento)",
    minimo: 4.5,
  },
  {
    que: "acento sobre la tarjeta (indicador y enlaces)",
    frente: "var(--mob-acento)",
    fondo: "var(--mob-superficie)",
    minimo: 3,
  },
  {
    que: "pill correcto",
    frente: "var(--mob-pill-ok-fg)",
    fondo: "var(--mob-superficie)",
    minimo: 4.5,
  },
  {
    que: "pill de atención",
    frente: "var(--mob-pill-atencion-fg)",
    fondo: "var(--mob-superficie)",
    minimo: 4.5,
  },
  {
    que: "pill de error",
    frente: "var(--mob-pill-error-fg)",
    fondo: "var(--mob-superficie)",
    minimo: 4.5,
  },
  {
    que: "mensaje de error de un campo",
    frente: "var(--mob-pill-error-fg)",
    fondo: "var(--mob-superficie-tenue)",
    minimo: 4.5,
  },
  {
    que: "texto del botón destructivo",
    frente: "var(--mob-destructivo-foreground)",
    fondo: "var(--mob-destructivo)",
    minimo: 4.5,
  },
] as const;

describe("contraste del sistema móvil (issue #55)", () => {
  it("declara los tokens del sistema móvil en los dos modos", () => {
    for (const [modo, tokens] of Object.entries(MODOS)) {
      expect(tokens["--mob-bg"], `--mob-bg en ${modo}`).toBeDefined();
      expect(
        tokens["--mob-superficie"],
        `--mob-superficie en ${modo}`,
      ).toBeDefined();
    }
    // La rampa se declara por modo, nunca aliasada (invariante del #51).
    expect(OSCURO["--mob-bg"]).not.toBe(CLARO["--mob-bg"]);
    expect(OSCURO["--mob-superficie"]).not.toBe(CLARO["--mob-superficie"]);
  });

  for (const [modo, tokens] of Object.entries(MODOS)) {
    describe(`modo ${modo}`, () => {
      for (const par of PARES) {
        it(`${par.que} alcanza ${par.minimo}:1`, () => {
          const medido = ratio(par.frente, par.fondo, tokens);
          expect(
            Number(medido.toFixed(2)),
            `${par.que} en ${modo}: ${medido.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(par.minimo);
        });
      }

      it("la tarjeta se separa del fondo por luminosidad, sin bordes", () => {
        // Invariante de color del #51: fondo y superficie salen de la misma
        // rampa del mismo modo. Si alguien vuelve a mezclar tokens de
        // escritorio (página oscura con tarjeta blanca), esto lo caza.
        const separacion = ratio(
          "var(--mob-superficie)",
          "var(--mob-bg)",
          tokens,
        );
        expect(separacion).toBeGreaterThan(1.02);
        expect(separacion).toBeLessThan(3);
      });
    });
  }
});
