import { sql } from "drizzle-orm";

import {
  obtenerFilas,
  registrar,
  type TransaccionAuditada,
} from "@/lib/audit/registrar";
import type { SessionContext } from "@/lib/auth/guardas";

export type DatosCrearEmpresa = {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  topeCentimos: number;
  requiereEvidencia: boolean;
  diasRetroactivos: number;
};

export type DatosActualizarEmpresa = {
  empresaId: string;
  razonSocial?: string;
  nombreComercial?: string;
  topeCentimos?: number;
  requiereEvidencia?: boolean;
  diasRetroactivos?: number;
  activo?: boolean;
};

/** Insert la empresa y su sede «Principal» en la misma transacción (01 §3). */
export async function crearEmpresaCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosCrearEmpresa,
): Promise<string> {
  const filas = obtenerFilas(
    await tx.execute(sql`
      INSERT INTO empresas
        (ruc, razon_social, nombre_comercial, tope_monto_venta_centimos,
         requiere_evidencia_en_venta, dias_retroactivos_venta)
      VALUES (${datos.ruc}, ${datos.razonSocial}, ${datos.nombreComercial},
              ${datos.topeCentimos}, ${datos.requiereEvidencia},
              ${datos.diasRetroactivos})
      RETURNING id
    `),
  );
  const empresaId = String(filas[0]?.id);

  await tx.execute(sql`
    INSERT INTO sedes (empresa_id, nombre) VALUES (${empresaId}, 'Principal')
  `);

  await registrar(tx, {
    accion: "EMPRESA_CREADA",
    entidad: "empresa",
    entidadId: empresaId,
    actor: ctx,
    datosDespues: {
      ruc: datos.ruc,
      razonSocial: datos.razonSocial,
      nombreComercial: datos.nombreComercial,
      topeMontoVentaCentimos: datos.topeCentimos,
      requiereEvidenciaEnVenta: datos.requiereEvidencia,
      diasRetroactivosVenta: datos.diasRetroactivos,
    },
  });
  await registrar(tx, {
    accion: "SEDE_CREADA",
    entidad: "sede",
    entidadId: `${empresaId}:principal`,
    actor: ctx,
    datosDespues: { nombre: "Principal", activo: true },
  });

  return empresaId;
}

/**
 * Actualiza la empresa. Devuelve los datos anteriores para el `datos_antes`
 * de la auditoría. Al cambiar `activo`, suspende o reactiva los convenios.
 */
export async function actualizarEmpresaCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosActualizarEmpresa,
): Promise<{ ok: true } | { ok: false; codigo: "NO_ENCONTRADO" }> {
  const actuales = obtenerFilas(
    await tx.execute(sql`
      SELECT ruc, razon_social, nombre_comercial, tope_monto_venta_centimos,
             requiere_evidencia_en_venta, dias_retroactivos_venta, activo
      FROM empresas WHERE id = ${datos.empresaId} FOR UPDATE
    `),
  )[0];
  if (!actuales) {
    return { ok: false, codigo: "NO_ENCONTRADO" };
  }

  const tope = datos.topeCentimos ?? Number(actuales.tope_monto_venta_centimos);
  const requiere =
    datos.requiereEvidencia ?? Boolean(actuales.requiere_evidencia_en_venta);
  const dias =
    datos.diasRetroactivos ?? Number(actuales.dias_retroactivos_venta);
  const activo = datos.activo ?? Boolean(actuales.activo);

  await tx.execute(sql`
    UPDATE empresas SET
      razon_social = ${datos.razonSocial ?? actuales.razon_social},
      nombre_comercial = ${datos.nombreComercial ?? actuales.nombre_comercial},
      tope_monto_venta_centimos = ${tope},
      requiere_evidencia_en_venta = ${requiere},
      dias_retroactivos_venta = ${dias},
      activo = ${activo}
    WHERE id = ${datos.empresaId}
  `);

  if (activo !== Boolean(actuales.activo)) {
    await tx.execute(sql`
      UPDATE convenios SET estado = ${activo ? "VIGENTE" : "SUSPENDIDO"}
      WHERE (empresa_a_id = ${datos.empresaId} OR empresa_b_id = ${datos.empresaId})
        AND estado <> 'TERMINADO'
    `);
  }

  await registrar(tx, {
    accion: "EMPRESA_ACTUALIZADA",
    entidad: "empresa",
    entidadId: datos.empresaId,
    actor: ctx,
    datosAntes: {
      razonSocial: String(actuales.razon_social),
      nombreComercial: String(actuales.nombre_comercial),
      topeMontoVentaCentimos: Number(actuales.tope_monto_venta_centimos),
      requiereEvidenciaEnVenta: Boolean(actuales.requiere_evidencia_en_venta),
      diasRetroactivosVenta: Number(actuales.dias_retroactivos_venta),
      activo: Boolean(actuales.activo),
    },
    datosDespues: {
      razonSocial: datos.razonSocial ?? String(actuales.razon_social),
      nombreComercial:
        datos.nombreComercial ?? String(actuales.nombre_comercial),
      topeMontoVentaCentimos: tope,
      requiereEvidenciaEnVenta: requiere,
      diasRetroactivosVenta: dias,
      activo,
    },
  });

  return { ok: true };
}
