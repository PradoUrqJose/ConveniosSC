"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { db, dbTx } from "@/db";
import { obtenerFilas, registrar } from "@/lib/audit/registrar";
import { ErrorAuth, obtenerIp, requireSession } from "@/lib/auth/guardas";
import { autenticar } from "@/lib/auth/login";
import { hashPassword, verificarPassword } from "@/lib/auth/password";
import {
  obtenerSesionValida,
  revocarSesion,
  SESSION_COOKIE_NAME,
  type RolUsuario,
} from "@/lib/auth/sesion";
import type { Resultado } from "@/lib/tipos";
import { zPassword, zUsername } from "@/lib/zod";

const MAX_EDAD_COOKIE = 30 * 24 * 60 * 60; // 30 días, en segundos

const zLogin = z.object({
  username: zUsername,
  password: z.string().min(1),
});

const zCambiarPassword = z
  .object({
    actual: z.string().min(1),
    nueva: zPassword,
    confirmacion: z.string(),
  })
  .refine((v) => v.nueva === v.confirmacion, {
    message: "Las contraseñas no coinciden",
    path: ["confirmacion"],
  });

/** Convierte los errores de las guardas en `Resultado` (las actions nunca lanzan al cliente). */
async function capturarErrores<T>(
  fn: () => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorAuth) {
      return { ok: false, codigo: e.codigo, mensaje: e.message };
    }
    console.error("Error no controlado en action auth", e);
    return {
      ok: false,
      codigo: "ERROR_INTERNO",
      mensaje: "Ocurrió un error inesperado.",
    };
  }
}

export async function iniciarSesion(
  _estadoAnterior: Resultado<{ debeCambiarPassword: boolean; rol: RolUsuario }>,
  formData: FormData,
): Promise<Resultado<{ debeCambiarPassword: boolean; rol: RolUsuario }>> {
  return capturarErrores(async () => {
    const parse = zLogin.safeParse({
      username: formData.get("username"),
      password: formData.get("password"),
    });
    if (!parse.success) {
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: "Usuario o contraseña incorrectos",
      };
    }

    const hdrs = await headers();
    const ip = obtenerIp(hdrs);
    const userAgent = hdrs.get("user-agent") ?? null;

    const res = await autenticar(dbTx(), {
      username: parse.data.username,
      password: parse.data.password,
      ip,
      userAgent,
    });

    if (!res.ok) {
      if (res.codigo === "LIMITE_EXCEDIDO") {
        return {
          ok: false,
          codigo: "LIMITE_EXCEDIDO",
          mensaje: "Demasiados intentos. Inténtalo más tarde.",
        };
      }
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: "Usuario o contraseña incorrectos",
      };
    }

    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, res.sesion.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_EDAD_COOKIE,
    });

    return {
      ok: true,
      data: {
        debeCambiarPassword: res.sesion.debeCambiarPassword,
        rol: res.sesion.rol,
      },
    };
  });
}

export async function cerrarSesion(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const hdrs = await headers();

  try {
    await requireSession();
    if (token) {
      const sesion = await obtenerSesionValida(db, token);
      if (sesion) {
        await dbTx().transaction(async (tx) => {
          await revocarSesion(tx, token);
          await registrar(tx, {
            accion: "LOGOUT",
            entidad: "sesion",
            entidadId: sesion.sesionId,
            actor: {
              usuarioId: sesion.usuarioId,
              empresaId: sesion.empresaId,
              rol: sesion.rol,
            },
            ip: obtenerIp(hdrs),
            userAgent: hdrs.get("user-agent") ?? null,
          });
        });
      }
    }
  } catch {
    // Sesión ya inválida o inexistente: igual se limpia la cookie.
  }

  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

export async function cambiarPassword(
  _estadoAnterior: Resultado<Record<string, never>>,
  formData: FormData,
): Promise<Resultado<Record<string, never>>> {
  const redirigirAlInicio = formData.get("redirigirAlInicio") === "on";
  const resultado = await capturarErrores(async () => {
    const ctx = await requireSession();

    const parse = zCambiarPassword.safeParse({
      actual: formData.get("actual"),
      nueva: formData.get("nueva"),
      confirmacion: formData.get("confirmacion"),
    });
    if (!parse.success) {
      const problema = parse.error.issues[0];
      const campo =
        typeof problema?.path[0] === "string" ? problema.path[0] : undefined;
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: problema?.message ?? "Datos inválidos",
        campo,
      };
    }

    const { actual, nueva } = parse.data;
    if (nueva === actual) {
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: "La nueva contraseña debe ser distinta de la actual",
        campo: "nueva",
      };
    }

    const filas = obtenerFilas(
      await db.execute(
        sql`SELECT password_hash FROM usuarios WHERE id = ${ctx.usuarioId}`,
      ),
    );
    const hashActual = filas[0]?.password_hash;
    if (hashActual === null || hashActual === undefined) {
      return {
        ok: false,
        codigo: "ERROR_INTERNO",
        mensaje: "No se encontró el usuario.",
      };
    }

    const coincide = await verificarPassword(String(hashActual), actual);
    if (!coincide) {
      return {
        ok: false,
        codigo: "VALIDACION",
        mensaje: "La contraseña actual es incorrecta",
        campo: "actual",
      };
    }

    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value ?? null;
    const sesionId = token
      ? ((await obtenerSesionValida(db, token))?.sesionId ?? null)
      : null;

    const nuevoHash = await hashPassword(nueva);
    await dbTx().transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE usuarios SET password_hash = ${nuevoHash}, debe_cambiar_password = false
        WHERE id = ${ctx.usuarioId}
      `);
      if (sesionId) {
        await tx.execute(sql`
          UPDATE sesiones SET revocada_at = now()
          WHERE usuario_id = ${ctx.usuarioId}
            AND id <> ${sesionId}
            AND revocada_at IS NULL
        `);
      } else {
        await tx.execute(sql`
          UPDATE sesiones SET revocada_at = now()
          WHERE usuario_id = ${ctx.usuarioId}
            AND revocada_at IS NULL
        `);
      }
      await registrar(tx, {
        accion: "PASSWORD_CAMBIADA",
        entidad: "usuario",
        entidadId: ctx.usuarioId,
        actor: {
          usuarioId: ctx.usuarioId,
          empresaId: ctx.empresaId,
          rol: ctx.rol,
        },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/perfil/password");
    revalidatePath("/");
    return { ok: true, data: {} };
  });
  if (resultado.ok && redirigirAlInicio) {
    redirect("/");
  }
  return resultado;
}
