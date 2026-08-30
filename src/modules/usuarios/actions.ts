"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbTx } from "@/db";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { zNombre, zUsername, zUuid } from "@/lib/zod";
import type { Resultado } from "@/lib/tipos";
import type { RolUsuario } from "@/lib/auth/sesion";
import {
  actualizarUsuarioCore,
  crearUsuarioCore,
  desbloquearUsuarioCore,
  resetearPasswordCore,
  type DatosActualizarUsuario,
  type DatosCrearUsuario,
} from "./acciones";
import {
  listarEmpleadosOpciones,
  listarEmpresasOpciones,
  listarSedesOpciones,
} from "./query";

export type OpcionBuscada = { id: string; etiqueta: string };

const zBusqueda = z.string().trim().max(100).catch("");

function normalizarBusqueda(q: string): string {
  return zBusqueda.parse(q);
}

export async function buscarEmpresasOpciones(
  q: string,
): Promise<OpcionBuscada[]> {
  const ctx = await requireSession();
  return (await listarEmpresasOpciones(ctx, { q: normalizarBusqueda(q) })).map(
    (e) => ({
      id: e.id,
      etiqueta: e.nombreComercial,
    }),
  );
}

export async function buscarEmpleadosOpciones(
  q: string,
  empresaId?: string,
): Promise<OpcionBuscada[]> {
  const ctx = await requireSession();
  return (
    await listarEmpleadosOpciones(ctx, {
      q: normalizarBusqueda(q),
      empresaId,
    })
  ).map((e) => ({
    id: e.id,
    etiqueta: `${e.apellidos}, ${e.nombres} (${e.tipoDocumento === "DNI" ? "DNI" : "CE"} ${e.numeroDocumento})`,
  }));
}

export async function buscarSedesOpciones(
  q: string,
  empresaId?: string,
): Promise<OpcionBuscada[]> {
  const ctx = await requireSession();
  return (
    await listarSedesOpciones(ctx, {
      q: normalizarBusqueda(q),
      empresaId,
    })
  ).map((s) => ({
    id: s.id,
    etiqueta: s.nombre,
  }));
}

const zRol = z.enum(["SUPERADMIN", "ADMIN_EMPRESA", "VENDEDOR"]);

const zCrearUsuario = z.object({
  empresaId: zUuid.nullable(),
  username: zUsername,
  nombres: zNombre,
  apellidos: zNombre,
  rol: zRol,
  empleadoId: zUuid.nullable(),
  sedePorDefectoId: zUuid.nullable(),
});

const zActualizarUsuario = z.object({
  usuarioId: zUuid,
  nombres: zNombre.optional(),
  apellidos: zNombre.optional(),
  rol: zRol.optional(),
  empleadoId: zUuid.nullable().optional(),
  sedePorDefectoId: zUuid.nullable().optional(),
  activo: z.boolean().optional(),
});

const zResetearPassword = z.object({ usuarioId: zUuid });
const zDesbloquearUsuario = z.object({ usuarioId: zUuid });

async function capturarErrores<T>(
  fn: () => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorAuth) {
      return { ok: false, codigo: e.codigo, mensaje: e.message };
    }
    console.error("Error no controlado en action usuarios", e);
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

function uuidNulo(v: FormDataEntryValue | null): string | null {
  if (v === null) {
    return null;
  }
  const s = String(v);
  return s === "" ? null : s;
}

export async function crearUsuario(
  _estadoAnterior: Resultado<{ usuarioId: string; passwordTemporal: string }>,
  formData: FormData,
): Promise<Resultado<{ usuarioId: string; passwordTemporal: string }>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN"]);

    const parse = zCrearUsuario.safeParse({
      empresaId: uuidNulo(formData.get("empresaId")),
      username: formData.get("username"),
      nombres: formData.get("nombres"),
      apellidos: formData.get("apellidos"),
      rol: formData.get("rol"),
      empleadoId: uuidNulo(formData.get("empleadoId")),
      sedePorDefectoId: uuidNulo(formData.get("sedePorDefectoId")),
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
    const entrada: DatosCrearUsuario = {
      empresaId: d.empresaId,
      username: d.username,
      nombres: d.nombres,
      apellidos: d.apellidos,
      rol: d.rol,
      empleadoId: d.empleadoId,
      sedePorDefectoId: d.sedePorDefectoId,
    };

    let res;
    try {
      res = await dbTx().transaction((tx) =>
        crearUsuarioCore(tx, ctx, entrada),
      );
    } catch (e) {
      if (esConflicto(e)) {
        return {
          ok: false,
          codigo: "CONFLICTO",
          mensaje: "Ese username ya está en uso.",
          campo: "username",
        };
      }
      throw e;
    }
    if (!res.ok) {
      return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
    }

    revalidatePath("/usuarios");
    return {
      ok: true,
      data: {
        usuarioId: res.usuarioId,
        passwordTemporal: res.passwordTemporal!,
      },
    };
  });
}

export async function actualizarUsuario(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN"]);

    const parse = zActualizarUsuario.safeParse({
      usuarioId: formData.get("usuarioId"),
      nombres: formData.get("nombres") || undefined,
      apellidos: formData.get("apellidos") || undefined,
      rol: formData.get("rol") || undefined,
      empleadoId:
        formData.get("empleadoId") === null
          ? undefined
          : uuidNulo(formData.get("empleadoId")),
      sedePorDefectoId:
        formData.get("sedePorDefectoId") === null
          ? undefined
          : uuidNulo(formData.get("sedePorDefectoId")),
      activo:
        formData.get("activo") === null
          ? undefined
          : formData.get("activo") === "on",
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
    const entrada: DatosActualizarUsuario = {
      usuarioId: d.usuarioId,
      nombres: d.nombres,
      apellidos: d.apellidos,
      rol: d.rol as RolUsuario | undefined,
      empleadoId: d.empleadoId,
      sedePorDefectoId: d.sedePorDefectoId,
      activo: d.activo,
    };

    const res = await dbTx().transaction((tx) =>
      actualizarUsuarioCore(tx, ctx, entrada),
    );
    if (!res.ok) {
      return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
    }

    revalidatePath("/usuarios");
    return { ok: true, data: {} };
  });
}

export async function desbloquearUsuario(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN"]);

    const parse = zDesbloquearUsuario.safeParse({
      usuarioId: formData.get("usuarioId"),
    });
    if (!parse.success) {
      return { ok: false, codigo: "VALIDACION", mensaje: "Datos inválidos" };
    }

    const res = await dbTx().transaction((tx) =>
      desbloquearUsuarioCore(tx, ctx, parse.data.usuarioId),
    );
    if (!res.ok) {
      return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
    }

    revalidatePath("/usuarios");
    return { ok: true, data: {} };
  });
}

export async function resetearPassword(
  _estadoAnterior: Resultado<{ passwordTemporal: string }>,
  formData: FormData,
): Promise<Resultado<{ passwordTemporal: string }>> {
  return capturarErrores(async () => {
    const ctx = await requireSession();
    requireRol(ctx, ["SUPERADMIN"]);

    const parse = zResetearPassword.safeParse({
      usuarioId: formData.get("usuarioId"),
    });
    if (!parse.success) {
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: "Datos inválidos",
      };
    }

    const res = await dbTx().transaction((tx) =>
      resetearPasswordCore(tx, ctx, parse.data.usuarioId),
    );
    if (!res.ok) {
      return { ok: false, codigo: res.codigo, mensaje: res.mensaje };
    }

    revalidatePath("/usuarios");
    return { ok: true, data: { passwordTemporal: res.passwordTemporal! } };
  });
}
