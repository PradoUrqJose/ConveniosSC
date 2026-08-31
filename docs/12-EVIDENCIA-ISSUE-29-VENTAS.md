# Evidencia de rendimiento — issue 29 (Ventas)

Fecha de implementación: 30-08-2026.

## Alcance medido

La instrumentación `convenios.perf.v1` publica, con `PERF_BASELINE=1`, la
latencia y el número de sentencias de las etapas `ventas.pagina`,
`ventas.resumen` y `ventas.catalogos`. No registra SQL ni datos personales.

El baseline de Playwright admite dos artefactos comparables:

```sh
PERF_BASELINE=1 E2E_BASELINE=1 BASELINE_ETAPA=antes npm run test:baseline
PERF_BASELINE=1 E2E_BASELINE=1 BASELINE_ETAPA=despues npm run test:baseline
```

Ambas ejecuciones requieren la copia aislada y las credenciales
`E2E_BASELINE_*` indicadas en [11-BASELINE-UI-DESKTOP.md](./11-BASELINE-UI-DESKTOP.md).
Dejan, respectivamente, `artifacts/baseline/antes.json` y
`artifacts/baseline/despues.json`, y conservan las capturas con el mismo
prefijo. La tabla se completa exclusivamente comparando esos dos artefactos
del mismo entorno.

| Ruta | Rol | p50 antes | p95 antes | p50 después | p95 después |
|---|---|---:|---:|---:|---:|
| `/ventas` | VENDEDOR | 740.8 ms | 834.2 ms | Pendiente de ejecutar baseline aislado | Pendiente de ejecutar baseline aislado |

Los valores «antes» son los publicados el 30-08-2026. No se infieren valores
de latencia «después» a partir del número de consultas: una copia aislada con
la misma distribución de datos es necesaria para afirmarlos.

## Comparación de consultas

| Flujo | Antes | Después | Cambio aplicado |
|---|---:|---:|---|
| Abrir `/ventas` como vendedor | 4 | 3 | No se carga el catálogo de contrapartes hasta abrir filtros. |
| Abrir `/ventas` como administrador (vendidas) | 7 | 4 | Catálogos de contrapartes, vendedores y sedes pasan a carga diferida. El conteo pendiente sigue existiendo, pero ya no bloquea el shell. |
| Cambiar sólo de página | 4 / 6 | 2 | Se conserva el resumen del mismo conjunto y no se recargan catálogos; sólo se valida sesión y consulta la página. |
| Buscar, ordenar o cambiar filtros | 4 / 6 | 3 | Se mantienen los catálogos ya abiertos en el cliente; se recalculan resumen y página para el conjunto nuevo. |

Los valores antes/después cuentan las consultas de la petición de Ventas,
incluida la validación de sesión. En las filas con dos números, el primero es
VENDEDOR y el segundo ADMIN_EMPRESA en ventas vendidas. La primera apertura de
filtros paga una petición separada de catálogos (dos consultas para vendedor,
cuatro para administrador); ese coste es intencional y sólo ocurre si se usan
las opciones.

## Resultado de verificación local

En este checkout no se configuraron las credenciales aisladas
`E2E_BASELINE_*`, por lo que no fue posible publicar aún los p50/p95 «después»
sin fabricar una medición. La instrumentación, el artefacto `despues.json` y
el protocolo comparable quedan listos para la ejecución autorizada en dicho
entorno.
