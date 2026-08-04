import { hash, verify } from "@node-rs/argon2";

/**
 * Parámetros de argon2id definidos en 02-LOGICA-NEGOCIO.md §6:
 * memoryCost 19456 (19 MiB), timeCost 2, parallelism 1, outputLen 32.
 */
export const PARAMETROS_ARGON2 = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, PARAMETROS_ARGON2);
}

/**
 * Verifica una contraseña contra su hash argon2id. Devuelve `false` si el hash
 * almacenado no es un hash válido (nunca lanza).
 */
export async function verificarPassword(
  hashAlmacenado: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(hashAlmacenado, plain);
  } catch {
    return false;
  }
}
