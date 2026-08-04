import { sql } from "drizzle-orm";

import {
  obtenerFilas,
  registrar,
  type TransaccionAuditada,
} from "@/lib/audit/registrar";
import { ErrorAuth, type SessionContext } from "@/lib/auth/guardas";
import { hashPassword } from "@/lib/auth/password";
import { generarPasswordTemporal } from "@/lib/auth/password-temporal";
import { revocarSesionesDeUsuario } from "@/lib/auth/sesion";
import type { RolUsuario } from "@/lib/auth/sesion";

export type DatosCrearUsuario = {
  empresaId: string | null;
  username: string;
  nombres: string;
  apellidos: string;
  rol: RolUsuario;
  empleadoId?: string | null;
  sedePorDefectoId?: string | null;
};

export type DatosActualizarUsuario = {
  usuarioId: string;
  nombres?: string;
  apellidos?: string;
  rol?: RolUsuario;
  empleadoId?: string | null; // undefined = no cambiar
  sedePorDefectoId?: string | null; // undefined = no cambiar
  activo?: boolean;
};

export type ResultadoUsuario =
  | { ok: true; usuarioId: string; passwordTemporal?: string }
  | {
      ok: false;
      codigo: "NO_ENCONTRADO" | "REGLA_NEGOCIO";
      mensaje: string;
    };

/** Roles que un ADMIN_EMPRESA puede crear o asignar (nunca SUPERADMIN). */
const ROLES_ADMIN = ["VENDEDOR", "ADMIN_EMPRESA"] as const;

/**
 * Crea un usuario (03 §5). Aislamiento: un `ADMIN_EMPRESA` crea siempre en su
 * propia empresa (el `empresaId` recibido se ignora). Solo el `SUPERADMIN`
 * crea `SUPERADMIN`, y ese queda sin empresa. La contraseña temporal se
 * devuelve una sola vez; la BD guarda solo su hash argon2id.
 */
export async function crearUsuarioCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosCrearUsuario,
): Promise<ResultadoUsuario> {
  const empresaId = ctx.rol === "SUPERADMIN" ? datos.empresaId : ctx.empresaId;

  if (ctx.rol === "ADMIN_EMPRESA" && datos.rol === "SUPERADMIN") {
    return {
      ok: false,
      codigo: "REGLA_NEGOCIO",
      mensaje: "No puedes crear un SUPERADMIN.",
    };
  }
  if (datos.rol === "SUPERADMIN" && empresaId !== null) {
    return {
      ok: false,
      codigo: "REGLA_NEGOCIO",
      mensaje: "Un SUPERADMIN no pertenece a ninguna empresa.",
    };
  }
  if (datos.rol !== "SUPERADMIN" && empresaId === null) {
    return {
      ok: false,
      codigo: "REGLA_NEGOCIO",
      mensaje: "Elige la empresa del usuario.",
    };
  }

  if (datos.empleadoId) {
    const conflicto = await validarEmpleado(tx, datos.empleadoId, empresaId);
    if (conflicto) {
      return conflicto;
    }
  }
  if (datos.sedePorDefectoId) {
    const sede = obtenerFilas(
      await tx.execute(sql`
        SELECT 1 FROM sedes WHERE id = ${datos.sedePorDefectoId} AND empresa_id = ${empresaId}
      `),
    );
    if (sede.length === 0) {
      return {
        ok: false,
        codigo: "REGLA_NEGOCIO",
        mensaje: "La sede elegida no pertenece a la empresa del usuario.",
      };
    }
  }

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await hashPassword(passwordTemporal);

  const filas = obtenerFilas(
    await tx.execute(sql`
      INSERT INTO usuarios
        (empresa_id, username, password_hash, debe_cambiar_password, nombres,
         apellidos, rol, empleado_id, sede_por_defecto_id, creado_por_usuario_id)
      VALUES (${empresaId}, ${datos.username}, ${passwordHash}, true,
              ${datos.nombres}, ${datos.apellidos}, ${datos.rol},
              ${datos.empleadoId ?? null}, ${datos.sedePorDefectoId ?? null},
              ${ctx.usuarioId})
      RETURNING id
    `),
  );
  const usuarioId = String(filas[0]?.id);

  await registrar(tx, {
    accion: "USUARIO_CREADO",
    entidad: "usuario",
    entidadId: usuarioId,
    actor: ctx,
    datosDespues: {
      username: datos.username,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      rol: datos.rol,
      empresaId,
      empleadoId: datos.empleadoId ?? null,
      sedePorDefectoId: datos.sedePorDefectoId ?? null,
      debeCambiarPassword: true,
    },
  });

  return { ok: true, usuarioId, passwordTemporal };
}

