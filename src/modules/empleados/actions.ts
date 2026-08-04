"use server";

import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbTx } from "@/db";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { zDni, zNombre, zTelefono, zUuid } from "@/lib/zod";
import type { Resultado } from "@/lib/tipos";
import { detectarTipoReal, MIME_PERMITIDOS } from "@/lib/archivos";
import {
  actualizarEmpleadoCore,
  crearEmpleadoCore,
  rechazarEmpleadoCore,
  verificarEmpleadoCore,
  type DatosActualizarEmpleado,
  type DatosCrearEmpleado,
} from "./acciones";

const zFotoDni = z.object({
  fotoDniBlobPath: z.string().min(1),
  fotoDniSha256: z.string().regex(/^[a-f0-9]{64}$/),
  fotoDniMime: z.enum(MIME_PERMITIDOS),
  fotoDniSizeBytes: z.number().int().positive().max(10_485_760),
});

const zConsentimiento = z.preprocess(
  (v) => v === "on" || v === true,
  z.literal(true, {
    message: "Debes confirmar la autorización de datos",
  }),
);

const zCrearEmpleado = z.object({
  empresaId: zUuid,
  dni: zDni,
  nombres: zNombre,
  apellidos: zNombre,
  telefono: zTelefono,
  ...zFotoDni.shape,
  consentimiento: zConsentimiento,
});

const zActualizarEmpleado = z.object({
  empleadoId: zUuid,
  nombres: zNombre.optional(),
  apellidos: zNombre.optional(),
  telefono: zTelefono.nullable().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});

