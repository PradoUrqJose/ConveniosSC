import { parsearSoles } from "@/lib/dinero";
import {
  parametrosUrlCanonicos,
  rangoFechasUrl,
  textoUrl,
  uuidUrl,
  type ParametrosUrl,
} from "@/lib/url-parametros";

import type {
  DireccionVentas,
  EstadoVenta,
  FiltrosVentas,
  OrdenVentas,
  ResumenVentas,
} from "./query";

/** Parámetros serializables que representan una vista compartible de Ventas. */
export type SearchParamsVentas = {
  q?: string;
  desde?: string;
  hasta?: string;
  empresa?: string;
  estado?: string;
  vendedor?: string;
  sede?: string;
  montoMin?: string;
  montoMax?: string;
  revision?: string;
  dir?: string;
  orden?: string;
  cursor?: string;
  antes?: string;
};

const CLAVES = [
  "q",
  "desde",
  "hasta",
  "empresa",
  "estado",
  "vendedor",
  "sede",
  "montoMin",
  "montoMax",
  "revision",
  "dir",
  "orden",
  "cursor",
  "antes",
] as const;

const ORDENES: readonly OrdenVentas[] = [
  "fecha_desc",
  "fecha_asc",
  "monto_desc",
  "monto_asc",
];

function monto(valor: unknown): string | undefined {
  const candidato = textoUrl(valor, 20);
  if (!candidato) return undefined;
  try {
    parsearSoles(candidato);
    return candidato;
  } catch {
    return undefined;
  }
}

/**
 * Convierte una entrada posiblemente manipulada en una vista segura y
 * canónica. Los IDs válidos pero ajenos al alcance se dejan pasar al query:
 * la consulta vuelve a aplicar el alcance por rol y no puede exponer datos.
 */
export function normalizarParametrosVentas(
  entrada: Record<string, unknown>,
): SearchParamsVentas {
  const direccion: DireccionVentas | undefined =
    entrada.dir === "compradas" ? "compradas" : undefined;
  const estado: EstadoVenta | "TODAS" | undefined =
    entrada.estado === "ANULADA" ||
    entrada.estado === "TODAS" ||
    entrada.estado === "REGISTRADA"
      ? (entrada.estado as EstadoVenta | "TODAS")
      : undefined;
  const orden: OrdenVentas | undefined = ORDENES.includes(
    entrada.orden as OrdenVentas,
  )
    ? (entrada.orden as OrdenVentas)
    : undefined;
  const fechas = rangoFechasUrl(entrada.desde, entrada.hasta);
  const montoMin = monto(entrada.montoMin);
  const montoMax = monto(entrada.montoMax);
  const montosValidos =
    montoMin && montoMax && parsearSoles(montoMin) > parsearSoles(montoMax)
      ? {}
      : { montoMin, montoMax };
  const cursor = cursorVenta(entrada.cursor, orden ?? "fecha_desc");
  const antes = historialVenta(entrada.antes, orden ?? "fecha_desc");

  return {
    q: textoUrl(entrada.q, 100),
    desde: fechas.desde,
    hasta: fechas.hasta,
    empresa: uuidUrl(entrada.empresa),
    estado,
    vendedor: direccion === "compradas" ? undefined : uuidUrl(entrada.vendedor),
    sede: direccion === "compradas" ? undefined : uuidUrl(entrada.sede),
    montoMin: montosValidos.montoMin,
    montoMax: montosValidos.montoMax,
    revision: entrada.revision === "1" ? "1" : undefined,
    dir: direccion,
    orden,
    cursor,
    antes,
  };
}

function cursorVenta(valor: unknown, orden: OrdenVentas): string | undefined {
  const candidato = textoUrl(valor, 512);
  if (!candidato) return undefined;
  try {
    const raw = JSON.parse(
      Buffer.from(candidato, "base64url").toString("utf8"),
    );
    if (typeof raw.v !== "string" || !uuidUrl(raw.id)) return undefined;
    if (orden.startsWith("fecha")) {
      return rangoFechasUrl(raw.v, raw.v).desde ? candidato : undefined;
    }
    return Number.isSafeInteger(Number(raw.v)) ? candidato : undefined;
  } catch {
    return undefined;
  }
}

