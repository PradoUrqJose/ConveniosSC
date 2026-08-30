import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import {
  drizzle as drizzleNeonServerless,
  type NeonDatabase,
} from "drizzle-orm/neon-serverless";

const url = process.env.DATABASE_URL;
const urlUnpooled = process.env.DATABASE_URL_UNPOOLED;

if (!url) {
  throw new Error("Falta DATABASE_URL en el entorno");
}

/** Conexión pooled HTTP: lecturas y escrituras independientes (neon-http). */
export const sql = neon(url);
export const db = drizzleNeonHttp(sql);

let txPool: Pool | null = null;
let dbTxInstance: NeonDatabase | null = null;

/**
 * Conexión directa (DATABASE_URL_UNPOOLED) con soporte de transacciones, que
 * el driver neon-http no tiene. Se crea bajo demanda y se reutiliza.
 *
 * Criterio de uso: llamar `dbTx()` únicamente si dos o más sentencias deben
 * confirmarse juntas, o si se requiere un advisory lock de transacción. Eso
 * cubre las mutaciones de dominio junto con su auditoría, los cambios de
 * sesión/contraseña y `registrar()` (lock + lectura del hash previo + insert).
 * Las lecturas, rate limits de una sola sentencia y callbacks que no requieren
 * esa atomicidad deben usar `db` para evitar el handshake WebSocket en frío.
 */
export function dbTx(): NeonDatabase {
  if (!urlUnpooled) {
    throw new Error("Falta DATABASE_URL_UNPOOLED en el entorno");
  }
  if (!txPool) {
    txPool = new Pool({ connectionString: urlUnpooled });
  }
  if (!dbTxInstance) {
    dbTxInstance = drizzleNeonServerless(txPool);
  }
  return dbTxInstance;
}
