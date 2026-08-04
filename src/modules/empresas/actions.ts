"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbTx } from "@/db";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { zCheckbox, zMontoSoles, zRuc, zUuid } from "@/lib/zod";
import type { Resultado } from "@/lib/tipos";
import {
  actualizarEmpresaCore,
  crearEmpresaCore,
  type DatosActualizarEmpresa,
  type DatosCrearEmpresa,
} from "./acciones";

const zCrearEmpresa = z.object({
  ruc: zRuc,
  razonSocial: z.string().trim().min(3).max(200),
  nombreComercial: z.string().trim().min(2).max(100),
  topeMontoVenta: zMontoSoles,
  requiereEvidenciaEnVenta: zCheckbox,
  diasRetroactivosVenta: z.coerce.number().int().min(0).max(30).default(7),
});

const zActualizarEmpresa = z.object({
  empresaId: zUuid,
  razonSocial: z.string().trim().min(3).max(200).optional(),
  nombreComercial: z.string().trim().min(2).max(100).optional(),
  topeMontoVenta: zMontoSoles.optional(),
  requiereEvidenciaEnVenta: zCheckbox.optional(),
  diasRetroactivosVenta: z.coerce.number().int().min(0).max(30).optional(),
  activo: zCheckbox.optional(),
});

async function capturarErrores<T>(
  fn: () => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorAuth) {
      return { ok: false, codigo: e.codigo, mensaje: e.message };
    }
    console.error("Error no controlado en action empresas", e);
    return {
      ok: false,
      codigo: "ERROR_INTERNO",
      mensaje: "Ocurrió un error inesperado.",
    };
  }
}

function esConflicto(e: unknown): boolean {
  return (e as { code?: string }).code === "23505";
}

export async function crearEmpresa(
  _estadoAnterior: Resultado<{ empresaId: string }>,
  formData: FormData,
): Promise<Resultado<{ empresaId: string }>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN"]);

    const parse = zCrearEmpresa.safeParse({
      ruc: formData.get("ruc"),
      razonSocial: formData.get("razonSocial"),
      nombreComercial: formData.get("nombreComercial"),
      topeMontoVenta: formData.get("topeMontoVenta") ?? "50000",
      requiereEvidenciaEnVenta: formData.get("requiereEvidenciaEnVenta"),
      diasRetroactivosVenta: formData.get("diasRetroactivosVenta") ?? 7,
    });
    if (!parse.success) {
      const problema = parse.error.issues[0];
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: problema?.message ?? "Datos inválidos",
        campo:
          typeof problema?.path[0] === "string" ? problema.path[0] : undefined,
      };
    }
    const datos = parse.data;
    const entrada: DatosCrearEmpresa = {
      ruc: datos.ruc,
      razonSocial: datos.razonSocial,
      nombreComercial: datos.nombreComercial,
      topeCentimos: datos.topeMontoVenta,
      requiereEvidencia: datos.requiereEvidenciaEnVenta,
      diasRetroactivos: datos.diasRetroactivosVenta,
    };

    let empresaId: string;
    try {
      empresaId = await dbTx().transaction((tx) =>
        crearEmpresaCore(tx, ctx, entrada),
      );
    } catch (e) {
      if (esConflicto(e)) {
        return {
          ok: false,
          codigo: "CONFLICTO",
          mensaje: "Ya existe una empresa con ese RUC.",
          campo: "ruc",
        };
      }
      throw e;
    }

    revalidatePath("/admin/empresas");
    return { ok: true, data: { empresaId } };
  });
}

export async function actualizarEmpresa(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN"]);

    const parse = zActualizarEmpresa.safeParse({
      empresaId: formData.get("empresaId"),
      razonSocial: formData.get("razonSocial") || undefined,
      nombreComercial: formData.get("nombreComercial") || undefined,
      topeMontoVenta: formData.get("topeMontoVenta") || undefined,
      requiereEvidenciaEnVenta:
        formData.get("requiereEvidenciaEnVenta") === null
          ? undefined
          : formData.get("requiereEvidenciaEnVenta"),
      diasRetroactivosVenta: formData.get("diasRetroactivosVenta") || undefined,
      activo:
        formData.get("activo") === null ? undefined : formData.get("activo"),
    });
    if (!parse.success) {
      const problema = parse.error.issues[0];
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: problema?.message ?? "Datos inválidos",
        campo:
          typeof problema?.path[0] === "string" ? problema.path[0] : undefined,
      };
    }
    const { empresaId, ...campos } = parse.data;
    const entrada: DatosActualizarEmpresa = {
      empresaId,
      razonSocial: campos.razonSocial,
      nombreComercial: campos.nombreComercial,
      topeCentimos: campos.topeMontoVenta,
      requiereEvidencia: campos.requiereEvidenciaEnVenta,
      diasRetroactivos: campos.diasRetroactivosVenta,
      activo: campos.activo,
    };

    try {
      const res = await dbTx().transaction((tx) =>
        actualizarEmpresaCore(tx, ctx, entrada),
      );
      if (!res.ok) {
        return {
          ok: false,
          codigo: "NO_ENCONTRADO",
          mensaje: "La empresa no existe.",
        };
      }
    } catch (e) {
      if (esConflicto(e)) {
        return { ok: false, codigo: "CONFLICTO", mensaje: "Dato duplicado." };
      }
      throw e;
    }

    revalidatePath("/admin/empresas");
    return { ok: true, data: {} };
  });
}
