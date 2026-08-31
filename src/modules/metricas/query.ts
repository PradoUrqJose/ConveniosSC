import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas, type TransaccionAuditada } from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import type { Centimos } from "@/lib/dinero";
import { sumarDias } from "@/lib/fechas";
import type { TipoDocumento } from "@/lib/zod";
import type { DireccionVentas } from "@/modules/ventas/query";

type TotalesDashboard = {
  cantidad: number;
  sumaBrutoCentimos: Centimos;
  sumaDescuentoCentimos: Centimos;
  sumaFinalCentimos: Centimos;
  ticketPromedioCentimos: Centimos;
};
type EmpresaRanking = {
  empresaId: string;
  empresaNombre: string;
  cantidad: number;
  brutoCentimos: Centimos;
  descuentoCentimos: Centimos;
};
type EmpleadoRanking = {
  empleadoId: string;
  nombre: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  cantidad: number;
  brutoCentimos: Centimos;
};
type DashboardBase = {
  direccion: DireccionVentas;
  totales: TotalesDashboard;
  anuladas: { cantidad: number; sumaBrutoCentimos: Centimos };
  serie: Array<{
    periodo: string;
    cantidad: number;
    brutoCentimos: Centimos;
    descuentoCentimos: Centimos;
  }>;
  granularidad: "dia" | "semana" | "mes";
};

/** El contenido operativo depende de quién participa como empresa propia. */
export type Dashboard =
  | (DashboardBase & {
      direccion: "vendidas";
      empresasCompradoras: EmpresaRanking[];
      topVendedores: Array<{
        usuarioId: string;
        nombre: string;
        cantidad: number;
        brutoCentimos: Centimos;
      }>;
      porSede: Array<{
        sedeId: string;
        nombre: string;
        cantidad: number;
        brutoCentimos: Centimos;
      }>;
      beneficiarios: EmpleadoRanking[];
    })
  | (DashboardBase & {
      direccion: "compradas";
      empresasVendedoras: EmpresaRanking[];
      topEmpleados: EmpleadoRanking[];
      adopcion: {
        empleadosQueCompraron: number;
        empleadosActivos: number;
        tasa: number;
      };
    });

export type FiltrosDashboard = {
  desde: string;
  hasta: string;
  direccion?: DireccionVentas;
  empresaId?: string;
  sedeId?: string;
};

