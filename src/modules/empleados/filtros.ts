import {
  parametrosUrlCanonicos,
  textoUrl,
  uuidUrl,
  type ParametrosUrl,
} from "@/lib/url-parametros";
import type { EstadoEmpleado } from "./query";

const ESTADOS_POR_TAB = {
  pendientes: "PENDIENTE_VERIFICACION",
  activos: "ACTIVO",
  inactivos: "INACTIVO",
  rechazados: "RECHAZADO",
} as const satisfies Record<string, EstadoEmpleado>;

function cursorEmpleados(valor: unknown): string | undefined {
  const candidato = textoUrl(valor, 512);
  if (!candidato) return undefined;
  try {
    const raw = JSON.parse(
      Buffer.from(candidato, "base64url").toString("utf8"),
    );
    return typeof raw.apellidos === "string" &&
      typeof raw.nombres === "string" &&
      Boolean(raw.apellidos) &&
      Boolean(raw.nombres) &&
      Boolean(uuidUrl(raw.id))
      ? candidato
      : undefined;
  } catch {
    return undefined;
  }
}

export type ParametrosEmpleados = {
  tab: keyof typeof ESTADOS_POR_TAB | "todos";
  estado?: EstadoEmpleado;
  q?: string;
  cursor?: string;
};

/** Deserializa los parámetros de /empleados y traduce el tab a su estado. */
export function normalizarParametrosEmpleados(
  entrada: Record<string, unknown>,
): ParametrosEmpleados {
  const tab =
    typeof entrada.tab === "string" && entrada.tab in ESTADOS_POR_TAB
      ? (entrada.tab as keyof typeof ESTADOS_POR_TAB)
      : "todos";
  return {
    tab,
    estado: tab === "todos" ? undefined : ESTADOS_POR_TAB[tab],
    q: textoUrl(entrada.q, 100),
    cursor: cursorEmpleados(entrada.cursor),
  };
}

/** Serializa /empleados y omite el tab por defecto. */
export function serializarParametrosEmpleados(
  entrada: Record<string, unknown>,
): URLSearchParams {
  const parametros = normalizarParametrosEmpleados(entrada);
  const salida = new URLSearchParams();
  if (parametros.tab !== "todos") salida.set("tab", parametros.tab);
  if (parametros.q) salida.set("q", parametros.q);
  if (parametros.cursor) salida.set("cursor", parametros.cursor);
  return salida;
}

export function urlEmpleadosCanonica(entrada: ParametrosUrl): boolean {
  return parametrosUrlCanonicos(
    entrada,
    serializarParametrosEmpleados(entrada),
  );
}
