import { createHash } from "node:crypto";

export type Datos = Record<string, unknown> | null;

const CAMPOS_SENSIBLES = new Set([
  "password",
  "password_hash",
  "passwordHash",
  "contrasena",
  "token",
  "token_hash",
  "tokenHash",
  "session_token",
  "sessionToken",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
]);

export const REDACTADO = "[REDACTADO]";

/**
 * Reemplaza el valor de cualquier campo sensible (password_hash, tokens) por
 * "[REDACTADO]", recursivamente (01 §11: "Nunca se escribe en datos_*").
 */
export function redactar(valor: Datos | undefined): Datos {
  if (valor === null || valor === undefined) return null;
  return redactarNodo(valor) as Datos;
}

function redactarNodo(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(redactarNodo);
  }
  if (valor !== null && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [clave, valorHijo] of Object.entries(
      valor as Record<string, unknown>,
    )) {
      salida[clave] = CAMPOS_SENSIBLES.has(clave)
        ? REDACTADO
        : redactarNodo(valorHijo);
    }
    return salida;
  }
  return valor;
}

/**
 * Serializa cualquier valor a JSON determinista: claves ordenadas
 * alfabéticamente en todos los niveles (01 §11 capa 3).
 */
export function canonicalizar(valor: unknown): string {
  return JSON.stringify(valor, ordenaClaves);
}

function ordenaClaves(_clave: string, valor: unknown): unknown {
  if (valor instanceof Date) return valor;
  if (valor !== null && typeof valor === "object" && !Array.isArray(valor)) {
    return Object.keys(valor as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, clave) => {
        acc[clave] = (valor as Record<string, unknown>)[clave];
        return acc;
      }, {});
  }
  return valor;
}

/** sha256 en hex. */
export function sha256Hex(entrada: string): string {
  return createHash("sha256").update(entrada).digest("hex");
}

/** hash = sha256( prev_hash_o_cadena_vacia || '|' || json_canonico ) */
export function calcularHash(prevHash: string | null, canon: string): string {
  return sha256Hex(`${prevHash ?? ""}|${canon}`);
}
