import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas, type TransaccionAuditada } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import type { Centimos } from "@/lib/dinero";
import type { DireccionVentas } from "@/modules/ventas/query";
import type { TipoDocumento } from "@/lib/zod";

export type Dashboard = {
  totales: {
    cantidad: number;
    sumaBrutoCentimos: Centimos;
    sumaDescuentoCentimos: Centimos;
    sumaFinalCentimos: Centimos;
    ticketPromedioCentimos: Centimos;
  };
  anuladas: { cantidad: number; sumaBrutoCentimos: Centimos };
  serie: Array<{
    periodo: string;
    cantidad: number;
    brutoCentimos: Centimos;
    descuentoCentimos: Centimos;
  }>;
  granularidad: "dia" | "semana" | "mes";
  porConvenio: Array<{
    empresaId: string;
    empresaNombre: string;
    cantidad: number;
    brutoCentimos: Centimos;
    descuentoCentimos: Centimos;
  }>;
  topVendedores: Array<{
    usuarioId: string;
    nombre: string;
    cantidad: number;
    brutoCentimos: Centimos;
  }>;
  topEmpleados: Array<{
    empleadoId: string;
    nombre: string;
    tipoDocumento: TipoDocumento;
    numeroDocumento: string;
    cantidad: number;
    brutoCentimos: Centimos;
  }>;
  porSede: Array<{
    sedeId: string;
    nombre: string;
    cantidad: number;
    brutoCentimos: Centimos;
  }>;
  adopcion: {
    empleadosQueCompraron: number;
    empleadosActivos: number;
    tasa: number;
  };
};

export type FiltrosDashboard = {
  desde: string;
  hasta: string;
  direccion?: DireccionVentas;
  empresaId?: string;
  sedeId?: string;
};

