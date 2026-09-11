/**
 * Presentación de la tarjeta de venta móvil (rediseño PWA 2026-09, v3).
 *
 * Funciones puras, fuera del componente, para que el color de cada persona
 * y el tramo del descuento sean deterministas y probables sin renderizar.
 * La piel de cada tono vive en `globals.css` (`--mob-tono-*`).
 */

export const TONOS_PERSONA = [
  "azul",
  "verde",
  "morado",
  "naranja",
  "rosa",
  "ambar",
] as const;

export type TonoPersona = (typeof TONOS_PERSONA)[number];

/**
 * Color estable por persona: el mismo documento cae siempre en el mismo
 * tono, así el empleado se reconoce de un vistazo entre sus ventas.
 */
export function tonoPersona(clave: string): TonoPersona {
  let hash = 0;
  for (const caracter of clave) {
    hash = (hash * 31 + caracter.charCodeAt(0)) >>> 0;
  }
  return TONOS_PERSONA[hash % TONOS_PERSONA.length] ?? "azul";
}

export type TramoDescuento = "baja" | "media" | "alta";

/** Hasta 10% es baja; de más de 10% a 20%, media; más de 20%, alta. */
export function tramoDescuento(bps: number): TramoDescuento {
  if (bps <= 1000) return "baja";
  if (bps <= 2000) return "media";
  return "alta";
}

/** `1000` → "10%", `1250` → "12.5%": sin decimales cuando sobran. */
export function formatearPorcentaje(bps: number): string {
  const porcentaje = bps / 100;
  return `${Number.isInteger(porcentaje) ? porcentaje : porcentaje.toFixed(1)}%`;
}

// Abreviaturas de Perú ("set", no "sep").
const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "set",
  "oct",
  "nov",
  "dic",
] as const;

/**
 * Fecha corta de la tarjeta de venta: `2026-08-18` → "18 ago", con el año
 * solo si no es el de hoy ("18 ago 2025"). "18/08/2026" empujaba la sede a
 * otra línea a 390px.
 */
export function fechaCortaVenta(fecha: string, hoy: string): string {
  const [anio, mes, dia] = fecha.split("-");
  const base = `${Number(dia)} ${MESES[Number(mes) - 1] ?? mes}`;
  return anio === hoy.slice(0, 4) ? base : `${base} ${anio}`;
}