function historialVenta(
  valor: unknown,
  orden: OrdenVentas,
): string | undefined {
  const candidato = textoUrl(valor, 4096);
  if (!candidato) return undefined;
  const partes = candidato.split(",");
  return partes.length <= 100 &&
    partes.every((parte) => parte === "-" || cursorVenta(parte, orden))
    ? candidato
    : undefined;
}

/** Serializa la vista de Ventas en su representación canónica de URL. */
export function serializarParametrosVentas(
  entrada: Record<string, unknown>,
): URLSearchParams {
  const parametros = normalizarParametrosVentas(entrada);
  const salida = new URLSearchParams();
  for (const clave of CLAVES) {
    const valor = parametros[clave];
    if (valor) salida.set(clave, valor);
  }
  return salida;
}

export function urlVentasCanonica(entrada: ParametrosUrl): boolean {
  return parametrosUrlCanonicos(entrada, serializarParametrosVentas(entrada));
}

/** Convierte `URLSearchParams` en un objeto que puede viajar a una action. */
export function parametrosDesdeUrl(
  parametros: URLSearchParams,
): SearchParamsVentas {
  const entrada: SearchParamsVentas = {};
  for (const clave of CLAVES) {
    const valor = parametros.get(clave);
    if (valor !== null) entrada[clave] = valor;
  }
  return normalizarParametrosVentas(entrada);
}

/** Convierte un payload de Server Action en parámetros sin confiar en su tipo. */
export function parametrosDesdeEntrada(entrada: unknown): SearchParamsVentas {
  if (entrada === null || typeof entrada !== "object") return {};
  const objeto = entrada as Record<string, unknown>;
  const parametros: SearchParamsVentas = {};
  for (const clave of CLAVES) {
    if (typeof objeto[clave] === "string") {
      parametros[clave] = objeto[clave] as string;
    }
  }
  return normalizarParametrosVentas(parametros);
}

/**
 * Compara los filtros que definen un conjunto de resultados. El cursor y la
 * pila `antes` son navegación, por lo que no forman parte del resumen.
 */
export function mismoConjuntoVentas(
  izquierda: SearchParamsVentas,
  derecha: SearchParamsVentas,
): boolean {
  const a = normalizarParametrosVentas(izquierda);
  const b = normalizarParametrosVentas(derecha);
  return (
    a.q === b.q &&
    a.desde === b.desde &&
    a.hasta === b.hasta &&
    a.empresa === b.empresa &&
    a.estado === b.estado &&
    a.vendedor === b.vendedor &&
    a.sede === b.sede &&
    a.montoMin === b.montoMin &&
    a.montoMax === b.montoMax &&
    a.revision === b.revision &&
    a.dir === b.dir &&
    a.orden === b.orden
  );
}

function centimosDe(valor: string | undefined): number | undefined {
  if (!valor) return undefined;
  try {
    return parsearSoles(valor);
  } catch {
    return undefined;
  }
}

/**
 * Traduce la URL al contrato de queries. `esAdmin` controla los filtros que
 * sólo existen para el administrador; el query vuelve a reforzar el alcance.
 */
export function filtrosDesdeParametros(
  parametros: SearchParamsVentas,
  esAdmin: boolean,
  resumenReutilizado?: ResumenVentas,
): FiltrosVentas {
  const sp = normalizarParametrosVentas(parametros);
  const direccion: DireccionVentas =
    sp.dir === "compradas" ? "compradas" : "vendidas";
  const estado: EstadoVenta | "TODAS" =
    sp.estado === "ANULADA" || sp.estado === "TODAS" ? sp.estado : "REGISTRADA";
  const orden: OrdenVentas = ORDENES.includes(sp.orden as OrdenVentas)
    ? (sp.orden as OrdenVentas)
    : "fecha_desc";
  const permiteVendedorSede = esAdmin && direccion === "vendidas";

  return {
    desde: sp.desde,
    hasta: sp.hasta,
    empresaId: sp.empresa,
    estado,
    q: sp.q,
    vendedorId: permiteVendedorSede ? sp.vendedor : undefined,
    sedeId: permiteVendedorSede ? sp.sede : undefined,
    montoMinCentimos: centimosDe(sp.montoMin),
    montoMaxCentimos: centimosDe(sp.montoMax),
    soloRevision: esAdmin ? sp.revision === "1" : undefined,
    direccion,
    orden,
    cursor: sp.cursor,
    resumenReutilizado,
  };
}
