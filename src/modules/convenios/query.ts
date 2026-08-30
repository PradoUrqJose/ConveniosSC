import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas, type TransaccionAuditada } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import { hoyLima, sumarDias } from "@/lib/fechas";
import type { Pagina } from "@/lib/tipos";
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
const POR_PAGINA = 20;

/** `listarConvenios` (03 §4). Términos vigentes a hoy y ventas de 30 días. */
export async function listarConvenios(
  ctx: SessionContext,
  entrada: { cursor?: string } = {},
  ejecutor: TransaccionAuditada = db,
): Promise<Pagina<FilaConvenio>> {
  requireRol(ctx, ["SUPERADMIN"]);

  const cursor = decodificarCursor(entrada.cursor);
  const where = cursor
    ? sql`WHERE (c.created_at, c.id) < (${cursor.createdAt}, ${cursor.id})`
    : sql``;

  const filas = obtenerFilas(
    await ejecutor.execute(sql`
      WITH ventas_30d AS (
        SELECT v.convenio_id, count(*)::int AS total
        FROM ventas v
        WHERE v.estado = 'REGISTRADA'
          AND v.fecha_venta >= ${sumarDias(HOY, -29)}
        GROUP BY v.convenio_id
      )
      SELECT c.id, c.created_at, c.estado, c.vigencia_desde, c.vigencia_hasta, c.notas,
        ea.id AS a_id, ea.nombre_comercial AS a_nombre,
        eb.id AS b_id, eb.nombre_comercial AS b_nombre,
        ta.descuento_bps AS a_bps, ta.vigencia_desde AS a_desde,
        tb.descuento_bps AS b_bps, tb.vigencia_desde AS b_desde,
        COALESCE(v30.total, 0)::int AS ventas_30d
      FROM convenios c
      JOIN empresas ea ON ea.id = c.empresa_a_id
      JOIN empresas eb ON eb.id = c.empresa_b_id
      LEFT JOIN LATERAL (
        SELECT ct.descuento_bps, ct.vigencia_desde
        FROM convenio_terminos ct
        WHERE ct.convenio_id = c.id
          AND ct.empresa_otorgante_id = ea.id
          AND ct.vigencia_desde <= ${HOY}
          AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${HOY})
        ORDER BY ct.vigencia_desde DESC
        LIMIT 1
      ) ta ON TRUE
      LEFT JOIN LATERAL (
        SELECT ct.descuento_bps, ct.vigencia_desde
        FROM convenio_terminos ct
        WHERE ct.convenio_id = c.id
          AND ct.empresa_otorgante_id = eb.id
          AND ct.vigencia_desde <= ${HOY}
          AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${HOY})
        ORDER BY ct.vigencia_desde DESC
        LIMIT 1
      ) tb ON TRUE
      LEFT JOIN ventas_30d v30 ON v30.convenio_id = c.id
      ${where}
      ORDER BY c.created_at DESC NULLS LAST, c.id DESC NULLS LAST
      LIMIT ${POR_PAGINA + 1}
    `),
  );

  const haySiguiente = filas.length > POR_PAGINA;
  const pagina = haySiguiente ? filas.slice(0, POR_PAGINA) : filas;
  const items = pagina.map((f) => ({
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
  const ultimo = pagina.at(-1);

  return {
    items,
    cursor: haySiguiente && ultimo ? codificarCursor(ultimo) : null,
  };
}

function decodificarCursor(
  cursor: string | undefined,
): { createdAt: string; id: string } | null {
  if (!cursor) {
    return null;
  }
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof raw.createdAt === "string" &&
      typeof raw.id === "string" &&
      raw.createdAt &&
      raw.id
    ) {
      return { createdAt: raw.createdAt, id: raw.id };
    }
  } catch {
    // Cursor inválido: se ignora y se devuelve la primera página.
  }
  return null;
}

function codificarCursor(fila: Record<string, unknown>): string {
  const createdAt =
    fila.created_at instanceof Date
      ? fila.created_at.toISOString()
      : String(fila.created_at);
  return Buffer.from(
    JSON.stringify({ createdAt, id: String(fila.id) }),
    "utf8",
  ).toString("base64url");
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