const zRechazarEmpleado = z.object({
  empleadoId: zUuid,
  motivo: z.string().trim().min(5).max(300),
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
    console.error("Error no controlado en action empleados", e);
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
 * Subida local de desarrollo (provisional): guarda el archivo en `public/uploads`
 * y devuelve el mismo contrato que producirá Vercel Blob en T11
 * (`POST /api/blob/upload`). Se reemplaza por `handleUpload` cuando exista el
 * token `BLOB_READ_WRITE_TOKEN`.
 *
 * Deshabilitada en producción: escribir a `public/uploads` sirve el archivo
 * como estático público sin control de acceso, cifrado ni TTL (a diferencia
 * de la URL firmada de `GET /api/adjuntos/[id]`). Si `upload()` al Blob falla
 * en prod, este fallback debe fallar también, no degradar silenciosamente la
 * seguridad de documentos sensibles (fotos de DNI).
 */
export async function subirArchivoLocal(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<
  Resultado<{
    blobPath: string;
    sha256: string;
    mime: string;
    sizeBytes: number;
  }>
> {
  return capturarErrores(async () => {
    await requireSession();
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "subirArchivoLocal: fallback de disco local deshabilitado en producción " +
          "(NODE_ENV=production). Revisa BLOB_READ_WRITE_TOKEN y la disponibilidad " +
          "de Vercel Blob en vez de permitir esta ruta.",
      );
    }
    const file = formData.get("archivo");
    if (!(file instanceof File)) {
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: "No se recibió archivo.",
      };
    }
    if (file.size < 1 || file.size > 10_485_760) {
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: "El archivo debe pesar entre 1 byte y 10 MB.",
        campo: "archivo",
      };
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const tipoReal = detectarTipoReal(buffer);
    if (
      !tipoReal ||
      !MIME_PERMITIDOS.includes(tipoReal as (typeof MIME_PERMITIDOS)[number])
    ) {
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje:
          "El contenido del archivo no corresponde a un formato permitido.",
        campo: "archivo",
      };
    }

    const ext = extensionDe(tipoReal);
    const nombre = `${randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, nombre), buffer);

    const sha256 = createHash("sha256").update(buffer).digest("hex");

    return {
      ok: true,
      data: {
        blobPath: `/uploads/${nombre}`,
        sha256,
        mime: tipoReal,
        sizeBytes: file.size,
      },
    };
  });
}

function extensionDe(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "jpg";
  }
}

export async function crearEmpleado(
  _estadoAnterior: Resultado<{ empleadoId: string; estado: string }>,
  formData: FormData,
): Promise<Resultado<{ empleadoId: string; estado: string }>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA", "VENDEDOR"]);

    const parse = zCrearEmpleado.safeParse({
      empresaId: formData.get("empresaId"),
      dni: formData.get("dni"),
      nombres: formData.get("nombres"),
      apellidos: formData.get("apellidos"),
      telefono: formData.get("telefono") || undefined,
      fotoDniBlobPath: formData.get("fotoDniBlobPath"),
      fotoDniSha256: formData.get("fotoDniSha256"),
      fotoDniMime: formData.get("fotoDniMime"),
      fotoDniSizeBytes: Number(formData.get("fotoDniSizeBytes")),
      consentimiento: formData.get("consentimiento"),
    });
    if (!parse.success) {
      return campoInvalido(parse);
    }
    const d = parse.data;
    const entrada: DatosCrearEmpleado = {
      empresaId: d.empresaId,
      dni: d.dni,
      nombres: d.nombres,
      apellidos: d.apellidos,
      telefono: d.telefono ?? null,
      fotoDni: {
        blobPath: d.fotoDniBlobPath,
        sha256: d.fotoDniSha256,
        mime: d.fotoDniMime,
        sizeBytes: d.fotoDniSizeBytes,
      },
      consentimiento: true,
    };

    const res = await dbTx().transaction((tx) =>
      crearEmpleadoCore(tx, ctx, entrada),
    );
    if (!res.ok) {
      return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
    }

    revalidatePath("/empleados");
    return {
      ok: true,
      data: { empleadoId: res.empleadoId, estado: res.estado },
    };
  });
}

export async function actualizarEmpleado(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

    const parse = zActualizarEmpleado.safeParse({
      empleadoId: formData.get("empleadoId"),
      nombres: formData.get("nombres") || undefined,
      apellidos: formData.get("apellidos") || undefined,
      telefono:
        formData.get("telefono") === null
          ? undefined
          : String(formData.get("telefono")) || null,
      estado: formData.get("estado") || undefined,
    });
    if (!parse.success) {
      return campoInvalido(parse);
    }
    const d = parse.data;
    const entrada: DatosActualizarEmpleado = {
      empleadoId: d.empleadoId,
      nombres: d.nombres,
      apellidos: d.apellidos,
      telefono: d.telefono,
      estado: d.estado,
    };

    const res = await dbTx().transaction((tx) =>
      actualizarEmpleadoCore(tx, ctx, entrada),
    );
    if (!res.ok) {
      return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
    }

    revalidatePath("/empleados");
    return { ok: true, data: {} };
  });
}

export async function verificarEmpleado(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

    const parse = z.object({ empleadoId: zUuid }).safeParse({
      empleadoId: formData.get("empleadoId"),
    });
    if (!parse.success) {
      return campoInvalido(parse);
    }

    const res = await dbTx().transaction((tx) =>
      verificarEmpleadoCore(tx, ctx, parse.data.empleadoId),
    );
    if (!res.ok) {
      return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
    }

    revalidatePath("/empleados");
    return { ok: true, data: {} };
  });
}

export async function rechazarEmpleado(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

    const parse = zRechazarEmpleado.safeParse({
      empleadoId: formData.get("empleadoId"),
      motivo: formData.get("motivo"),
    });
    if (!parse.success) {
      return campoInvalido(parse);
    }

    const res = await dbTx().transaction((tx) =>
      rechazarEmpleadoCore(tx, ctx, {
        empleadoId: parse.data.empleadoId,
        motivo: parse.data.motivo,
      }),
    );
    if (!res.ok) {
      return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
    }

    revalidatePath("/empleados");
    return { ok: true, data: {} };
  });
}
