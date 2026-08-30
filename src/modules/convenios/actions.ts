"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbTx } from "@/db";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { compararFechas, hoyLima } from "@/lib/fechas";
import { zCheckbox, zFecha, zUuid } from "@/lib/zod";
import type { Resultado } from "@/lib/tipos";
import {
  actualizarConvenioCore,
  cambiarTerminoCore,
  crearConvenioCore,
  type DatosActualizarConvenio,
  type DatosCambiarTermino,
  type DatosCrearConvenio,
  type EstadoConvenio,
} from "./acciones";
import { listarEmpresasParaConvenio } from "./query";

const zBusqueda = z.string().trim().max(100).catch("");

export async function buscarEmpresasParaConvenio(q: string) {
  const ctx = await requireSession();
  return (await listarEmpresasParaConvenio(ctx, { q: zBusqueda.parse(q) })).map(
    (empresa) => ({
      id: empresa.id,
      etiqueta: empresa.nombreComercial,
    }),
  );
}

/** Porcentaje con hasta 2 decimales ("15", "12.5") → bps enteros (×100). */
const zPorcentajeBps = z
  .string()
  .regex(
    /^\d{1,3}([.,]\d{1,2})?$/,
    "Porcentaje inválido. Usa hasta 2 decimales",
  )
  .transform((s) => Math.round(Number(s.replace(",", ".")) * 100))
  .refine(
    (bps) => bps >= 0 && bps <= 10000,
    "El porcentaje debe estar entre 0 y 100",
  );

const zFechaNoPasada = zFecha.refine(
  (f) => compararFechas(f, hoyLima()) >= 0,
  "La fecha no puede ser anterior a hoy",
);

const zEstadoConvenio = z.enum([
  "BORRADOR",
  "VIGENTE",
  "SUSPENDIDO",
  "TERMINADO",
]);

const zCrearConvenio = z
  .object({
    empresaXId: zUuid,
    empresaYId: zUuid,
    vigenciaDesde: zFecha,
    vigenciaHasta: zFecha.nullable(),
    notas: z.string().trim().max(1000).optional(),
    descuentoXotorga: zPorcentajeBps,
    descuentoYotorga: zPorcentajeBps,
    activarInmediatamente: zCheckbox,
  })
  .refine((d) => d.empresaXId !== d.empresaYId, {
    path: ["empresaYId"],
    message: "Elige dos empresas distintas.",
  });

const zActualizarConvenio = z.object({
  convenioId: zUuid,
  estado: zEstadoConvenio.optional(),
  vigenciaHasta: zFecha.nullable().optional(),
  notas: z.string().trim().max(1000).optional(),
});

const zCambiarTermino = z.object({
  convenioId: zUuid,
  empresaOtorganteId: zUuid,
  nuevoDescuento: zPorcentajeBps,
  vigenteDesde: zFechaNoPasada,
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
    console.error("Error no controlado en action convenios", e);
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

export async function crearConvenio(
  _estadoAnterior: Resultado<{ convenioId: string }>,
  formData: FormData,
): Promise<Resultado<{ convenioId: string }>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN"]);

    const parse = zCrearConvenio.safeParse({
      empresaXId: formData.get("empresaXId"),
      empresaYId: formData.get("empresaYId"),
      vigenciaDesde: formData.get("vigenciaDesde"),
      vigenciaHasta: formData.get("vigenciaHasta") || null,
      notas: formData.get("notas") || undefined,
      descuentoXotorga: formData.get("descuentoXotorga"),
      descuentoYotorga: formData.get("descuentoYotorga"),
      activarInmediatamente: formData.get("activarInmediatamente"),
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
    const d = parse.data;
    const entrada: DatosCrearConvenio = {
      empresaXId: d.empresaXId,
      empresaYId: d.empresaYId,
      vigenciaDesde: d.vigenciaDesde,
      vigenciaHasta: d.vigenciaHasta,
      notas: d.notas,
      descuentoXotorgaBps: d.descuentoXotorga,
      descuentoYotorgaBps: d.descuentoYotorga,
      activarInmediatamente: d.activarInmediatamente,
    };

    let convenioId: string;
    try {
      convenioId = await dbTx().transaction((tx) =>
        crearConvenioCore(tx, ctx, entrada),
      );
    } catch (e) {
      if (esConflicto(e)) {
        return {
          ok: false,
          codigo: "CONFLICTO",
          mensaje:
            "Ya existe un convenio entre esas empresas. Edítalo en la lista.",
          enlace: "/admin/convenios",
        };
      }
      throw e;
    }

    revalidatePath("/admin/convenios");
    return { ok: true, data: { convenioId } };
  });
}

export async function actualizarConvenio(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN"]);

    const vigenciaHastaRaw = formData.get("vigenciaHasta");
    const estadoRaw = formData.get("estado");
    const notasRaw = formData.get("notas");

    const parse = zActualizarConvenio.safeParse({
      convenioId: formData.get("convenioId"),
      estado: estadoRaw === null ? undefined : estadoRaw || undefined,
      vigenciaHasta:
        vigenciaHastaRaw === null
          ? undefined
          : vigenciaHastaRaw === ""
            ? null
            : vigenciaHastaRaw,
      notas: notasRaw === null ? undefined : notasRaw || undefined,
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
    const d = parse.data;
    const entrada: DatosActualizarConvenio = {
      convenioId: d.convenioId,
      estado: d.estado as EstadoConvenio | undefined,
      vigenciaHasta: d.vigenciaHasta,
      notas: d.notas,
    };

    const res = await dbTx().transaction((tx) =>
      actualizarConvenioCore(tx, ctx, entrada),
    );
    if (!res.ok) {
      return {
        ok: false,
        codigo: "NO_ENCONTRADO",
        mensaje: "El convenio no existe.",
      };
    }

    revalidatePath("/admin/convenios");
    return { ok: true, data: {} };
  });
}

export async function cambiarTermino(
  _estadoAnterior: Resultado<{ terminoId: string }>,
  formData: FormData,
): Promise<Resultado<{ terminoId: string }>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN"]);

    const parse = zCambiarTermino.safeParse({
      convenioId: formData.get("convenioId"),
      empresaOtorganteId: formData.get("empresaOtorganteId"),
      nuevoDescuento: formData.get("nuevoDescuento"),
      vigenteDesde: formData.get("vigenteDesde"),
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
    const d = parse.data;
    const entrada: DatosCambiarTermino = {
      convenioId: d.convenioId,
      empresaOtorganteId: d.empresaOtorganteId,
      nuevoDescuentoBps: d.nuevoDescuento,
      vigenteDesde: d.vigenteDesde,
    };

    try {
      const res = await dbTx().transaction((tx) =>
        cambiarTerminoCore(tx, ctx, entrada),
      );
      if (!res.ok) {
        return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
      }
      revalidatePath("/admin/convenios");
      return { ok: true, data: { terminoId: res.terminoId! } };
    } catch (e) {
      if (esConflicto(e)) {
        return {
          ok: false,
          codigo: "REGLA_NEGOCIO",
          mensaje: "La fecha elegida se solapa con otro término del convenio.",
        };
      }
      throw e;
    }
  });
}
