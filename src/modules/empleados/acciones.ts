import { sql } from "drizzle-orm";

import {
  obtenerFilas,
  registrar,
  type TransaccionAuditada,
} from "@/lib/audit/registrar";
import { ErrorAuth, type SessionContext } from "@/lib/auth/guardas";
import type { TipoDocumento } from "@/lib/zod";
import { existeConvenioVigenteCon, type EstadoEmpleado } from "./query";

type DatosBaseEmpleado = {
  empresaId: string;
  nombres: string;
  apellidos: string;
  telefono?: string | null;
  consentimiento: true;
};

export type DatosCrearEmpleado = DatosBaseEmpleado &
  (
    | {
        tipoDocumento: TipoDocumento;
        numeroDocumento: string;
        dni?: never;
      }
    | {
        /** @deprecated Compatibilidad transitoria para llamadas internas antiguas. */
        dni: string;
        tipoDocumento?: never;
        numeroDocumento?: never;
      }
  );

export type DatosActualizarEmpleado = {
  empleadoId: string;
  nombres?: string;
  apellidos?: string;
  telefono?: string | null;
  estado?: "ACTIVO" | "INACTIVO";
};

export type ResultadoEmpleado =
  | { ok: true; empleadoId: string; estado: EstadoEmpleado }
  | {
      ok: false;
      codigo: "NO_ENCONTRADO" | "CONFLICTO" | "REGLA_NEGOCIO" | "VALIDACION";
      mensaje: string;
      campo?: string;
    };

/**
 * Crea un empleado (03 §6). Estado resultante (D23): `ACTIVO` solo si lo crea
 * el admin de la propia empresa; en cualquier otro caso nace
 * `PENDIENTE_VERIFICACION`. Solo SUPERADMIN y ADMIN_EMPRESA pueden crear. Si
 * la empresa no es la del actor, debe existir convenio vigente con la suya.
 */
export async function crearEmpleadoCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosCrearEmpleado,
): Promise<ResultadoEmpleado> {
  if (ctx.rol === "VENDEDOR") {
    throw new ErrorAuth(
      "SIN_PERMISO",
      "Los vendedores no pueden crear empleados.",
    );
  }
  const tipoDocumento = datos.tipoDocumento ?? "DNI";
  const numeroDocumento = datos.numeroDocumento ?? datos.dni ?? "";
  const esPropia = ctx.empresaId !== null && datos.empresaId === ctx.empresaId;
  const esAdminDueño = ctx.rol === "ADMIN_EMPRESA" && esPropia;

  if (!esPropia && ctx.empresaId !== null) {
    const conConvenio = await existeConvenioVigenteCon(
      ctx,
      datos.empresaId,
      tx,
    );
    if (!conConvenio) {
      return {
        ok: false,
        codigo: "REGLA_NEGOCIO",
        mensaje: "No hay un convenio vigente con la empresa del empleado.",
      };
    }
  }

  const existente = obtenerFilas(
    await tx.execute(
      sql`SELECT emp.nombre_comercial FROM empleados e
          JOIN empresas emp ON emp.id = e.empresa_id
          WHERE e.tipo_documento = ${tipoDocumento}
            AND e.dni = ${numeroDocumento} LIMIT 1`,
    ),
  )[0];
  if (existente) {
    return {
      ok: false,
      codigo: "CONFLICTO",
      mensaje: `El documento ya está registrado en ${String(existente.nombre_comercial)}.`,
      campo: "numeroDocumento",
    };
  }

  const estado: EstadoEmpleado = esAdminDueño
    ? "ACTIVO"
    : "PENDIENTE_VERIFICACION";

  const filas = obtenerFilas(
    await tx.execute(sql`
      INSERT INTO empleados
        (empresa_id, tipo_documento, dni, nombres, apellidos, telefono, estado,
         creado_por_usuario_id)
      VALUES (${datos.empresaId}, ${tipoDocumento}, ${numeroDocumento}, ${datos.nombres},
              ${datos.apellidos}, ${datos.telefono ?? null}, ${estado},
              ${ctx.usuarioId})
      RETURNING id
    `),
  );
  const empleadoId = String(filas[0]?.id);

  await registrar(tx, {
    accion: "EMPLEADO_CREADO",
    entidad: "empleado",
    entidadId: empleadoId,
    actor: ctx,
    datosDespues: {
      tipoDocumento,
      numeroDocumento,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      telefono: datos.telefono ?? null,
      empresaId: datos.empresaId,
      estado,
      consentimiento: true,
    },
  });

  return { ok: true, empleadoId, estado };
}

/**
 * Actualiza datos de un empleado (03 §6). Solo el admin de la empresa dueña.
 * El DNI y la empresa son inmutables; el estado solo cambia entre `ACTIVO` e
 * `INACTIVO` (la verificación/rechazo tienen su propia action).
 */
