import { sql } from "drizzle-orm";

import {
  obtenerFilas,
  registrar,
  type TransaccionAuditada,
} from "@/lib/audit/registrar";
import { requireMismaEmpresa, type SessionContext } from "@/lib/auth/guardas";

export type DatosCrearSede = {
  empresaId: string;
  nombre: string;
  direccion?: string;
};

export type DatosActualizarSede = {
  sedeId: string;
  nombre: string;
  direccion?: string;
  activo: boolean;
};

export type ResultadoSede =
  | { ok: true; sedeId?: string }
  | { ok: false; codigo: "NO_ENCONTRADO" | "REGLA_NEGOCIO"; mensaje: string };

/**
 * Crea una sede (03 §3). Aislamiento: un `ADMIN_EMPRESA` crea siempre en su
 * propia empresa — el `empresaId` recibido se ignora (aceptación T08).
 */
export async function crearSedeCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosCrearSede,
): Promise<string> {
  const empresaId =
    ctx.rol === "SUPERADMIN"
      ? datos.empresaId
      : (ctx.empresaId ?? datos.empresaId);

  const filas = obtenerFilas(
    await tx.execute(sql`
      INSERT INTO sedes (empresa_id, nombre, direccion)
      VALUES (${empresaId}, ${datos.nombre}, ${datos.direccion ?? null})
      RETURNING id
    `),
  );
  const sedeId = String(filas[0]?.id);

  await registrar(tx, {
    accion: "SEDE_CREADA",
    entidad: "sede",
    entidadId: sedeId,
    actor: ctx,
    datosDespues: {
      empresaId,
      nombre: datos.nombre,
      direccion: datos.direccion ?? null,
      activo: true,
    },
  });

  return sedeId;
}

/**
 * Actualiza una sede. Reglas: no se puede desactivar la última sede activa ni
 * una sede con ventas registradas del mes en curso (03 §3).
 */
export async function actualizarSedeCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosActualizarSede,
): Promise<ResultadoSede> {
  const sede = obtenerFilas(
    await tx.execute(
      sql`SELECT * FROM sedes WHERE id = ${datos.sedeId} FOR UPDATE`,
    ),
  )[0];
  if (!sede) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "La sede no existe.",
    };
  }
  const sedeEmpresaId = String(sede.empresa_id);
  requireMismaEmpresa(ctx, sedeEmpresaId);

  if (!datos.activo && sede.activo === true) {
    const activas = obtenerFilas(
      await tx.execute(sql`
        SELECT count(*)::int AS n FROM sedes
        WHERE empresa_id = ${sedeEmpresaId} AND activo
      `),
    )[0];
    if (Number(activas?.n ?? 0) <= 1) {
      return {
        ok: false,
        codigo: "REGLA_NEGOCIO",
        mensaje: "No se puede desactivar la única sede activa de la empresa.",
      };
    }
    const ventasMes = obtenerFilas(
      await tx.execute(sql`
        SELECT 1 FROM ventas
        WHERE sede_id = ${datos.sedeId}
          AND estado = 'REGISTRADA'
          AND fecha_venta >= date_trunc('month', now() AT TIME ZONE 'America/Lima')::date
        LIMIT 1
      `),
    );
    if (ventasMes.length > 0) {
      return {
        ok: false,
        codigo: "REGLA_NEGOCIO",
        mensaje:
          "No se puede desactivar una sede con ventas en el mes en curso.",
      };
    }
  }

  await tx.execute(sql`
    UPDATE sedes SET
      nombre = ${datos.nombre},
      direccion = ${datos.direccion ?? null},
      activo = ${datos.activo}
    WHERE id = ${datos.sedeId}
  `);

  await registrar(tx, {
    accion: "SEDE_ACTUALIZADA",
    entidad: "sede",
    entidadId: datos.sedeId,
    actor: ctx,
    datosAntes: {
      nombre: String(sede.nombre),
      direccion: sede.direccion ?? null,
      activo: Boolean(sede.activo),
    },
    datosDespues: {
      nombre: datos.nombre,
      direccion: datos.direccion ?? null,
      activo: datos.activo,
    },
  });

  return { ok: true };
}
