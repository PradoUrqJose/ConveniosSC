import { createHash, randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";

import { rolUsuario } from "@/db/schema";
import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { obtenerFilas } from "@/lib/audit/registrar";

export type RolUsuario = (typeof rolUsuario.enumValues)[number];

export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";

const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días (02 §6)
const REFRESH_ULTIMO_USO_MS = 15 * 60 * 1000; // refrescar como máximo cada 15 min

/**
 * Sesión opaca (01-MODELO-DATOS.md §8): la cookie guarda un token aleatorio de
 * 32 bytes en base64url; la BD guarda solo su SHA-256 en hex.
 */
export function generarTokenSesion(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTokenSesion(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Crea la sesión dentro de la transacción recibida (mismo patrón que `registrar`). */
export async function crearSesion(
  tx: TransaccionAuditada,
  entrada: {
    token: string;
    usuarioId: string;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO sesiones (token_hash, usuario_id, expires_at, ip, user_agent)
    VALUES (${hashTokenSesion(entrada.token)}, ${entrada.usuarioId},
            ${new Date(Date.now() + DURACION_SESION_MS).toISOString()},
            ${entrada.ip}, ${entrada.userAgent})
  `);
}

export async function revocarSesion(
  tx: TransaccionAuditada,
  token: string,
): Promise<void> {
  await tx.execute(sql`
    UPDATE sesiones SET revocada_at = now()
    WHERE token_hash = ${hashTokenSesion(token)} AND revocada_at IS NULL
  `);
}

export async function revocarSesionesDeUsuario(
  tx: TransaccionAuditada,
  usuarioId: string,
): Promise<void> {
  await tx.execute(sql`
    UPDATE sesiones SET revocada_at = now()
    WHERE usuario_id = ${usuarioId} AND revocada_at IS NULL
  `);
}

export type SesionValida = {
  sesionId: string;
  usuarioId: string;
  empresaId: string | null;
  rol: RolUsuario;
  debeCambiarPassword: boolean;
  nombres: string;
  apellidos: string;
  empresaNombre: string | null;
  sedePorDefectoId: string | null;
};

/**
 * Sesión válida ⇔ `revocada_at IS NULL AND expires_at > now() AND usuario.activo`
 * y, si el usuario pertenece a una empresa, esta debe estar `activo` (03 §2:
 * desactivar una empresa bloquea el login de todos sus usuarios). Devuelve
 * `null` si el token no corresponde a una sesión válida.
 */
export async function obtenerSesionValida(
  ejecutor: TransaccionAuditada,
  token: string,
): Promise<SesionValida | null> {
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT s.id, s.usuario_id, u.rol, u.empresa_id, u.debe_cambiar_password,
             u.nombres, u.apellidos, u.sede_por_defecto_id,
             e.nombre_comercial
      FROM sesiones s
      JOIN usuarios u ON u.id = s.usuario_id
      LEFT JOIN empresas e ON e.id = u.empresa_id
      WHERE s.token_hash = ${hashTokenSesion(token)}
        AND s.revocada_at IS NULL
        AND s.expires_at > now()
        AND u.activo
        AND (u.empresa_id IS NULL OR e.activo)
    `),
  );
  const fila = filas[0];
  if (!fila) {
    return null;
  }
  return {
    sesionId: String(fila.id),
    usuarioId: String(fila.usuario_id),
    empresaId: fila.empresa_id === null ? null : String(fila.empresa_id),
    rol: fila.rol as RolUsuario,
    debeCambiarPassword: Boolean(fila.debe_cambiar_password),
    nombres: String(fila.nombres ?? ""),
    apellidos: String(fila.apellidos ?? ""),
    empresaNombre:
      fila.nombre_comercial === null || fila.nombre_comercial === undefined
        ? null
        : String(fila.nombre_comercial),
    sedePorDefectoId:
      fila.sede_por_defecto_id === null ||
      fila.sede_por_defecto_id === undefined
        ? null
        : String(fila.sede_por_defecto_id),
  };
}

/** Refresca `ultimo_uso_at` como máximo cada 15 min (comprobación atómica en SQL). */
export async function refrescarUltimoUso(
  ejecutor: TransaccionAuditada,
  sesionId: string,
): Promise<void> {
  await ejecutor.execute(sql`
    UPDATE sesiones SET ultimo_uso_at = now()
    WHERE id = ${sesionId}
      AND ultimo_uso_at < now() - make_interval(secs => ${
        REFRESH_ULTIMO_USO_MS / 1000
      })
  `);
}
