"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbTx } from "@/db";
import { MAX_BYTES_ARCHIVO, MIME_PERMITIDOS } from "@/lib/archivos";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { zFecha, zMontoSoles, zUuid } from "@/lib/zod";
import type { Resultado } from "@/lib/tipos";
import {
  anularVentaCore,
  crearVentaCore,
  type DatosCrearVenta,
  type VentaCreada,
} from "./acciones";
import {
  previsualizarDescuento as previsualizarDescuentoQuery,
  type PrevisualizacionDescuento,
} from "./query";

const zArchivo = z.object({
  blobPath: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  mime: z.enum(MIME_PERMITIDOS),
  sizeBytes: z.number().int().positive().max(MAX_BYTES_ARCHIVO),
});

const zEvidencia = zArchivo.extend({
  descripcion: z.string().trim().max(120).optional(),
});

const zEvidenciasJson = z
  .string()
  .optional()
  .transform((valor) => {
    if (!valor) return [];
    try {
      return JSON.parse(valor) as unknown;
    } catch {
      return null;
    }
  })
  .pipe(
    z.array(zEvidencia).max(5, "Puedes adjuntar como máximo 5 evidencias."),
  );

const zCrearVenta = z.object({
  ventaId: zUuid,
  empleadoCompradorId: zUuid,
  sedeId: zUuid,
  montoBruto: zMontoSoles,
  fechaVenta: zFecha,
  observacion: z.string().trim().max(500).optional(),
  documentoBlobPath: z.string().min(1, "Falta el documento de venta."),
  documentoSha256: z.string().regex(/^[a-f0-9]{64}$/),
  documentoMime: z.enum(MIME_PERMITIDOS),
  documentoSizeBytes: z.coerce.number().int().positive().max(MAX_BYTES_ARCHIVO),
  evidenciasJson: zEvidenciasJson,
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
    console.error("Error no controlado en action ventas", e);
    return {
      ok: false,
      codigo: "ERROR_INTERNO",
      mensaje: "Ocurrió un error inesperado.",
    };
  }
}

function campoInvalido<T extends { error: z.ZodError }>(
  res: T,
): Resultado<never> {
  const problema = res.error.issues[0];
  return {
    ok: false,
    codigo: "VALIDACION",
    mensaje: problema?.message ?? "Datos inválidos",
    campo: typeof problema?.path[0] === "string" ? problema.path[0] : undefined,
  };
}

/**
 * `crearVenta` (03 §7): valida y autoriza, arma `DatosCrearVenta` y delega el
 * algoritmo completo a `crearVentaCore` dentro de una única transacción.
 */
export async function crearVenta(
  _estadoAnterior: Resultado<VentaCreada>,
  formData: FormData,
): Promise<Resultado<VentaCreada>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["VENDEDOR", "ADMIN_EMPRESA"]);
    if (ctx.empresaId === null) {
      throw new ErrorAuth(
        "SIN_PERMISO",
        "Tu usuario no pertenece a una empresa.",
      );
    }

    const parse = zCrearVenta.safeParse({
      ventaId: formData.get("ventaId"),
      empleadoCompradorId: formData.get("empleadoCompradorId"),
      sedeId: formData.get("sedeId"),
      montoBruto: formData.get("montoBruto"),
      fechaVenta: formData.get("fechaVenta"),
      observacion: formData.get("observacion") || undefined,
      documentoBlobPath: formData.get("documentoBlobPath"),
      documentoSha256: formData.get("documentoSha256"),
      documentoMime: formData.get("documentoMime"),
      documentoSizeBytes: formData.get("documentoSizeBytes"),
      evidenciasJson: formData.get("evidenciasJson") || undefined,
    });
    if (!parse.success) {
      return campoInvalido(parse);
    }
    const d = parse.data;

    const entrada: DatosCrearVenta = {
      ventaId: d.ventaId,
      empleadoCompradorId: d.empleadoCompradorId,
      sedeId: d.sedeId,
      montoBrutoCentimos: d.montoBruto,
      fechaVenta: d.fechaVenta,
      observacion: d.observacion ?? null,
      documento: {
        blobPath: d.documentoBlobPath,
        sha256: d.documentoSha256,
        mime: d.documentoMime,
        sizeBytes: d.documentoSizeBytes,
      },
      evidencias: d.evidenciasJson.map((e) => ({
        blobPath: e.blobPath,
        sha256: e.sha256,
        mime: e.mime,
        sizeBytes: e.sizeBytes,
        descripcion: e.descripcion ?? null,
      })),
    };

    const ctxVenta = {
      usuarioId: ctx.usuarioId,
      empresaId: ctx.empresaId,
      rol: ctx.rol,
      requestId: ctx.requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    };

    const res = await dbTx().transaction((tx) =>
      crearVentaCore(tx, ctxVenta, entrada),
    );
    if (!res.ok) {
      return res;
    }

    revalidatePath("/ventas");
    revalidatePath("/");
    return res;
  });
}

const zPrevisualizar = z.object({
  empleadoCompradorId: zUuid,
  montoBruto: zMontoSoles,
  fechaVenta: zFecha,
});

/**
 * `previsualizarDescuento` (03 §7): solo cosmético, para el total de solo
 * lectura al cambiar la fecha a un día pasado. `crearVenta` recalcula todo.
 */
export async function previsualizarDescuento(entrada: {
  empleadoCompradorId: string;
  montoBruto: string;
  fechaVenta: string;
}): Promise<Resultado<PrevisualizacionDescuento>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["VENDEDOR", "ADMIN_EMPRESA"]);

    const parse = zPrevisualizar.safeParse(entrada);
    if (!parse.success) {
      return campoInvalido(parse);
    }

    return previsualizarDescuentoQuery(ctx, {
      empleadoCompradorId: parse.data.empleadoCompradorId,
      montoBrutoCentimos: parse.data.montoBruto,
      fechaVenta: parse.data.fechaVenta,
    });
  });
}

const zAnularVenta = z.object({
  ventaId: zUuid,
  motivo: z.string().trim().min(5).max(300),
});

/**
 * `anularVenta` (03 §7): reglas de quién puede anular y cuándo en
 * `anularVentaCore` (02 §9). Aquí solo se valida y autoriza el rol base.
 */
export async function anularVenta(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA", "VENDEDOR"]);

    const parse = zAnularVenta.safeParse({
      ventaId: formData.get("ventaId"),
      motivo: formData.get("motivo"),
    });
    if (!parse.success) {
      return campoInvalido(parse);
    }

    const res = await dbTx().transaction((tx) =>
      anularVentaCore(tx, ctx, parse.data),
    );
    if (!res.ok) {
      return res;
    }

    revalidatePath("/ventas");
    revalidatePath(`/ventas/${parse.data.ventaId}`);
    return res;
  });
}
