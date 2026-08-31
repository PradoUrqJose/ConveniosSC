# Evidencia de rendimiento — issue 31

Fecha: 2026-08-30. Entorno: base de datos configurada en `.env.local`, datos de
desarrollo; ventana de 30 días terminada en `current_date`. Los resultados no
contienen datos de clientes.

## Consultas y plan

Se ejecutó `npm run perf:explain`, que usa `EXPLAIN (ANALYZE, BUFFERS, FORMAT
JSON)`. El script ahora cubre las cinco agregaciones que compone el Dashboard
de dirección `vendidas`: resumen, serie, empresas, vendedores y el `GROUPING
SETS` de beneficiarios/sedes.

| Consulta | Antes (ms) | Después (ms) | Plan final | Lecturas de bloques |
| --- | ---: | ---: | --- | ---: |
| Serie diaria | 0.084 | 0.103 | Aggregate sobre Seq Scan | 0 |
| Resumen | misma sentencia | 0.062 | Aggregate sobre Seq Scan | 0 |
| Ranking empresas | misma sentencia | 0.142 | Limit | 0 |
| Ranking vendedores | misma sentencia | 0.092 | Limit | 0 |
| Beneficiarios y sedes | misma sentencia | 0.137 | Aggregate (`GROUPING SETS`) | 0 |

La captura anterior de la serie está en la ejecución previa al refactor; las
cuatro restantes no cambiaron de SQL y se incorporaron al recolector para que
la comparación sea repetible desde este cambio. En la muestra pequeña, todos
los planes usan lecturas calientes y no justifican un índice nuevo. Se conserva
el índice parcial existente `ventas_fecha_registrada_idx`; no se creó migración
ni se modificó la ruta de escritura, por lo que no hay coste adicional de
almacenamiento o inserción que validar.

También se evaluó consolidar con un CTE reutilizado o una sola sentencia: haría
que métricas, gráfico y rankings dependan de una respuesta única y eliminaría
los límites de `Suspense` útiles para la UI. Se mantienen las cinco sentencias
en paralelo como compromisos independientes y se miden en producción con
`PERF_BASELINE=1`: `dashboard.consultas` informa duración y número de
sentencias por navegación.

## Hidratación y experiencia

Antes, `dashboard-client.tsx` importaba Recharts, métricas y rankings bajo un
único límite `"use client"`. Después, sólo los controles y la isla
`dashboard-chart-island.tsx` son cliente; Recharts se importa dinámicamente con
`ssr: false`. Métricas, banner y rankings son Server Components y no quedan en
el grafo de hidratación del gráfico.

Los módulos de métricas, gráfico y rankings tienen fronteras de `Suspense` y
skeletons propios: un módulo pendiente no reemplaza el encabezado ni los demás
módulos. La medición p95 de interacción (<800 ms) requiere una carga acordada y
usuarios autenticados representativos; queda instrumentada mediante
`PERF_BASELINE=1`, pero no se declara cumplida con una sola muestra local.
