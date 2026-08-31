import { hoyLima, sumarDias } from "@/lib/fechas";
import {
  parametrosUrlCanonicos,
  rangoFechasUrl,
  type ParametrosUrl,
} from "@/lib/url-parametros";

export type ParametrosDashboard = {
  desde: string;
  hasta: string;
  dir: "vendidas" | "compradas";
};

/** Deserializa /dashboard y completa su rango de 30 días seguro. */
export function normalizarParametrosDashboard(
  entrada: Record<string, unknown>,
  hoy = hoyLima(),
): ParametrosDashboard {
  const rango = rangoFechasUrl(entrada.desde, entrada.hasta);
  const hasta = rango.hasta ?? hoy;
  const desde = rango.desde ?? sumarDias(hasta, -29);
  if (desde > hasta) {
    return {
      desde: sumarDias(hoy, -29),
      hasta: hoy,
      dir: entrada.dir === "compradas" ? "compradas" : "vendidas",
    };
  }
  return {
    desde,
    hasta,
    dir: entrada.dir === "compradas" ? "compradas" : "vendidas",
  };
}

/** Serializa /dashboard en un único formato compartible. */
export function serializarParametrosDashboard(
  entrada: Record<string, unknown>,
  hoy = hoyLima(),
): URLSearchParams {
  const parametros = normalizarParametrosDashboard(entrada, hoy);
  return new URLSearchParams(parametros);
}

export function urlDashboardCanonica(
  entrada: ParametrosUrl,
  hoy = hoyLima(),
): boolean {
  return parametrosUrlCanonicos(
    entrada,
    serializarParametrosDashboard(entrada, hoy),
  );
}