export async function actualizarEmpleadoCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosActualizarEmpleado,
): Promise<ResultadoEmpleado> {
  const actual = obtenerFilas(
    await tx.execute(
      sql`SELECT * FROM empleados WHERE id = ${datos.empleadoId} FOR UPDATE`,
    ),
  )[0];
  if (!actual) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "El empleado no existe.",
    };
  }

  if (ctx.rol === "ADMIN_EMPRESA") {
    if (String(actual.empresa_id) !== ctx.empresaId) {
      throw new ErrorAuth(
        "SIN_PERMISO",
        "El empleado pertenece a otra empresa.",
      );
    }
  }

  const nombres = datos.nombres ?? String(actual.nombres);
  const apellidos = datos.apellidos ?? String(actual.apellidos);
  const telefono =
    datos.telefono === undefined ? actual.telefono : datos.telefono;
  const estado =
    datos.estado === undefined ? String(actual.estado) : datos.estado;

  await tx.execute(sql`
    UPDATE empleados SET
      nombres = ${nombres},
      apellidos = ${apellidos},
      telefono = ${telefono},
      estado = ${estado}
    WHERE id = ${datos.empleadoId}
  `);

  await registrar(tx, {
    accion: "EMPLEADO_ACTUALIZADO",
    entidad: "empleado",
    entidadId: datos.empleadoId,
    actor: ctx,
    datosAntes: {
      nombres: String(actual.nombres),
      apellidos: String(actual.apellidos),
      telefono: actual.telefono as string | null,
      estado: String(actual.estado),
    },
    datosDespues: { nombres, apellidos, telefono, estado },
  });

  return {
    ok: true,
    empleadoId: datos.empleadoId,
    estado: estado as EstadoEmpleado,
  };
}

/**
 * Verifica un empleado (02 §10): pasa a `ACTIVO` con quién y cuándo. Solo el
 * admin de la empresa dueña. Si ya está `ACTIVO`, es idempotente.
 */
export async function verificarEmpleadoCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  empleadoId: string,
): Promise<ResultadoEmpleado> {
  const actual = obtenerFilas(
    await tx.execute(
      sql`SELECT * FROM empleados WHERE id = ${empleadoId} FOR UPDATE`,
    ),
  )[0];
  if (!actual) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "El empleado no existe.",
    };
  }
  const estadoActual = String(actual.estado);
  if (estadoActual === "ACTIVO") {
    return { ok: true, empleadoId, estado: "ACTIVO" };
  }
  if (estadoActual === "INACTIVO") {
    return {
      ok: false,
      codigo: "REGLA_NEGOCIO",
      mensaje: "Un empleado desactivado no se puede verificar.",
    };
  }
  if (
    ctx.rol === "ADMIN_EMPRESA" &&
    String(actual.empresa_id) !== ctx.empresaId
  ) {
    throw new ErrorAuth("SIN_PERMISO", "El empleado pertenece a otra empresa.");
  }

  await tx.execute(sql`
    UPDATE empleados SET
      estado = 'ACTIVO',
      verificado_por_usuario_id = ${ctx.usuarioId},
      verificado_at = now(),
      motivo_rechazo = NULL
    WHERE id = ${empleadoId}
  `);

  await registrar(tx, {
    accion: "EMPLEADO_VERIFICADO",
    entidad: "empleado",
    entidadId: empleadoId,
    actor: ctx,
    datosAntes: { estado: estadoActual },
    datosDespues: { estado: "ACTIVO" },
  });

  return { ok: true, empleadoId, estado: "ACTIVO" };
}

/**
 * Rechaza un empleado (02 §10): requiere motivo y, en la misma transacción,
 * marca `requiere_revision` en sus ventas `REGISTRADA`. Solo el admin de la
 * empresa dueña, y solo sobre empleados `PENDIENTE_VERIFICACION`.
 */
export async function rechazarEmpleadoCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: { empleadoId: string; motivo: string },
): Promise<ResultadoEmpleado> {
  const actual = obtenerFilas(
    await tx.execute(
      sql`SELECT * FROM empleados WHERE id = ${datos.empleadoId} FOR UPDATE`,
    ),
  )[0];
  if (!actual) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "El empleado no existe.",
    };
  }
  const estadoActual = String(actual.estado);
  if (estadoActual !== "PENDIENTE_VERIFICACION") {
    return {
      ok: false,
      codigo: "REGLA_NEGOCIO",
      mensaje: "Solo se puede rechazar un empleado pendiente de verificación.",
    };
  }
  if (
    ctx.rol === "ADMIN_EMPRESA" &&
    String(actual.empresa_id) !== ctx.empresaId
  ) {
    throw new ErrorAuth("SIN_PERMISO", "El empleado pertenece a otra empresa.");
  }

  await tx.execute(sql`
    UPDATE empleados SET
      estado = 'RECHAZADO',
      motivo_rechazo = ${datos.motivo},
      verificado_por_usuario_id = ${ctx.usuarioId},
      verificado_at = now()
    WHERE id = ${datos.empleadoId}
  `);

  const ventas = obtenerFilas(
    await tx.execute(
      sql`UPDATE ventas SET requiere_revision = true
          WHERE empleado_comprador_id = ${datos.empleadoId}
            AND estado = 'REGISTRADA'
          RETURNING id`,
    ),
  );

  await registrar(tx, {
    accion: "EMPLEADO_RECHAZADO",
    entidad: "empleado",
    entidadId: datos.empleadoId,
    actor: ctx,
    datosAntes: { estado: estadoActual },
    datosDespues: {
      estado: "RECHAZADO",
      motivo: datos.motivo,
      ventasMarcadas: ventas.length,
    },
  });

  return { ok: true, empleadoId: datos.empleadoId, estado: "RECHAZADO" };
}
