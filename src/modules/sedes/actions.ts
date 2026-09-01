"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbTx } from "@/db";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { zCheckbox, zUuid } from "@/lib/zod";
import type { Resultado } from "@/lib/tipos";
import {
  actualizarSedeCore,
  crearSedeCore,
  type DatosActualizarSede,
  type DatosCrearSede,
} from "./acciones";
import { buscarEmpresasParaSedes } from "./query";

const zCrearSede = z.object({
  empresaId: zUuid,
  nombre: z.string().trim().min(2).max(80),
  direccion: z.string().trim().max(200).optional(),
});

const zActualizarSede = z.object({
  sedeId: zUuid,
  nombre: z.string().trim().min(2).max(80),
  direccion: z.string().trim().max(200).optional(),
  activo: zCheckbox,
});

const zBusqueda = z.string().trim().max(100).catch("");

/** Búsqueda diferida para el filtro de empresa de /sedes. */
export async function buscarEmpresasFiltroSedes(q: string) {
  const ctx = await requireSession();
  return (await buscarEmpresasParaSedes(ctx, zBusqueda.parse(q))).map(
    (empresa) => ({ id: empresa.id, etiqueta: empresa.nombreComercial }),
  );
}

async function capturarErrores<T>(
  fn: () => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorAuth) {
      return { ok: false, codigo: e.codigo, mensaje: e.message };
    }
    console.error("Error no controlado en action sedes", e);
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

export async function crearSede(
  _estadoAnterior: Resultado<{ sedeId: string }>,
  formData: FormData,
): Promise<Resultado<{ sedeId: string }>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

    const parse = zCrearSede.safeParse({
      empresaId: formData.get("empresaId"),
      nombre: formData.get("nombre"),
      direccion: formData.get("direccion") || undefined,
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
    const entrada: DatosCrearSede = {
      empresaId: datos.empresaId,
      nombre: datos.nombre,
      direccion: datos.direccion,
    };

    let sedeId: string;
    try {
      sedeId = await dbTx().transaction((tx) =>
        crearSedeCore(tx, ctx, entrada),
      );
    } catch (e) {
      if (esConflicto(e)) {
        return {
          ok: false,
          codigo: "CONFLICTO",
          mensaje: "Ya existe una sede con ese nombre en la empresa.",
          campo: "nombre",
        };
      }
      throw e;
    }

    revalidatePath("/sedes");
    return { ok: true, data: { sedeId } };
  });
}

export async function actualizarSede(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

    const parse = zActualizarSede.safeParse({
      sedeId: formData.get("sedeId"),
      nombre: formData.get("nombre"),
      direccion: formData.get("direccion") || undefined,
      activo: formData.get("activo"),
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
    const entrada: DatosActualizarSede = {
      sedeId: datos.sedeId,
      nombre: datos.nombre,
      direccion: datos.direccion,
      activo: datos.activo,
    };

    try {
      const res = await dbTx().transaction((tx) =>
        actualizarSedeCore(tx, ctx, entrada),
      );
      if (!res.ok) {
        return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
      }
    } catch (e) {
      if (esConflicto(e)) {
        return {
          ok: false,
          codigo: "CONFLICTO",
          mensaje: "Ya existe una sede con ese nombre en la empresa.",
          campo: "nombre",
        };
      }
      throw e;
    }

    revalidatePath("/sedes");
    return { ok: true, data: {} };
  });
}