/** Métricas aisladas por rol. Los importes incluyen exclusivamente ventas REGISTRADA. */
export async function obtenerDashboard(
  ctx: SessionContext,
  entrada: FiltrosDashboard,
  ejecutor: TransaccionAuditada = db,
): Promise<Dashboard> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  const direccion = entrada.direccion ?? "vendidas";
  const alcance =
    ctx.rol === "ADMIN_EMPRESA"
      ? direccion === "vendidas"
        ? sql`v.empresa_vendedora_id = ${ctx.empresaId}`
        : sql`v.empresa_compradora_id = ${ctx.empresaId}`
      : entrada.empresaId
        ? direccion === "vendidas"
          ? sql`v.empresa_vendedora_id = ${entrada.empresaId}`
          : sql`v.empresa_compradora_id = ${entrada.empresaId}`
        : sql`TRUE`;
  const sede = entrada.sedeId ? sql` AND v.sede_id = ${entrada.sedeId}` : sql``;
  const base = sql`v.fecha_venta BETWEEN ${entrada.desde} AND ${entrada.hasta} AND ${alcance}${sede}`;
  const granularidad: Dashboard["granularidad"] =
    entrada.desde.slice(0, 7) === entrada.hasta.slice(0, 7) ? "dia" : "mes";
  const periodo =
    granularidad === "dia"
      ? sql`to_char(v.fecha_venta, 'YYYY-MM-DD')`
      : sql`to_char(v.fecha_venta, 'YYYY-MM')`;

  const consultas = [
    ejecutor.execute(
      sql`
        SELECT
          count(*) FILTER (WHERE v.estado = 'REGISTRADA')::int cantidad,
          COALESCE(sum(v.monto_bruto_centimos) FILTER (WHERE v.estado = 'REGISTRADA'), 0)::bigint bruto,
          COALESCE(sum(v.monto_descuento_centimos) FILTER (WHERE v.estado = 'REGISTRADA'), 0)::bigint descuento,
          COALESCE(sum(v.monto_final_centimos) FILTER (WHERE v.estado = 'REGISTRADA'), 0)::bigint final,
          count(*) FILTER (WHERE v.estado = 'ANULADA')::int anuladas_cantidad,
          COALESCE(sum(v.monto_bruto_centimos) FILTER (WHERE v.estado = 'ANULADA'), 0)::bigint anuladas_bruto,
          count(DISTINCT v.empleado_comprador_id) FILTER (WHERE v.estado = 'REGISTRADA')::int compradores,
          (
            SELECT count(*)::int
            FROM empleados e
            WHERE e.estado = 'ACTIVO'
              ${ctx.rol === "ADMIN_EMPRESA" ? sql`AND e.empresa_id = ${ctx.empresaId}` : sql``}
          ) activos
        FROM ventas v
        WHERE ${base}
      `,
    ),
    ejecutor.execute(
      sql`SELECT ${periodo} periodo, count(*)::int cantidad, COALESCE(sum(v.monto_bruto_centimos),0)::bigint bruto, COALESCE(sum(v.monto_descuento_centimos),0)::bigint descuento FROM ventas v WHERE ${base} AND v.estado = 'REGISTRADA' GROUP BY 1 ORDER BY 1`,
    ),
    ejecutor.execute(
      sql`SELECT e.id, e.nombre_comercial nombre, count(*)::int cantidad, COALESCE(sum(v.monto_bruto_centimos),0)::bigint bruto, COALESCE(sum(v.monto_descuento_centimos),0)::bigint descuento FROM ventas v JOIN empresas e ON e.id = ${direccion === "vendidas" ? sql`v.empresa_compradora_id` : sql`v.empresa_vendedora_id`} WHERE ${base} AND v.estado = 'REGISTRADA' GROUP BY e.id, e.nombre_comercial ORDER BY bruto DESC LIMIT 10`,
    ),
    ejecutor.execute(
      sql`SELECT u.id, concat_ws(' ',u.nombres,u.apellidos) nombre, count(*)::int cantidad, COALESCE(sum(v.monto_bruto_centimos),0)::bigint bruto FROM ventas v JOIN usuarios u ON u.id=v.vendedor_usuario_id WHERE ${base} AND v.estado = 'REGISTRADA' GROUP BY u.id,u.nombres,u.apellidos ORDER BY bruto DESC LIMIT 10`,
    ),
    ejecutor.execute(
      sql`
        WITH agrupadas AS (
          SELECT
            CASE WHEN GROUPING(e.id) = 0 THEN 'empleado' ELSE 'sede' END tipo,
            COALESCE(e.id, s.id) id,
            CASE
              WHEN GROUPING(e.id) = 0 THEN concat_ws(' ', e.nombres, e.apellidos)
              ELSE s.nombre
            END nombre,
            e.tipo_documento,
            e.dni numero_documento,
            count(*)::int cantidad,
            COALESCE(sum(v.monto_bruto_centimos), 0)::bigint bruto
          FROM ventas v
          JOIN empleados e ON e.id = v.empleado_comprador_id
          JOIN sedes s ON s.id = v.sede_id
          WHERE ${base} AND v.estado = 'REGISTRADA'
          GROUP BY GROUPING SETS (
            (e.id, e.nombres, e.apellidos, e.tipo_documento, e.dni),
            (s.id, s.nombre)
          )
        ), clasificadas AS (
          SELECT *, row_number() OVER (PARTITION BY tipo ORDER BY bruto DESC) posicion
          FROM agrupadas
        )
        SELECT tipo, id, nombre, tipo_documento, numero_documento, cantidad, bruto
        FROM clasificadas
        WHERE posicion <= 10
        ORDER BY tipo, posicion
      `,
    ),
  ] as const;
  const [resumenR, serieR, convenioR, vendedoresR, empleadosYSedesR] =
    await Promise.all(consultas);
  const t = obtenerFilas(resumenR)[0] ?? {};
  const lista = (r: unknown) => obtenerFilas(r);
  const n = (f: Record<string, unknown>, k: string) => Number(f[k] ?? 0);
  const map = <T>(r: unknown, fn: (f: Record<string, unknown>) => T): T[] =>
    lista(r).map(fn);
  const cantidad = n(t, "cantidad");
  const activos = n(t, "activos");
  const compradores = n(t, "compradores");
  const empleadosYSedes = lista(empleadosYSedesR);
  return {
    totales: {
      cantidad,
      sumaBrutoCentimos: n(t, "bruto"),
      sumaDescuentoCentimos: n(t, "descuento"),
      sumaFinalCentimos: n(t, "final"),
      ticketPromedioCentimos: cantidad
        ? Math.round(n(t, "final") / cantidad)
        : 0,
    },
    anuladas: {
      cantidad: n(t, "anuladas_cantidad"),
      sumaBrutoCentimos: n(t, "anuladas_bruto"),
    },
    granularidad,
    serie: map(serieR, (f) => ({
      periodo: String(f.periodo),
      cantidad: n(f, "cantidad"),
      brutoCentimos: n(f, "bruto"),
      descuentoCentimos: n(f, "descuento"),
    })),
    porConvenio: map(convenioR, (f) => ({
      empresaId: String(f.id),
      empresaNombre: String(f.nombre),
      cantidad: n(f, "cantidad"),
      brutoCentimos: n(f, "bruto"),
      descuentoCentimos: n(f, "descuento"),
    })),
    topVendedores: map(vendedoresR, (f) => ({
      usuarioId: String(f.id),
      nombre: String(f.nombre),
      cantidad: n(f, "cantidad"),
      brutoCentimos: n(f, "bruto"),
    })),
    topEmpleados: empleadosYSedes
      .filter((f) => f.tipo === "empleado")
      .map((f) => ({
        empleadoId: String(f.id),
        nombre: String(f.nombre),
        tipoDocumento: String(f.tipo_documento) as TipoDocumento,
        numeroDocumento: String(f.numero_documento),
        cantidad: n(f, "cantidad"),
        brutoCentimos: n(f, "bruto"),
      })),
    porSede: empleadosYSedes
      .filter((f) => f.tipo === "sede")
      .map((f) => ({
        sedeId: String(f.id),
        nombre: String(f.nombre),
        cantidad: n(f, "cantidad"),
        brutoCentimos: n(f, "bruto"),
      })),
    adopcion: {
      empleadosQueCompraron: compradores,
      empleadosActivos: activos,
      tasa: activos ? Math.round((compradores * 10000) / activos) / 100 : 0,
    },
  };
}
