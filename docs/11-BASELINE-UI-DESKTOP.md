# Baseline de UI, navegación y rendimiento desktop

Este documento define la evidencia **antes** de los rediseños. No se deben
declarar mejoras de rendimiento, CLS o bundle en issues posteriores sin
comparar contra el artefacto generado en el mismo entorno.

## Entorno acordado

- Base de datos: copia aislada y representativa; nunca producción.
- Navegador: Chromium de la versión bloqueada en `package-lock.json`.
- Ejecución: `PERF_BASELINE=1 npm run test:baseline` con las seis variables
  `E2E_BASELINE_{VENDEDOR,ADMIN,SUPERADMIN}_{USER,PASSWORD}` y
  `E2E_BASELINE_PASSWORD_TARGET`, una cuenta de prueba que puede recibir un
  restablecimiento temporal.
- Muestras: 11 navegaciones por ruta; se reportan p50 y p95. El primer valor
  no se descarta: la línea base debe reflejar también el coste de navegación
  observado por el usuario.

El comando deja `artifacts/baseline/antes.json` (ignorado por Git), adjunta el
JSON al reporte de Playwright y conserva las capturas en el output del test.
Las 30 capturas de rutas cubren 1024×768, 1280×800 y 1440×900, en tema claro y
oscuro. Las cuatro capturas modales se hacen a 1440×900 claro.

## Tabla «antes»

Medición local del 30-08-2026, Chromium bloqueado por `package-lock.json`,
11 muestras por ruta. Los tiempos están en milisegundos, los tamaños en bytes
y CLS se expresa como valor adimensional; `antes.json` conserva la precisión
completa.

| Ruta | Rol | p50 página | p95 página | p50/p95 CLS | Layout p50 | Script p50 | RSC | JS Dashboard | Axe |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | VENDEDOR | 737.4 | 750.7 | 0 / 0 | 0.868 | 28.384 | 23,183 | — | 2 |
| `/ventas/nueva` | VENDEDOR | 839.3 | 1,069.1 | 0.000009315 / 0.000009587 | 2.602 | 66.714 | 19,452 | — | 2 |
| `/ventas` | VENDEDOR | 740.8 | 834.2 | 0 / 0 | 1.740 | 77.152 | 33,318 | — | 2 |
| `/dashboard` | ADMIN_EMPRESA | 764.5 | 778.3 | 0 / 0 | 2.225 | 140.907 | 12,154 | 7,099,392 | 2 |
| `/auditoria` | SUPERADMIN | 726.6 | 752.1 | 0 / 0 | 2.045 | 39.458 | 30,249 | — | 2 |

El JSON conserva valores sin redondear y es la fuente de verdad de esta tabla.
Al registrar los números en una revisión, indique fecha, commit, URL/entorno y
si se reutilizó una sesión o se inició una nueva.

## Qué mide cada capa

- `sesion.validacion`, `layout.badge-pendientes`, `*.pagina`, `*.resumen` y
  `*.catalogo-*` salen como JSON en los logs del servidor al activar
  `PERF_BASELINE=1`. Agrúpelos por `etapa` para obtener p50/p95 de base de
  datos y composición de página; no incluyen datos personales ni SQL.
- `p50/p95 página` mide navegación de Playwright hasta `networkidle`.
- `CLS` procede de `PerformanceObserver` desde el skeleton hasta el contenido.
- `Layout` y `Hidratación JS` son `LayoutDuration` y `ScriptDuration` del CDP.
- `RSC` suma `content-length` de respuestas `text/x-component`; `JS Dashboard`
  suma los bundles `/_next/static/*.js` solicitados por esa ruta.
- Axe se ejecuta en cada una de las cinco rutas; las cuatro variantes modales
  se capturan como evidencia visual. El total de violaciones de ruta se
  conserva como baseline: no se ocultan violaciones existentes.

## Modales y plan de consultas

La suite captura el modal corto (restablecimiento), largo (crear usuario),
destructivo (desactivar usuario) y contraseña temporal. Esa parte puede mutar
la contraseña de un usuario de prueba; por ello se ejecuta exclusivamente en
una base de datos aislada.

Antes de proponer un índice, ejecute `npm run perf:explain` contra esa misma
copia. El comando usa `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` para las rutas
de ventas, dashboard y auditoría y sólo hace lecturas. Guarde su salida junto
con `antes.json` en la evidencia de la revisión.