/**
 * Actualiza un usuario. `username` inmutable; nadie cambia su propio rol ni se
 * desactiva a sí mismo; desactivar revoca las sesiones en la misma transacción.
 */
export async function actualizarUsuarioCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosActualizarUsuario,
): Promise<ResultadoUsuario> {
  const actual = obtenerFilas(
    await tx.execute(
      sql`SELECT * FROM usuarios WHERE id = ${datos.usuarioId} FOR UPDATE`,
    ),
  )[0];
  if (!actual) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "El usuario no existe.",
    };
  }
  const actualEmpresaId =
    actual.empresa_id === null ? null : String(actual.empresa_id);

  if (ctx.rol === "ADMIN_EMPRESA") {
    if (actualEmpresaId !== ctx.empresaId) {
      throw new ErrorAuth(
        "SIN_PERMISO",
        "El usuario pertenece a otra empresa.",
      );
    }
    if (
      datos.rol &&
      !ROLES_ADMIN.includes(datos.rol as (typeof ROLES_ADMIN)[number])
    ) {
      return {
        ok: false,
        codigo: "REGLA_NEGOCIO",
        mensaje: "No puedes asignar el rol SUPERADMIN.",
      };
    }
  }

  const esUnoMismo = ctx.usuarioId === datos.usuarioId;
  if (esUnoMismo) {
    if (datos.rol !== undefined && datos.rol !== String(actual.rol)) {
      return {
        ok: false,
        codigo: "REGLA_NEGOCIO",
        mensaje: "No puedes cambiar tu propio rol.",
      };
    }
    if (datos.activo === false) {
      return {
        ok: false,
        codigo: "REGLA_NEGOCIO",
        mensaje: "No puedes desactivar tu propio usuario.",
      };
    }
  }

  const rol = datos.rol ?? String(actual.rol);
  if (rol === "SUPERADMIN" && actualEmpresaId !== null) {
    return {
      ok: false,
      codigo: "REGLA_NEGOCIO",
      mensaje: "Un SUPERADMIN no pertenece a ninguna empresa.",
    };
  }

  if (datos.empleadoId !== undefined && datos.empleadoId !== null) {
    const conflicto = await validarEmpleado(
      tx,
      datos.empleadoId,
      actualEmpresaId,
    );
    if (conflicto) {
      return conflicto;
    }
  }
  if (datos.sedePorDefectoId !== undefined && datos.sedePorDefectoId !== null) {
    const sede = obtenerFilas(
      await tx.execute(sql`
        SELECT 1 FROM sedes WHERE id = ${datos.sedePorDefectoId} AND empresa_id = ${actualEmpresaId}
      `),
    );
    if (sede.length === 0) {
      return {
        ok: false,
        codigo: "REGLA_NEGOCIO",
        mensaje: "La sede elegida no pertenece a la empresa del usuario.",
      };
    }
  }

  const nombres = datos.nombres ?? String(actual.nombres);
  const apellidos = datos.apellidos ?? String(actual.apellidos);
  const activo = datos.activo ?? Boolean(actual.activo);
  const empleadoId =
    datos.empleadoId === undefined ? actual.empleado_id : datos.empleadoId;
  const sedePorDefectoId =
    datos.sedePorDefectoId === undefined
      ? actual.sede_por_defecto_id
      : datos.sedePorDefectoId;

  await tx.execute(sql`
    UPDATE usuarios SET
      nombres = ${nombres},
      apellidos = ${apellidos},
      rol = ${rol},
      empleado_id = ${empleadoId},
      sede_por_defecto_id = ${sedePorDefectoId},
      activo = ${activo}
    WHERE id = ${datos.usuarioId}
  `);

  const seDesactivo = !activo && Boolean(actual.activo);
  if (seDesactivo) {
    await revocarSesionesDeUsuario(tx, datos.usuarioId);
  }

  await registrar(tx, {
    accion: seDesactivo ? "USUARIO_DESACTIVADO" : "USUARIO_ACTUALIZADO",
    entidad: "usuario",
    entidadId: datos.usuarioId,
    actor: ctx,
    datosAntes: {
      nombres: String(actual.nombres),
      apellidos: String(actual.apellidos),
      rol: String(actual.rol),
      activo: Boolean(actual.activo),
    },
    datosDespues: { nombres, apellidos, rol, activo },
  });

  return { ok: true, usuarioId: datos.usuarioId };
}

