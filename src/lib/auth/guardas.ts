import { randomUUID } from "node:crypto";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { cache } from "react";

import { db } from "@/db";

import {
  obtenerSesionValida,
  refrescarUltimoUso,
  SESSION_COOKIE_NAME,
  type RolUsuario,
} from "./sesion";

/**
 * Contexto de sesión (01-MODELO-DATOS.md §13). Toda query de `queries.ts`
 * recibe un `SessionContext` como primer parámetro.
 */
export type SessionContext = {
  usuarioId: string;
  empresaId: string | null; // null solo para SUPERADMIN
  rol: RolUsuario;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
};

export type CodigoErrorAuth = "NO_AUTENTICADO" | "SIN_PERMISO";

export class ErrorAuth extends Error {
  readonly codigo: CodigoErrorAuth;

  constructor(codigo: CodigoErrorAuth, mensaje: string) {
    super(mensaje);
    this.name = "ErrorAuth";
    this.codigo = codigo;
  }
}

/** `requireSession` + `debe_cambiar_password` (el shell lo usa para decidir layout). */
export type SesionRequerida = SessionContext & { debeCambiarPassword: boolean };

/** 401 si no hay cookie o la sesión no es válida (02 §3: guarda explícita). */
export const requireSession = cache(async (): Promise<SesionRequerida> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    throw new ErrorAuth("NO_AUTENTICADO", "No hay sesión activa.");
  }

  const sesion = await obtenerSesionValida(db, token);
  if (!sesion) {
    throw new ErrorAuth("NO_AUTENTICADO", "La sesión no es válida.");
  }

  // No es necesario retrasar la navegación para actualizar un dato auxiliar.
  // `after` mantiene la actualización, pero la respuesta sale de inmediato.
  after(() => refrescarUltimoUso(db, sesion.sesionId));

  const hdrs = await headers();
  return {
    usuarioId: sesion.usuarioId,
    empresaId: sesion.empresaId,
    rol: sesion.rol,
    requestId: randomUUID(),
    ip: obtenerIp(hdrs),
    userAgent: hdrs.get("user-agent") ?? null,
    debeCambiarPassword: sesion.debeCambiarPassword,
  };
});

/** 403 si el rol del contexto no está entre los permitidos. */
export function requireRol(ctx: SessionContext, roles: RolUsuario[]): void {
  if (!roles.includes(ctx.rol)) {
    throw new ErrorAuth(
      "SIN_PERMISO",
      "No tienes permiso para realizar esta acción.",
    );
  }
}

/**
 * 403 si el recurso es de otra empresa. `SUPERADMIN` (empresaId nulo) pasa
 * siempre: opera sobre todo el sistema.
 */
export function requireMismaEmpresa(
  ctx: SessionContext,
  empresaId: string | null,
): void {
  if (ctx.rol === "SUPERADMIN") {
    return;
  }
  if (empresaId === null || ctx.empresaId !== empresaId) {
    throw new ErrorAuth("SIN_PERMISO", "El recurso pertenece a otra empresa.");
  }
}

export function obtenerIp(hdrs: Headers): string | null {
  const fwd = hdrs.get("x-forwarded-for");
  if (fwd) {
    const primera = fwd.split(",")[0];
    if (primera) {
      return primera.trim();
    }
  }
  return hdrs.get("x-real-ip");
}
