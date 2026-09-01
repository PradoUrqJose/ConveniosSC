import {
  parametrosUrlCanonicos,
  textoUrl,
  uuidUrl,
  type ParametrosUrl,
} from "@/lib/url-parametros";
import type { RolUsuario } from "@/lib/auth/sesion";

const ROLES: readonly RolUsuario[] = [
  "SUPERADMIN",
  "ADMIN_EMPRESA",
  "VENDEDOR",
];
const CENTINELA_PRIMERA_PAGINA = "-";

function cursorUsuarios(valor: unknown): string | undefined {
  const candidato = textoUrl(valor, 512);
  if (!candidato) return undefined;
  try {
    const raw = JSON.parse(
      Buffer.from(candidato, "base64url").toString("utf8"),
    );
    return typeof raw.username === "string" &&
      raw.username &&
      typeof raw.id === "string" &&
      uuidUrl(raw.id)
      ? candidato
      : undefined;
  } catch {
    return undefined;
  }
}

/** Cursores ya visitados para volver a la página anterior sin perder filtros. */
function historialUsuarios(valor: unknown): string | undefined {
  const candidato = textoUrl(valor, 4096);
  if (!candidato) return undefined;
  const partes = candidato.split(",");
  return partes.length <= 200 &&
    partes.every(
      (parte) => parte === CENTINELA_PRIMERA_PAGINA || cursorUsuarios(parte),
    )
    ? candidato
    : undefined;
}

export type ParametrosUsuarios = {
  q?: string;
  empresaId?: string;
  rol?: RolUsuario;
  activo?: boolean;
  cursor?: string;
  antes?: string;
};

export function normalizarParametrosUsuarios(
  entrada: Record<string, unknown>,
): ParametrosUsuarios {
  const rol = ROLES.includes(entrada.rol as RolUsuario)
    ? (entrada.rol as RolUsuario)
    : undefined;
  return {
    q: textoUrl(entrada.q, 100),
    empresaId: uuidUrl(entrada.empresa),
    rol,
    activo:
      entrada.estado === "activos"
        ? true
        : entrada.estado === "inactivos"
          ? false
          : undefined,
    cursor: cursorUsuarios(entrada.cursor),
    antes: historialUsuarios(entrada.antes),
  };
}

export function serializarParametrosUsuarios(
  entrada: Record<string, unknown>,
): URLSearchParams {
  const parametros = normalizarParametrosUsuarios(entrada);
  const salida = new URLSearchParams();
  if (parametros.q) salida.set("q", parametros.q);
  if (parametros.empresaId) salida.set("empresa", parametros.empresaId);
  if (parametros.rol) salida.set("rol", parametros.rol);
  if (parametros.activo === true) salida.set("estado", "activos");
  if (parametros.activo === false) salida.set("estado", "inactivos");
  if (parametros.cursor) salida.set("cursor", parametros.cursor);
  if (parametros.antes) salida.set("antes", parametros.antes);
  return salida;
}

export function urlUsuariosCanonica(entrada: ParametrosUrl): boolean {
  return parametrosUrlCanonicos(entrada, serializarParametrosUsuarios(entrada));
}
