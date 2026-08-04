import { sql } from "drizzle-orm";
import { cache } from "react";

import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { obtenerFilas } from "@/lib/audit/registrar";

export type PerfilNav = {
  nombres: string;
  apellidos: string;
  empresaNombre: string | null;
  sedePorDefectoId: string | null;
};

/** Datos del usuario que muestra el header del shell (04-UI §0). */
export const cargarPerfilNav = cache(async function cargarPerfilNav(
  ejecutor: TransaccionAuditada,
  usuarioId: string,
): Promise<PerfilNav> {
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT u.nombres, u.apellidos, u.sede_por_defecto_id, e.nombre_comercial
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      WHERE u.id = ${usuarioId}
    `),
  );
  const fila = filas[0];
  return {
    nombres: String(fila?.nombres ?? ""),
    apellidos: String(fila?.apellidos ?? ""),
    empresaNombre:
      fila?.nombre_comercial === null || fila?.nombre_comercial === undefined
        ? null
        : String(fila.nombre_comercial),
    sedePorDefectoId:
      fila?.sede_por_defecto_id === null ||
      fila?.sede_por_defecto_id === undefined
        ? null
        : String(fila.sede_por_defecto_id),
  };
});

export type PerfilCompleto = {
  nombres: string;
  apellidos: string;
  username: string;
  email: string | null;
  empresaNombre: string | null;
  empresaRazonSocial: string | null;
  sedeNombre: string | null;
  ultimoAccesoAt: string | null;
  createdAt: string | null;
  debeCambiarPassword: boolean;
};

/** Datos de la pantalla `/perfil`. Solo lee del propio usuario de la sesión. */
export async function cargarPerfilCompleto(
  ejecutor: TransaccionAuditada,
  usuarioId: string,
): Promise<PerfilCompleto | null> {
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT u.nombres, u.apellidos, u.username, u.email,
             u.ultimo_acceso_at, u.created_at, u.debe_cambiar_password,
             e.nombre_comercial, e.razon_social, s.nombre AS sede_nombre
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      LEFT JOIN sedes s ON s.id = u.sede_por_defecto_id
      WHERE u.id = ${usuarioId}
    `),
  );
  const f = filas[0];
  if (!f) {
    return null;
  }
  const texto = (v: unknown): string | null =>
    v === null || v === undefined ? null : String(v);
  return {
    nombres: String(f.nombres ?? ""),
    apellidos: String(f.apellidos ?? ""),
    username: String(f.username ?? ""),
    email: texto(f.email),
    empresaNombre: texto(f.nombre_comercial),
    empresaRazonSocial: texto(f.razon_social),
    sedeNombre: texto(f.sede_nombre),
    ultimoAccesoAt: texto(f.ultimo_acceso_at),
    createdAt: texto(f.created_at),
    debeCambiarPassword: Boolean(f.debe_cambiar_password),
  };
}

/** Empleados `PENDIENTE_VERIFICACION` de la empresa; alimenta el badge del menú. */
export async function contarPendientesVerificacion(
  ejecutor: TransaccionAuditada,
  empresaId: string,
): Promise<number> {
  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      SELECT count(*)::int AS n
      FROM empleados
      WHERE empresa_id = ${empresaId}
        AND estado = 'PENDIENTE_VERIFICACION'
    `),
  );
  return Number(filas[0]?.n ?? 0);
}