/** Resetea la contraseña: nueva temporal, `debe_cambiar_password` y sesiones revocadas. */
export async function resetearPasswordCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  usuarioId: string,
): Promise<ResultadoUsuario> {
  const actual = obtenerFilas(
    await tx.execute(
      sql`SELECT * FROM usuarios WHERE id = ${usuarioId} FOR UPDATE`,
    ),
  )[0];
  if (!actual) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "El usuario no existe.",
    };
  }
  if (ctx.rol === "ADMIN_EMPRESA") {
    const actualEmpresaId =
      actual.empresa_id === null ? null : String(actual.empresa_id);
    if (actualEmpresaId !== ctx.empresaId) {
      throw new ErrorAuth(
        "SIN_PERMISO",
        "El usuario pertenece a otra empresa.",
      );
    }
  }

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await hashPassword(passwordTemporal);

  // El reset también levanta el bloqueo por intentos fallidos: si no, el
  // usuario recibe una contraseña nueva y sigue sin poder entrar hasta que
  // expire `bloqueado_hasta`, sin ninguna señal de por qué.
  await tx.execute(sql`
    UPDATE usuarios SET
      password_hash = ${passwordHash},
      debe_cambiar_password = true,
      intentos_fallidos = 0,
      bloqueado_hasta = NULL
    WHERE id = ${usuarioId}
  `);
  await revocarSesionesDeUsuario(tx, usuarioId);

  await registrar(tx, {
    accion: "PASSWORD_RESETEADA",
    entidad: "usuario",
    entidadId: usuarioId,
    actor: ctx,
  });

  return { ok: true, usuarioId, passwordTemporal };
}

/**
 * Levanta el bloqueo por intentos fallidos sin tocar la contraseña. El bloqueo
 * dura 5 minutos y el mensaje de login no lo revela (02 §6), así que sin esta
 * acción un usuario bloqueado no tiene forma de saber por qué no entra ni un
 * administrador de resolverlo. No hay acción propia en `accion_auditoria`: se
 * registra como `USUARIO_ACTUALIZADO` con el antes y el después de los dos
 * campos, que es justo lo que el visor de auditoría sabe mostrar en diff.
 */
export async function desbloquearUsuarioCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  usuarioId: string,
): Promise<ResultadoUsuario> {
  const actual = obtenerFilas(
    await tx.execute(
      sql`SELECT id, empresa_id, intentos_fallidos, bloqueado_hasta
          FROM usuarios WHERE id = ${usuarioId} FOR UPDATE`,
    ),
  )[0];
  if (!actual) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "El usuario no existe.",
    };
  }
  if (ctx.rol === "ADMIN_EMPRESA") {
    const actualEmpresaId =
      actual.empresa_id === null ? null : String(actual.empresa_id);
    if (actualEmpresaId !== ctx.empresaId) {
      throw new ErrorAuth(
        "SIN_PERMISO",
        "El usuario pertenece a otra empresa.",
      );
    }
  }

  await tx.execute(sql`
    UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL
    WHERE id = ${usuarioId}
  `);

  await registrar(tx, {
    accion: "USUARIO_ACTUALIZADO",
    entidad: "usuario",
    entidadId: usuarioId,
    actor: ctx,
    datosAntes: {
      intentosFallidos: Number(actual.intentos_fallidos ?? 0),
      bloqueadoHasta:
        actual.bloqueado_hasta === null ? null : String(actual.bloqueado_hasta),
    },
    datosDespues: { intentosFallidos: 0, bloqueadoHasta: null },
  });

  return { ok: true, usuarioId };
}

/** Devuelve un error si el empleado no es de la empresa o ya está asignado a otro usuario. */
async function validarEmpleado(
  tx: TransaccionAuditada,
  empleadoId: string,
  empresaId: string | null,
): Promise<ResultadoUsuario | null> {
  const empleado = obtenerFilas(
    await tx.execute(
      sql`SELECT empresa_id FROM empleados WHERE id = ${empleadoId}`,
    ),
  )[0];
  if (!empleado || String(empleado.empresa_id) !== empresaId) {
    return {
      ok: false,
      codigo: "REGLA_NEGOCIO",
      mensaje: "El empleado elegido no pertenece a la empresa del usuario.",
    };
  }
  const asignado = obtenerFilas(
    await tx.execute(sql`
      SELECT 1 FROM usuarios WHERE empleado_id = ${empleadoId} LIMIT 1
    `),
  );
  if (asignado.length > 0) {
    return {
      ok: false,
      codigo: "REGLA_NEGOCIO",
      mensaje: "Ese empleado ya está asociado a otro usuario.",
    };
  }
  return null;
}
