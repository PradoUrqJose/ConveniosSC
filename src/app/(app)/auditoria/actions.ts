"use server";
import { requireSession, requireRol } from "@/lib/auth/guardas";
import { verificarCadena } from "@/lib/audit/verificar";
import {
  listarAuditoria,
  obtenerDetalleAuditoria,
} from "@/modules/auditoria/query";
import { normalizarParametrosAuditoria } from "@/modules/auditoria/filtros";

const TAMANO_LOTE_VERIFICACION = 250;

export async function verificarIntegridad(desdeId?: number) {
  const sesion = await requireSession();
  requireRol(sesion, ["SUPERADMIN"]);
  if (
    desdeId !== undefined &&
    (!Number.isSafeInteger(desdeId) || desdeId < 1)
  ) {
    throw new Error("El cursor de verificación no es válido.");
  }
  return verificarCadena({ desdeId, limite: TAMANO_LOTE_VERIFICACION });
}

export async function cargarAuditoria(
  filtrosEntrada: Record<string, unknown>,
  cursor: string,
) {
  const sesion = await requireSession();
  requireRol(sesion, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  const filtros = normalizarParametrosAuditoria({
    ...filtrosEntrada,
    cursor,
  });
  return listarAuditoria(sesion, filtros);
}

export async function cargarDetalleAuditoria(id: number) {
  const sesion = await requireSession();
  requireRol(sesion, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error("El evento solicitado no es válido.");
  }
  return obtenerDetalleAuditoria(sesion, id);
}
