# Baseline móvil, RUM y presupuestos — issue #57

Esta es la referencia operativa de rendimiento. Reemplaza la idea imprecisa de
que una pantalla es «instantánea» por datos repetibles. La base desktop sigue
en [11-BASELINE-UI-DESKTOP.md](./11-BASELINE-UI-DESKTOP.md); este documento
cubre el uso móvil y la medición real.

## Dashboard publicado

`artifacts/performance/movil.json` es la fuente y
`artifacts/performance/movil-resumen.json` el dashboard en formato portable:
cada fila se publica por **ruta, rol, dispositivo, red y tipo de navegación**,
con sus p75/p95. Se adjunta a la ejecución de Playwright y se puede cargar
directamente en el dashboard de observabilidad del entorno. No se versiona
para no mezclar muestras de bases de datos distintas.

| Dimensión | Cobertura |
| --- | --- |
| Rutas/roles | `/` y `/ventas` (VENDEDOR), `/dashboard` (ADMIN_EMPRESA), `/auditoria` (SUPERADMIN) |
| Anchos/dispositivo | Android medio: 320 y 390 px; iPhone: 430 px |
| Red | Wi-Fi (20 ms) y 4G limitada (1.6 Mbps bajada, 750 Kbps subida, 150 ms RTT) |
| Repetición | 3 cargas frías y 5 navegaciones calientes por combinación |
| Datos | Ejecutar cada tanda con y sin adjuntos; la columna `adjuntoMs` deja explícito su coste |

La suite mide TTFB, FCP, LCP, INP, CLS, shell, datos, RSC, JS, API/BD
observable y adjuntos, además de Layout y Script del navegador. El tiempo a
datos se fija cuando el título de la ruta está visible; no se confunde con que
el shell haya aparecido.

```sh
npm run build
# En otra terminal, iniciar el build: npm run start -- --port 3000
E2E_BASELINE=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  npm run test:baseline:movil
node scripts/comparar-baseline-movil.mjs artifacts/performance/movil.json
```

Las credenciales `E2E_BASELINE_{VENDEDOR,ADMIN,SUPERADMIN}_{USER,PASSWORD}`
deben pertenecer a una copia aislada. Nunca se ejecuta contra producción. Al
publicar la comparación, registrar commit, fecha, URL/entorno, semilla de
datos y si incluye adjuntos. Eso explica cualquier diferencia con el baseline
diagnóstico previo: aquel fue desarrollo (3.08–3.17 s hasta Ventas, 0.50–1.21
s de aplicación y miniatura en 2.9 s); este protocolo usa build de producción,
red conocida y percentiles, por lo que los números no son intercambiables.

## Presupuestos y CI

`performance/presupuestos.json` es la única fuente de verdad inicial:

- p75: LCP ≤ 2.5 s, INP ≤ 200 ms y CLS ≤ 0.1.
- p95 de shell en navegación caliente ≤ 200 ms.
- JS gzip compartido ≤ 180 KB; JS adicional de una ruta ≤ 80 KB.

El job `CI` construye producción y ejecuta `npm run perf:budget`; falla si un
bundle cruza el límite. La ejecución móvil termina con
`comparar-baseline-movil.mjs`, que falla con los presupuestos CWV/shell. En el
pipeline de release debe conservarse ese JSON como artefacto y usar el mismo
comando: no se aprueba una regresión por no haber dejado evidencia.

## Trazas atribuibles

Durante un baseline, `PERF_BASELINE=1` emite `convenios.perf.v1` por etapa de
servidor y número de consultas, sin SQL ni datos personales. La fila móvil
añade RSC, JS, recursos API y adjuntos. Así se separa la demora entre servidor
y BD (logs), Flight/RSC, hidratación/script/layout y transferencia de archivos.
Una respuesta no atribuible se considera una captura incompleta, no una mejora.

## RUM: privacidad, consentimiento y muestreo

`RendimientoReal` reporta sólo rutas normalizadas, rol, nombre de métrica,
valor, tipo de navegación y clase de dispositivo. El endpoint valida el
contrato, elimina query strings e IDs, toma el rol real de la sesión y registra
una línea `convenios.rum.v1`; no guarda DNI, nombre, correo, URL de archivo,
IP, sesión ni datos del negocio.

Está apagado por defecto. Para activarlo en producción, configurar ambos
`RUM_ENABLED=1` y `NEXT_PUBLIC_RUM_ENABLED=1`; el muestreo es 10% por defecto
y se ajusta con `NEXT_PUBLIC_RUM_SAMPLE_RATE` entre 0 y 1. Si la política del
entorno exige consentimiento, usar `NEXT_PUBLIC_RUM_REQUIRES_CONSENT=1`; sólo
se envía tras que la UI de consentimiento registre
`localStorage['convenios-rum-consent'] = 'granted'`. No se muestra un diálogo
nuevo porque el producto no tiene aún una política/interfaz de consentimiento
aprobada: con esa variable, la ausencia de consentimiento equivale a no medir.

Para revisar la experiencia en la UI, iniciar sesión como cada rol y abrir
Inicio, Ventas, Dashboard y Auditoría a 320, 390 y 430 px; el usuario no verá
un cambio visual. En DevTools > Network se puede comprobar el `POST
/api/rendimiento` sólo cuando se habilite explícitamente RUM y exista la
condición de consentimiento aplicable.
