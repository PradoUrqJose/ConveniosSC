import { ZONA } from "@/lib/fechas";

const HORA_LIMA = new Intl.DateTimeFormat("es-PE", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: ZONA,
});

/**
 * Saludo del hero móvil según la hora de Lima — la de la operación, no la
 * del servidor (que en Vercel corre en UTC).
 */
export function saludoPorHora(momento: Date = new Date()): string {
  const hora = Number(HORA_LIMA.format(momento));
  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 19) return "Buenas tardes";
  return "Buenas noches";
}