export function obtenerGranularidad(
  desde: string,
  hasta: string,
): DashboardBase["granularidad"] {
  const dias =
    Math.round(
      (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  if (dias <= 31) return "dia";
  if (dias <= 90) return "semana";
  return "mes";
}

function inicioSemana(fecha: string) {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return sumarDias(fecha, -((dia + 6) % 7));
}
function inicioMes(fecha: string) {
  return `${fecha.slice(0, 7)}-01`;
}

/** Incluye los intervalos sin ventas para que el gráfico no oculte periodos. */
export function completarSerie(
  filas: DashboardBase["serie"],
  desde: string,
  hasta: string,
  granularidad: DashboardBase["granularidad"],
): DashboardBase["serie"] {
  const porPeriodo = new Map(filas.map((fila) => [fila.periodo, fila]));
  const inicio =
    granularidad === "dia"
      ? desde
      : granularidad === "semana"
        ? inicioSemana(desde)
        : inicioMes(desde);
  const fin = granularidad === "mes" ? inicioMes(hasta) : hasta;
  const resultado: DashboardBase["serie"] = [];
  for (
    let periodo = inicio;
    periodo <= fin;
    periodo =
      granularidad === "dia"
        ? sumarDias(periodo, 1)
        : granularidad === "semana"
          ? sumarDias(periodo, 7)
          : inicioMes(sumarDias(periodo, 32))
  ) {
    resultado.push(
      porPeriodo.get(periodo) ?? {
        periodo,
        cantidad: 0,
        brutoCentimos: 0,
        descuentoCentimos: 0,
      },
    );
  }
  return resultado;
}

/** Métricas aisladas por rol y por dirección. Los importes sólo incluyen REGISTRADA. */
export async function obtenerDashboard(
  ctx: SessionContext,
  entrada: FiltrosDashboard,
  ejecutor: TransaccionAuditada = db,
): Promise<Dashboard> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  const direccion = entrada.direccion ?? "vendidas";
  const empresaPropiaId =
    ctx.rol === "ADMIN_EMPRESA" ? ctx.empresaId : entrada.empresaId;
  const alcance = empresaPropiaId
    ? direccion === "vendidas"
      ? sql`v.empresa_vendedora_id = ${empresaPropiaId}`
      : sql`v.empresa_compradora_id = ${empresaPropiaId}`
    : sql`TRUE`;
  const sede = entrada.sedeId ? sql` AND v.sede_id = ${entrada.sedeId}` : sql``;
  const base = sql`v.fecha_venta BETWEEN ${entrada.desde} AND ${entrada.hasta} AND ${alcance}${sede}`;
  const granularidad = obtenerGranularidad(entrada.desde, entrada.hasta);
  const agrupacionPeriodo =
    granularidad === "dia"
      ? sql`to_char(v.fecha_venta, 'YYYY-MM-DD')`
      : granularidad === "semana"
        ? sql`to_char(date_trunc('week', v.fecha_venta::timestamp), 'YYYY-MM-DD')`
        : sql`to_char(v.fecha_venta, 'YYYY-MM') || '-01'`;
  const lista = (r: unknown) => obtenerFilas(r);
  const n = (f: Record<string, unknown>, k: string) => Number(f[k] ?? 0);
  const map = <T>(r: unknown, fn: (f: Record<string, unknown>) => T): T[] =>
    lista(r).map(fn);

  const [resumenR, serieR, empresasR] = await Promise.all([
    ejecutor.execute(sql`
      SELECT count(*) FILTER (WHERE v.estado = 'REGISTRADA')::int cantidad,
        COALESCE(sum(v.monto_bruto_centimos) FILTER (WHERE v.estado = 'REGISTRADA'), 0)::bigint bruto,
        COALESCE(sum(v.monto_descuento_centimos) FILTER (WHERE v.estado = 'REGISTRADA'), 0)::bigint descuento,
        COALESCE(sum(v.monto_final_centimos) FILTER (WHERE v.estado = 'REGISTRADA'), 0)::bigint final,
        count(*) FILTER (WHERE v.estado = 'ANULADA')::int anuladas_cantidad,
        COALESCE(sum(v.monto_bruto_centimos) FILTER (WHERE v.estado = 'ANULADA'), 0)::bigint anuladas_bruto
        ${direccion === "compradas" ? sql`, count(DISTINCT v.empleado_comprador_id) FILTER (WHERE v.estado = 'REGISTRADA')::int compradores` : sql``}
      FROM ventas v WHERE ${base}`),
    ejecutor.execute(sql`SELECT ${agrupacionPeriodo} periodo, count(*)::int cantidad,
      COALESCE(sum(v.monto_bruto_centimos),0)::bigint bruto, COALESCE(sum(v.monto_descuento_centimos),0)::bigint descuento
      FROM ventas v WHERE ${base} AND v.estado = 'REGISTRADA' GROUP BY 1 ORDER BY 1`),
    ejecutor.execute(sql`SELECT e.id, e.nombre_comercial nombre, count(*)::int cantidad,
      COALESCE(sum(v.monto_bruto_centimos),0)::bigint bruto, COALESCE(sum(v.monto_descuento_centimos),0)::bigint descuento
      FROM ventas v JOIN empresas e ON e.id = ${direccion === "vendidas" ? sql`v.empresa_compradora_id` : sql`v.empresa_vendedora_id`}
      WHERE ${base} AND v.estado = 'REGISTRADA' GROUP BY e.id, e.nombre_comercial ORDER BY bruto DESC LIMIT 10`),
  ]);
  const t = lista(resumenR)[0] ?? {};
  const baseDashboard: DashboardBase = {
    direccion,
    totales: {
      cantidad: n(t, "cantidad"),
      sumaBrutoCentimos: n(t, "bruto"),
      sumaDescuentoCentimos: n(t, "descuento"),
      sumaFinalCentimos: n(t, "final"),
      ticketPromedioCentimos: n(t, "cantidad")
        ? Math.round(n(t, "final") / n(t, "cantidad"))
        : 0,
    },
    anuladas: {
      cantidad: n(t, "anuladas_cantidad"),
      sumaBrutoCentimos: n(t, "anuladas_bruto"),
    },
    granularidad,
    serie: completarSerie(
      map(serieR, (f) => ({
        periodo: String(f.periodo),
        cantidad: n(f, "cantidad"),
        brutoCentimos: n(f, "bruto"),
        descuentoCentimos: n(f, "descuento"),
      })),
      entrada.desde,
      entrada.hasta,
      granularidad,
    ),
  };
  const empresas = map(empresasR, (f): EmpresaRanking => ({
    empresaId: String(f.id),
    empresaNombre: String(f.nombre),
    cantidad: n(f, "cantidad"),
    brutoCentimos: n(f, "bruto"),
    descuentoCentimos: n(f, "descuento"),
  }));

  if (direccion === "compradas") {
    const [activosR, empleadosR] = await Promise.all([
      ejecutor.execute(
        sql`SELECT count(*)::int activos FROM empleados e WHERE e.estado = 'ACTIVO'${empresaPropiaId ? sql` AND e.empresa_id = ${empresaPropiaId}` : sql``}`,
      ),
      ejecutor.execute(sql`SELECT e.id, concat_ws(' ', e.nombres, e.apellidos) nombre, e.tipo_documento, e.dni numero_documento,
        count(*)::int cantidad, COALESCE(sum(v.monto_bruto_centimos),0)::bigint bruto
        FROM ventas v JOIN empleados e ON e.id = v.empleado_comprador_id WHERE ${base} AND v.estado = 'REGISTRADA'
        GROUP BY e.id, e.nombres, e.apellidos, e.tipo_documento, e.dni ORDER BY bruto DESC LIMIT 10`),
    ]);
    const activos = n(lista(activosR)[0] ?? {}, "activos");
    const compradores = n(t, "compradores");
    return {
      ...baseDashboard,
      direccion: "compradas",
      empresasVendedoras: empresas,
      topEmpleados: map(empleadosR, (f): EmpleadoRanking => ({
        empleadoId: String(f.id),
        nombre: String(f.nombre),
        tipoDocumento: String(f.tipo_documento) as TipoDocumento,
        numeroDocumento: String(f.numero_documento),
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

  const [vendedoresR, beneficiariosYSedesR] = await Promise.all([
    ejecutor.execute(sql`SELECT u.id, concat_ws(' ',u.nombres,u.apellidos) nombre, count(*)::int cantidad,
      COALESCE(sum(v.monto_bruto_centimos),0)::bigint bruto FROM ventas v JOIN usuarios u ON u.id=v.vendedor_usuario_id
      WHERE ${base} AND v.estado = 'REGISTRADA' GROUP BY u.id,u.nombres,u.apellidos ORDER BY bruto DESC LIMIT 10`),
    ejecutor.execute(sql`WITH agrupadas AS (
      SELECT CASE WHEN GROUPING(e.id) = 0 THEN 'beneficiario' ELSE 'sede' END tipo, COALESCE(e.id, s.id) id,
        CASE WHEN GROUPING(e.id) = 0 THEN concat_ws(' ', e.nombres, e.apellidos) ELSE s.nombre END nombre,
        e.tipo_documento, e.dni numero_documento, count(*)::int cantidad, COALESCE(sum(v.monto_bruto_centimos), 0)::bigint bruto
      FROM ventas v JOIN empleados e ON e.id = v.empleado_comprador_id JOIN sedes s ON s.id = v.sede_id
      WHERE ${base} AND v.estado = 'REGISTRADA'
      GROUP BY GROUPING SETS ((e.id, e.nombres, e.apellidos, e.tipo_documento, e.dni), (s.id, s.nombre))
    ), clasificadas AS (SELECT *, row_number() OVER (PARTITION BY tipo ORDER BY bruto DESC) posicion FROM agrupadas)
    SELECT tipo, id, nombre, tipo_documento, numero_documento, cantidad, bruto FROM clasificadas WHERE posicion <= 10 ORDER BY tipo, posicion`),
  ]);
  const beneficiariosYSedes = lista(beneficiariosYSedesR);
  return {
    ...baseDashboard,
    direccion: "vendidas",
    empresasCompradoras: empresas,
    topVendedores: map(vendedoresR, (f) => ({
      usuarioId: String(f.id),
      nombre: String(f.nombre),
      cantidad: n(f, "cantidad"),
      brutoCentimos: n(f, "bruto"),
    })),
    beneficiarios: beneficiariosYSedes
      .filter((f) => f.tipo === "beneficiario")
      .map((f): EmpleadoRanking => ({
        empleadoId: String(f.id),
        nombre: String(f.nombre),
        tipoDocumento: String(f.tipo_documento) as TipoDocumento,
        numeroDocumento: String(f.numero_documento),
        cantidad: n(f, "cantidad"),
        brutoCentimos: n(f, "bruto"),
      })),
    porSede: beneficiariosYSedes
      .filter((f) => f.tipo === "sede")
      .map((f) => ({
        sedeId: String(f.id),
        nombre: String(f.nombre),
        cantidad: n(f, "cantidad"),
        brutoCentimos: n(f, "bruto"),
      })),
  };
}
