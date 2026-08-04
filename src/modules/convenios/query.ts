import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import { hoyLima, sumarDias } from "@/lib/fechas";
import type { EstadoConvenio } from "./acciones";

export type TerminoVigente = { bps: number; desde: string };

export type FilaConvenio = {
  id: string;
  empresaA: { id: string; nombre: string };
  empresaB: { id: string; nombre: string };
  estado: EstadoConvenio;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  notas: string | null;
  terminoAotorga: TerminoVigente | null;
  terminoBotorga: TerminoVigente | null;
  ventas30d: number;
};

export type ConvenioVigenteMio = {
  convenioId: string;
  empresaId: string;
  empresaNombre: string;
  descuentoBps: number;
  terminoId: string;
};

const HOY = hoyLima();

/** `listarConvenios` (03 §4). Términos vigentes a hoy y ventas de 30 días. */
export async function listarConvenios(
  ctx: SessionContext,
): Promise<FilaConvenio[]> {
  requireRol(ctx, ["SUPERADMIN"]);

  const filas = obtenerFilas(
    await db.execute(sql`
      SELECT c.id, c.estado, c.vigencia_desde, c.vigencia_hasta, c.notas,
        ea.id AS a_id, ea.nombre_comercial AS a_nombre,
        eb.id AS b_id, eb.nombre_comercial AS b_nombre,
        (SELECT ct.descuento_bps FROM convenio_terminos ct
           WHERE ct.convenio_id = c.id AND ct.empresa_otorgante_id = ea.id
             AND ct.vigencia_desde <= ${HOY}
             AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${HOY})
           ORDER BY ct.vigencia_desde DESC LIMIT 1) AS a_bps,
        (SELECT ct.vigencia_desde FROM convenio_terminos ct
           WHERE ct.convenio_id = c.id AND ct.empresa_otorgante_id = ea.id
             AND ct.vigencia_desde <= ${HOY}
             AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${HOY})
           ORDER BY ct.vigencia_desde DESC LIMIT 1) AS a_desde,
        (SELECT ct.descuento_bps FROM convenio_terminos ct
           WHERE ct.convenio_id = c.id AND ct.empresa_otorgante_id = eb.id
             AND ct.vigencia_desde <= ${HOY}
             AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${HOY})
           ORDER BY ct.vigencia_desde DESC LIMIT 1) AS b_bps,
        (SELECT ct.vigencia_desde FROM convenio_terminos ct
           WHERE ct.convenio_id = c.id AND ct.empresa_otorgante_id = eb.id
             AND ct.vigencia_desde <= ${HOY}
             AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${HOY})
           ORDER BY ct.vigencia_desde DESC LIMIT 1) AS b_desde,
        (SELECT count(*)::int FROM ventas v
           WHERE v.convenio_id = c.id AND v.estado = 'REGISTRADA'
             AND v.fecha_venta >= ${sumarDias(HOY, -29)}) AS ventas_30d
      FROM convenios c
      JOIN empresas ea ON ea.id = c.empresa_a_id
      JOIN empresas eb ON eb.id = c.empresa_b_id
      ORDER BY c.created_at DESC, c.id DESC
    `),
  );

  return filas.map((f) => ({
    id: String(f.id),
    estado: String(f.estado) as EstadoConvenio,
    vigenciaDesde: String(f.vigencia_desde),
    vigenciaHasta: (f.vigencia_hasta as string | null) ?? null,
    notas: (f.notas as string | null) ?? null,
    empresaA: { id: String(f.a_id), nombre: String(f.a_nombre) },
    empresaB: { id: String(f.b_id), nombre: String(f.b_nombre) },
    terminoAotorga:
      f.a_bps === null
        ? null
        : { bps: Number(f.a_bps), desde: String(f.a_desde) },
    terminoBotorga:
      f.b_bps === null
        ? null
        : { bps: Number(f.b_bps), desde: String(f.b_desde) },
    ventas30d: Number(f.ventas_30d ?? 0),
  }));
}

/**
 * `misConveniosVigentes` (03 §4): convenios donde MI empresa otorga el
 * descuento, con el término vigente a la fecha pedida. Alimenta el selector
 * del formulario de venta.
 */
export async function misConveniosVigentes(
  ctx: SessionContext,
  entrada: { aFecha?: string } = {},
): Promise<ConvenioVigenteMio[]> {
  if (ctx.empresaId === null) {
    return [];
  }
  const aFecha = entrada.aFecha ?? hoyLima();

  const filas = obtenerFilas(
    await db.execute(sql`
      SELECT c.id AS convenio_id,
        CASE WHEN ct.empresa_otorgante_id = c.empresa_a_id
             THEN c.empresa_b_id ELSE c.empresa_a_id END AS empresa_id,
        CASE WHEN ct.empresa_otorgante_id = c.empresa_a_id
             THEN eb.nombre_comercial ELSE ea.nombre_comercial END AS empresa_nombre,
        ct.descuento_bps, ct.id AS termino_id
      FROM convenios c
      JOIN convenio_terminos ct
        ON ct.convenio_id = c.id
       AND ct.empresa_otorgante_id = ${ctx.empresaId}
      LEFT JOIN empresas ea ON ea.id = c.empresa_a_id
      LEFT JOIN empresas eb ON eb.id = c.empresa_b_id
      WHERE c.estado = 'VIGENTE'
        AND ${aFecha} >= c.vigencia_desde
        AND (c.vigencia_hasta IS NULL OR ${aFecha} <= c.vigencia_hasta)
        AND ct.vigencia_desde <= ${aFecha}
        AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${aFecha})
      ORDER BY empresa_nombre ASC
    `),
  );

  return filas.map((f) => ({
    convenioId: String(f.convenio_id),
    empresaId: String(f.empresa_id),
    empresaNombre: String(f.empresa_nombre),
    descuentoBps: Number(f.descuento_bps),
    terminoId: String(f.termino_id),
  }));
}

export type EmpresaParaConvenio = { id: string; nombreComercial: string };

/** Empresas activas para el formulario de crear convenio. */
export async function listarEmpresasParaConvenio(
  ctx: SessionContext,
): Promise<EmpresaParaConvenio[]> {
  requireRol(ctx, ["SUPERADMIN"]);

  const filas = obtenerFilas(
    await db.execute(sql`
      SELECT id, nombre_comercial FROM empresas
      WHERE activo
      ORDER BY nombre_comercial ASC
    `),
  );
  return filas.map((f) => ({
    id: String(f.id),
    nombreComercial: String(f.nombre_comercial),
  }));
}
