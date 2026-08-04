/**
 * Helpers de fecha y hora para America/Lima (D28). Perú no aplica horario de verano, pero se
 * usa date-fns-tz igual para no depender de eso.
 *
 * Las fechas de negocio (`fecha_venta`, vigencias) son `DATE` y se manipulan como strings
 * `YYYY-MM-DD`, nunca como objetos `Date` — así no hay corrimientos por zona.
 */
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { differenceInMinutes } from "date-fns";

export const ZONA = "America/Lima";

const FORMATO_ISO = "yyyy-MM-dd";

/**
 * `YYYY-MM-DD` del día actual en Lima. Usar siempre esta, nunca
 * `new Date().toISOString().slice(0,10)`, que da el día en UTC y falla entre las 19:00 y 00:00.
 */
export function hoyLima(): string {
  return formatInTimeZone(new Date(), ZONA, FORMATO_ISO);
}

/** `TIMESTAMPTZ` (Date o ISO string) → `YYYY-MM-DD` en Lima. Para comparar contra `fecha_venta`. */
export function fechaLimaDe(marca: Date | string): string {
  return formatInTimeZone(marca, ZONA, FORMATO_ISO);
}

const FECHA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Valida que el string sea `YYYY-MM-DD` y represente una fecha calendario real. */
export function esFechaValida(fecha: string): boolean {
  if (!FECHA_ISO_REGEX.test(fecha)) return false;
  const [anioTexto, mesTexto, diaTexto] = fecha.split("-");
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const compuesta = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    compuesta.getUTCFullYear() === anio &&
    compuesta.getUTCMonth() === mes - 1 &&
    compuesta.getUTCDate() === dia
  );
}

/** -1 si a < b, 0 si son iguales, 1 si a > b. Compara strings `YYYY-MM-DD` lexicográficamente. */
export function compararFechas(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Suma (o resta, con `dias` negativo) días a una fecha `YYYY-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const [anioTexto, mesTexto, diaTexto] = fecha.split("-");
  const utc = new Date(
    Date.UTC(Number(anioTexto), Number(mesTexto) - 1, Number(diaTexto)),
  );
  utc.setUTCDate(utc.getUTCDate() + dias);
  return utc.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → `dd/mm/aaaa`, tal como se muestra en la UI (05 §7). */
export function formatearFechaUI(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** `TIMESTAMPTZ` (Date o ISO string) → `dd/mm/aaaa HH:mm`, formateado a Lima. */
export function formatearFechaHoraLima(marca: Date | string): string {
  return formatInTimeZone(marca, ZONA, "dd/MM/yyyy HH:mm");
}

/** `TIMESTAMPTZ` (Date o ISO string) → `HH:mm`, formateado a Lima. */
export function formatearHoraLima(marca: Date | string): string {
  return formatInTimeZone(marca, ZONA, "HH:mm");
}

/**
 * Fechas relativas solo para menos de 24 h: «hace 2 horas». Más allá, fecha absoluta
 * `dd/mm/aaaa HH:mm` (05 §7).
 */
export function fechaRelativa(
  marca: Date | string,
  ahora: Date = new Date(),
): string {
  const minutos = differenceInMinutes(ahora, toZonedTime(marca, ZONA), {
    roundingMethod: "floor",
  });

  if (minutos < 1) return "hace un momento";
  if (minutos < 60)
    return `hace ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;

  return formatearFechaHoraLima(marca);
}
