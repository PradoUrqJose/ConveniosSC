import { parsearSoles } from "@/lib/dinero";
import { zFecha, zUuid } from "@/lib/zod";

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

function texto(valor: unknown, maximo = 200): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpio = valor.trim();
  return limpio && limpio.length <= maximo ? limpio : undefined;
}

function uuid(valor: unknown): string | undefined {
  const candidato = texto(valor, 100);
  return candidato && zUuid.safeParse(candidato).success
    ? candidato
    : undefined;
}

function fecha(valor: unknown): string | undefined {
  const candidato = texto(valor, 10);
  if (!candidato || !zFecha.safeParse(candidato).success) return undefined;

  const fechaParseada = new Date(`${candidato}T00:00:00Z`);
  return Number.isNaN(fechaParseada.getTime()) ||
    fechaParseada.toISOString().slice(0, 10) !== candidato
    ? undefined
    : candidato;
}

function monto(valor: unknown): string | undefined {
  const candidato = texto(valor, 20);
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
  entrada: SearchParamsVentas,
): SearchParamsVentas {
  const direccion = entrada.dir === "compradas" ? "compradas" : undefined;
  const estado =
    entrada.estado === "ANULADA" ||
    entrada.estado === "TODAS" ||
    entrada.estado === "REGISTRADA"
      ? entrada.estado
      : undefined;
  const orden = ORDENES.includes(entrada.orden as OrdenVentas)
    ? entrada.orden
    : undefined;

  return {
    q: texto(entrada.q, 100),
    desde: fecha(entrada.desde),
    hasta: fecha(entrada.hasta),
    empresa: uuid(entrada.empresa),
    estado,
    vendedor: uuid(entrada.vendedor),
    sede: uuid(entrada.sede),
    montoMin: monto(entrada.montoMin),
    montoMax: monto(entrada.montoMax),
    revision: entrada.revision === "1" ? "1" : undefined,
    dir: direccion,
    orden,
    cursor: texto(entrada.cursor, 512),
    antes: texto(entrada.antes, 4096),
  };
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
