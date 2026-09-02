import {
  parametrosUrlCanonicos,
  textoUrl,
  uuidUrl,
  type ParametrosUrl,
} from "@/lib/url-parametros";
import type {
  ActividadEmpleados,
  EstadoEmpleado,
  OrdenEmpleados,
} from "./query";

const ESTADOS_POR_TAB = {
  pendientes: "PENDIENTE_VERIFICACION",
  activos: "ACTIVO",
  inactivos: "INACTIVO",
  rechazados: "RECHAZADO",
} as const satisfies Record<string, EstadoEmpleado>;

const ORDENES: readonly OrdenEmpleados[] = [
  "nombre_asc",
  "nombre_desc",
  "monto_desc",
  "reciente",
];

const ACTIVIDADES: readonly ActividadEmpleados[] = [
  "con_compras",
  "sin_compras",
];

/**
 * Marca, dentro de `antes`, la posición de la primera página (que no tiene
 * cursor propio). No puede ser "" porque `urlDe` (en el cliente) trata los
 * valores vacíos como "eliminar este parámetro" y `antes` perdería esa
 * entrada — mismo patrón que Ventas (`ventas/filtros.ts`).
 */
const CENTINELA_PRIMERA_PAGINA = "-";

/** El cursor codifica campos distintos según `orden`; solo es válido junto a él. */
function cursorEmpleados(
  valor: unknown,
  orden: OrdenEmpleados,
): string | undefined {
  const candidato = textoUrl(valor, 512);
  if (!candidato) return undefined;
  try {
    const raw = JSON.parse(
      Buffer.from(candidato, "base64url").toString("utf8"),
    );
    if (typeof raw.id !== "string" || !uuidUrl(raw.id)) return undefined;
    if (orden === "monto_desc") {
      return typeof raw.monto === "string" && Number.isFinite(Number(raw.monto))
        ? candidato
        : undefined;
    }
    if (orden === "reciente") {
      return typeof raw.creadoEn === "string" && raw.creadoEn
        ? candidato
        : undefined;
    }
    return typeof raw.apellidos === "string" &&
      typeof raw.nombres === "string" &&
      Boolean(raw.apellidos) &&
      Boolean(raw.nombres)
      ? candidato
      : undefined;
  } catch {
    return undefined;
  }
}

/** Pila de cursores visitados, para permitir "anterior" (03 §6, issue #41). */
function historialEmpleados(
  valor: unknown,
  orden: OrdenEmpleados,
): string | undefined {
  const candidato = textoUrl(valor, 4096);
  if (!candidato) return undefined;
  const partes = candidato.split(",");
  return partes.length <= 200 &&
    partes.every(
      (parte) =>
        parte === CENTINELA_PRIMERA_PAGINA || cursorEmpleados(parte, orden),
    )
    ? candidato
    : undefined;
}

export type ParametrosEmpleados = {
  tab: keyof typeof ESTADOS_POR_TAB | "todos";
  estado?: EstadoEmpleado;
  q?: string;
  orden: OrdenEmpleados;
  actividad?: ActividadEmpleados;
  cursor?: string;
  antes?: string;
};

/** Deserializa los parámetros de /empleados y traduce el tab a su estado. */
export function normalizarParametrosEmpleados(
  entrada: Record<string, unknown>,
): ParametrosEmpleados {
  const tab =
    typeof entrada.tab === "string" && entrada.tab in ESTADOS_POR_TAB
      ? (entrada.tab as keyof typeof ESTADOS_POR_TAB)
      : "todos";
  const orden: OrdenEmpleados = ORDENES.includes(
    entrada.orden as OrdenEmpleados,
  )
    ? (entrada.orden as OrdenEmpleados)
    : "nombre_asc";
  const actividad: ActividadEmpleados | undefined = ACTIVIDADES.includes(
    entrada.actividad as ActividadEmpleados,
  )
    ? (entrada.actividad as ActividadEmpleados)
    : undefined;
  return {
    tab,
    estado: tab === "todos" ? undefined : ESTADOS_POR_TAB[tab],
    q: textoUrl(entrada.q, 100),
    orden,
    actividad,
    cursor: cursorEmpleados(entrada.cursor, orden),
    antes: historialEmpleados(entrada.antes, orden),
  };
}

/** Serializa /empleados y omite los valores por defecto. */
export function serializarParametrosEmpleados(
  entrada: Record<string, unknown>,
): URLSearchParams {
  const parametros = normalizarParametrosEmpleados(entrada);
  const salida = new URLSearchParams();
  if (parametros.tab !== "todos") salida.set("tab", parametros.tab);
  if (parametros.q) salida.set("q", parametros.q);
  if (parametros.orden !== "nombre_asc") salida.set("orden", parametros.orden);
  if (parametros.actividad) salida.set("actividad", parametros.actividad);
  if (parametros.cursor) salida.set("cursor", parametros.cursor);
  if (parametros.antes) salida.set("antes", parametros.antes);
  return salida;
}

export function urlEmpleadosCanonica(entrada: ParametrosUrl): boolean {
  return parametrosUrlCanonicos(
    entrada,
    serializarParametrosEmpleados(entrada),
  );
}
