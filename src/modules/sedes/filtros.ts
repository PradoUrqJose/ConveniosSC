import {
  parametrosUrlCanonicos,
  textoUrl,
  uuidUrl,
  type ParametrosUrl,
} from "@/lib/url-parametros";

export type ParametrosSedes = {
  q?: string;
  empresaId?: string;
  activo?: boolean;
  cursor?: string;
};

function cursorSedes(valor: unknown): string | undefined {
  const candidato = textoUrl(valor, 512);
  if (!candidato) return undefined;
  try {
    const raw = JSON.parse(
      Buffer.from(candidato, "base64url").toString("utf8"),
    );
    return typeof raw.nombre === "string" && raw.nombre && uuidUrl(raw.id)
      ? candidato
      : undefined;
  } catch {
    return undefined;
  }
}

export function normalizarParametrosSedes(
  entrada: Record<string, unknown>,
): ParametrosSedes {
  return {
    q: textoUrl(entrada.q, 100),
    empresaId: uuidUrl(entrada.empresa),
    activo:
      entrada.estado === "activas"
        ? true
        : entrada.estado === "inactivas"
          ? false
          : undefined,
    cursor: cursorSedes(entrada.cursor),
  };
}

export function serializarParametrosSedes(
  entrada: Record<string, unknown>,
): URLSearchParams {
  const parametros = normalizarParametrosSedes(entrada);
  const salida = new URLSearchParams();
  if (parametros.q) salida.set("q", parametros.q);
  if (parametros.empresaId) salida.set("empresa", parametros.empresaId);
  if (parametros.activo === true) salida.set("estado", "activas");
  if (parametros.activo === false) salida.set("estado", "inactivas");
  if (parametros.cursor) salida.set("cursor", parametros.cursor);
  return salida;
}

export function urlSedesCanonica(entrada: ParametrosUrl): boolean {
  return parametrosUrlCanonicos(entrada, serializarParametrosSedes(entrada));
}
