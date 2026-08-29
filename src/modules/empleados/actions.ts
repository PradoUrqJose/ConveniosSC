"use server";

import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbTx } from "@/db";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { zDocumentoIdentidad, zNombre, zTelefono, zUuid } from "@/lib/zod";
import type { Resultado } from "@/lib/tipos";
import {
  detectarTipoReal,
  MAX_BYTES_ARCHIVO,
  MIME_PERMITIDOS,
} from "@/lib/archivos";
import {
  actualizarEmpleadoCore,
  crearEmpleadoCore,
  rechazarEmpleadoCore,
  verificarEmpleadoCore,
  type DatosActualizarEmpleado,
  type DatosCrearEmpleado,
} from "./acciones";
import {
  buscarPorDocumento as buscarPorDocumentoQuery,
  type ResultadoBusquedaDocumento,
} from "./query";

const zConsentimiento = z.preprocess(
  (v) => v === "on" || v === true,
  z.literal(true, {
    message: "Debes confirmar la autorización de datos",
  }),
);

const zCrearEmpleado = z.intersection(
  z.object({
    empresaId: zUuid,
    nombres: zNombre,
    apellidos: zNombre,
    telefono: zTelefono,
    consentimiento: zConsentimiento,
  }),
  zDocumentoIdentidad,
);

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
 * seguridad de documentos sensibles.
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
    if (file.size < 1 || file.size > MAX_BYTES_ARCHIVO) {
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

/**
 * Envoltura `"use server"` de la búsqueda por documento. El formulario de
 * venta la llama únicamente cuando el usuario pulsa el botón de búsqueda.
 */
export async function buscarPorDocumento(
  tipoDocumento: "DNI" | "CARNET_EXTRANJERIA",
  numeroDocumento: string,
): Promise<Resultado<ResultadoBusquedaDocumento>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA", "VENDEDOR"]);
    return buscarPorDocumentoQuery(ctx, { tipoDocumento, numeroDocumento });
  });
}

export async function crearEmpleado(
  _estadoAnterior: Resultado<{ empleadoId: string; estado: string }>,
  formData: FormData,
): Promise<Resultado<{ empleadoId: string; estado: string }>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);

    const parse = zCrearEmpleado.safeParse({
      empresaId: formData.get("empresaId"),
      tipoDocumento: formData.get("tipoDocumento"),
      numeroDocumento: formData.get("numeroDocumento"),
      nombres: formData.get("nombres"),
      apellidos: formData.get("apellidos"),
      telefono: formData.get("telefono") || undefined,
      consentimiento: formData.get("consentimiento"),
    });
    if (!parse.success) {
      return campoInvalido(parse);
    }
    const d = parse.data;
    const entrada: DatosCrearEmpleado = {
      empresaId: d.empresaId,
      tipoDocumento: d.tipoDocumento,
      numeroDocumento: d.numeroDocumento,
      nombres: d.nombres,
      apellidos: d.apellidos,
      telefono: d.telefono ?? null,
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
