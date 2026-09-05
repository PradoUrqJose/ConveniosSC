export const ESQUEMA_RUM = "convenios.rum.v1";
export const ROLES_RUM = ["VENDEDOR", "ADMIN_EMPRESA", "SUPERADMIN"] as const;
export const NOMBRES_METRICA_RUM = [
  "TTFB",
  "FCP",
  "LCP",
  "INP",
  "CLS",
  "shell",
  "datos",
  "rsc",
  "js",
  "api",
  "adjunto",
  "framesPerdidos",
] as const;

export type RolRum = (typeof ROLES_RUM)[number];
export type NombreMetricaRum = (typeof NOMBRES_METRICA_RUM)[number];

export type EventoRum = {
  esquema: typeof ESQUEMA_RUM;
  ruta: string;
  rol: RolRum;
  metrica: NombreMetricaRum;
  valor: number;
  navegacion: "fria" | "caliente";
  dispositivo: "movil" | "escritorio";
};

/** No se conservan query strings ni identificadores de recursos en RUM. */
export function normalizarRutaRum(ruta: string): string | null {
  if (!ruta.startsWith("/") || ruta.length > 120 || ruta.includes("?")) {
    return null;
  }
  const normalizada = ruta
    .replace(/\/[0-9]+(?=\/|$)/g, "/:id")
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, "/:id");
  return /^[a-zA-Z0-9/_:-]+$/.test(normalizada) ? normalizada : null;
}

export function esEventoRum(valor: unknown): valor is EventoRum {
  if (!valor || typeof valor !== "object") return false;
  const evento = valor as Record<string, unknown>;
  return (
    evento.esquema === ESQUEMA_RUM &&
    typeof evento.ruta === "string" &&
    normalizarRutaRum(evento.ruta) === evento.ruta &&
    typeof evento.rol === "string" &&
    ROLES_RUM.includes(evento.rol as RolRum) &&
    typeof evento.metrica === "string" &&
    NOMBRES_METRICA_RUM.includes(evento.metrica as NombreMetricaRum) &&
    typeof evento.valor === "number" &&
    Number.isFinite(evento.valor) &&
    evento.valor >= 0 &&
    evento.valor <= 120_000 &&
    (evento.navegacion === "fria" || evento.navegacion === "caliente") &&
    (evento.dispositivo === "movil" || evento.dispositivo === "escritorio")
  );
}

export function porcentajeMuestreo(valor: string | undefined): number {
  const numero = Number(valor ?? "0.1");
  return Number.isFinite(numero) ? Math.min(1, Math.max(0, numero)) : 0.1;
}
