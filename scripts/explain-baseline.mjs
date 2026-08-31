import pg from "pg";

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL_UNPOOLED para ejecutar EXPLAIN.");
}

const consultas = {
  ventas: `
    SELECT v.id, v.fecha_venta, v.monto_final_centimos
    FROM ventas v
    WHERE v.estado = 'REGISTRADA'
    ORDER BY v.fecha_venta DESC, v.id DESC
    LIMIT 51`,
  dashboard: `
    SELECT date_trunc('day', v.fecha_venta) AS periodo, count(*)
    FROM ventas v
    WHERE v.fecha_venta BETWEEN current_date - interval '29 days' AND current_date
      AND v.estado = 'REGISTRADA'
    GROUP BY 1
    ORDER BY 1`,
  dashboard_resumen: `
    SELECT count(*) FILTER (WHERE v.estado = 'REGISTRADA'),
      COALESCE(sum(v.monto_bruto_centimos) FILTER (WHERE v.estado = 'REGISTRADA'), 0)
    FROM ventas v
    WHERE v.fecha_venta BETWEEN current_date - interval '29 days' AND current_date`,
  dashboard_empresas: `
    SELECT v.empresa_compradora_id, count(*), COALESCE(sum(v.monto_bruto_centimos), 0)
    FROM ventas v
    WHERE v.fecha_venta BETWEEN current_date - interval '29 days' AND current_date
      AND v.estado = 'REGISTRADA'
    GROUP BY v.empresa_compradora_id
    ORDER BY 3 DESC
    LIMIT 10`,
  dashboard_vendedores: `
    SELECT v.vendedor_usuario_id, count(*), COALESCE(sum(v.monto_bruto_centimos), 0)
    FROM ventas v
    WHERE v.fecha_venta BETWEEN current_date - interval '29 days' AND current_date
      AND v.estado = 'REGISTRADA'
    GROUP BY v.vendedor_usuario_id
    ORDER BY 3 DESC
    LIMIT 10`,
  dashboard_beneficiarios_sedes: `
    SELECT v.empleado_comprador_id, v.sede_id, count(*), COALESCE(sum(v.monto_bruto_centimos), 0)
    FROM ventas v
    WHERE v.fecha_venta BETWEEN current_date - interval '29 days' AND current_date
      AND v.estado = 'REGISTRADA'
    GROUP BY GROUPING SETS ((v.empleado_comprador_id), (v.sede_id))`,
  auditoria: `
    SELECT a.id, a.ts, a.accion, a.entidad
    FROM auditoria a
    ORDER BY a.ts DESC, a.id DESC
    LIMIT 51`,
};

const client = new pg.Client({ connectionString });
await client.connect();
try {
  for (const [nombre, consulta] of Object.entries(consultas)) {
    const resultado = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${consulta}`,
    );
    console.log(
      JSON.stringify({ nombre, plan: resultado.rows[0]["QUERY PLAN"][0] }),
    );
  }
} finally {
  await client.end();
}
