/**
 * Conversión de color y contraste WCAG — issue #55 (PWA-MOB-05).
 *
 * El sistema móvil declara sus superficies y sus textos como tokens
 * `oklch()` en `globals.css`. "Auditar contraste en claro y oscuro" con una
 * captura de pantalla y buen ojo no es auditar: es adivinar. Acá está la
 * matemática mínima para poder afirmarlo en un test —
 * `src/lib/contraste-movil.test.ts` lee los tokens reales del CSS y calcula
 * el ratio de cada par— y para que un cambio de token que rompa el
 * contraste falle en `npm test` en vez de descubrirse en producción.
 *
 * Alcance deliberado: solo lo que el CSS del sistema móvil usa hoy —
 * `oklch()` con alfa opcional y `color-mix(in oklab, <color> N%, <color>)`.
 * No pretende ser un motor de color completo.
 */

export type Rgb = { r: number; g: number; b: number; a: number };
type Oklab = { L: number; a: number; b: number; alpha: number };

function acotar(valor: number, minimo = 0, maximo = 1): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/** OKLab → sRGB lineal (matriz de la especificación CSS Color 4). */
function oklabARgbLineal({ L, a, b }: Oklab) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function codificarGamma(canal: number): number {
  const c = acotar(canal);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

function decodificarGamma(canal: number): number {
  const c = acotar(canal);
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function oklabARgb(color: Oklab): Rgb {
  const lineal = oklabARgbLineal(color);
  return {
    r: codificarGamma(lineal.r),
    g: codificarGamma(lineal.g),
    b: codificarGamma(lineal.b),
    a: color.alpha,
  };
}

function rgbAOklab({ r, g, b, a }: Rgb): Oklab {
  const rl = decodificarGamma(r);
  const gl = decodificarGamma(g);
  const bl = decodificarGamma(b);
  const l = Math.cbrt(
    0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl,
  );
  const m = Math.cbrt(
    0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl,
  );
  const s = Math.cbrt(
    0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl,
  );
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    alpha: a,
  };
}

/** Corta el string por comas de primer nivel (ignora las de un `var()`). */
function partirPorComas(texto: string): string[] {
  const partes: string[] = [];
  let profundidad = 0;
  let actual = "";
  for (const caracter of texto) {
    if (caracter === "(") profundidad += 1;
    if (caracter === ")") profundidad -= 1;
    if (caracter === "," && profundidad === 0) {
      partes.push(actual.trim());
      actual = "";
      continue;
    }
    actual += caracter;
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
}

function proporcion(valor: string): number {
  return valor.trim().endsWith("%")
    ? Number.parseFloat(valor) / 100
    : Number.parseFloat(valor);
}

const NOMBRADOS: Record<string, Rgb> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 1, g: 1, b: 1, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

/**
 * Resuelve un valor de color CSS a sRGB. `tokens` es el mapa de custom
 * properties ya aplanado del modo que se esté auditando (claro u oscuro).
 */
export function resolverColor(
  valor: string,
  tokens: Record<string, string> = {},
  profundidad = 0,
): Rgb {
  const texto = valor.trim();
  if (profundidad > 12) {
    throw new Error(`Referencia circular resolviendo "${valor}".`);
  }
  const nombrado = NOMBRADOS[texto];
  if (nombrado) return nombrado;

  const variable = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(texto);
  if (variable) {
    const nombre = variable[1] ?? "";
    const referido = tokens[nombre] ?? variable[2];
    if (referido === undefined) {
      throw new Error(`Token ${nombre} no está declarado.`);
    }
    return resolverColor(referido, tokens, profundidad + 1);
  }

  const oklch = /^oklch\(\s*([^)]+)\)$/.exec(texto);
  if (oklch) {
    const [canales = "", alfa] = (oklch[1] ?? "").split("/");
    const [l = "0", c = "0", h = "0"] = canales.trim().split(/\s+/);
    const L = proporcion(l);
    const C = Number.parseFloat(c);
    const H = ((Number.parseFloat(h) || 0) * Math.PI) / 180;
    return oklabARgb({
      L,
      a: C * Math.cos(H),
      b: C * Math.sin(H),
      alpha: alfa === undefined ? 1 : proporcion(alfa),
    });
  }

  const mezcla = /^color-mix\(\s*in\s+oklab\s*,\s*([\s\S]+)\)$/.exec(texto);
  if (mezcla) {
    const partes = partirPorComas(mezcla[1] ?? "");
    const [uno, dos] = partes;
    if (uno === undefined || dos === undefined || partes.length !== 2) {
      throw new Error(`color-mix con forma no soportada: "${texto}".`);
    }
    const leer = (parte: string) => {
      const conPeso = /^([\s\S]*)\s+([\d.]+%)$/.exec(parte.trim());
      return conPeso
        ? { color: conPeso[1] ?? "", peso: proporcion(conPeso[2] ?? "50%") }
        : { color: parte, peso: Number.NaN };
    };
    const primero = leer(uno);
    const segundo = leer(dos);
    const p1 = Number.isNaN(primero.peso)
      ? 1 - (Number.isNaN(segundo.peso) ? 0.5 : segundo.peso)
      : primero.peso;
    const a = rgbAOklab(resolverColor(primero.color, tokens, profundidad + 1));
    const b = rgbAOklab(resolverColor(segundo.color, tokens, profundidad + 1));
    // Interpolación premultiplicada por alfa, como manda CSS Color 5.
    const alfa = a.alpha * p1 + b.alpha * (1 - p1);
    const mezclar = (x: number, y: number) =>
      alfa === 0 ? 0 : (x * a.alpha * p1 + y * b.alpha * (1 - p1)) / alfa;
    return oklabARgb({
      L: mezclar(a.L, b.L),
      a: mezclar(a.a, b.a),
      b: mezclar(a.b, b.b),
      alpha: alfa,
    });
  }

  throw new Error(`Valor de color no soportado: "${texto}".`);
}

/** Compone un color (posiblemente translúcido) sobre un fondo opaco. */
export function componer(frente: Rgb, fondo: Rgb): Rgb {
  const a = frente.a;
  return {
    r: frente.r * a + fondo.r * (1 - a),
    g: frente.g * a + fondo.g * (1 - a),
    b: frente.b * a + fondo.b * (1 - a),
    a: 1,
  };
}

export function luminanciaRelativa({ r, g, b }: Rgb): number {
  return (
    0.2126 * decodificarGamma(r) +
    0.7152 * decodificarGamma(g) +
    0.0722 * decodificarGamma(b)
  );
}

/** Ratio de contraste WCAG 2.x entre dos colores ya opacos. */
export function contraste(frente: Rgb, fondo: Rgb): number {
  const a = luminanciaRelativa(frente);
  const b = luminanciaRelativa(fondo);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}
