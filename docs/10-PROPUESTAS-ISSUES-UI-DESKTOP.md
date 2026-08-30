# Propuestas de issues — Rediseño UI Desktop

## 1. Cómo usar este documento

Cada sección está redactada para convertirse en un issue de GitHub. Los issues
se ordenan por dependencia, no sólo por pantalla: primero primitives y errores
semánticos, después rediseños, migraciones y pulido.

Documentos relacionados:

- Diagnóstico y ubicaciones: `docs/08-AUDITORIA-UI-DESKTOP.md`.
- Reglas visuales: `docs/09-GUIA-REDISENO-UI-DESKTOP.md`.

## 2. Prioridades, labels y tamaños

### Prioridades

| Prioridad | Significado |
|---|---|
| P0 | Bloquea uso, seguridad o integridad en producción |
| P1 | Alta: bug funcional, flujo principal, latencia o inconsistencia visual grande |
| P2 | Media: UX, escalabilidad o consistencia importante sin bloqueo inmediato |
| P3 | Baja: pulido posterior |

No se identificó un P0 de seguridad en esta auditoría. Los dos skeletons pedidos
son P1 urgentes: no bloquean una operación, pero son defectos visibles en rutas
principales.

### Labels recomendados

- Tipo: `type:bug`, `type:enhancement`, `type:refactor`, `type:test`.
- Área: `area:dashboard`, `area:sales`, `area:audit`, `area:modals`,
  `area:employees`, `area:sites`, `area:companies`, `area:agreements`,
  `area:users`, `area:skeletons`.
- Disciplina: `ui`, `ux`, `accessibility`, `animation`, `performance`, `database`,
  `permissions`, `data`.
- Plataforma: `platform:desktop`, `responsive`.
- Prioridad: `priority:P1`, `priority:P2`, `priority:P3`.

### Tamaño

`S` es un cambio aislado; `M` cruza varios componentes; `L` requiere nueva
arquitectura o migración amplia; `XL` debe dividirse antes de iniciar.

## 3. Fases y dependencias

| Fase | Objetivo | Issues |
|---|---|---|
| 0 | Baseline y errores semánticos | 01, 05, 08, 10, 13, 18 |
| 1 | Skeletons y foundations visuales | 02, 03, 04 |
| 2 | Ventas y navegación | 06, 07, 09 |
| 3 | Dashboard Admin | 11, 12 |
| 4 | Sistema modal | 14, 15, 16 |
| 5 | Auditoría | 19, 20 |
| 6 | Pulido de catálogos | 21, 22, 23, 24, 25 |
| 7 | Cobertura restante y cierre | 17, 26 |

El orden no obliga a un único PR por issue. Los issues `11`, `15`, `17` y `26`
deben dividirse en PRs pequeños aunque permanezcan como un único objetivo de
producto.

---

## Issue 01 — Crear baseline medible de UI, navegación y rendimiento desktop

**Prioridad:** P1  
**Tamaño:** M  
**Labels:** `type:test`, `platform:desktop`, `performance`, `ui`, `accessibility`,
`priority:P1`

### Problema

No hay capturas de regresión ni presupuestos que permitan afirmar si el rediseño
mejora fluidez, CLS o JS inicial. Las hipótesis de consultas tampoco tienen
timings por etapa.

### Alcance

- Añadir escenarios autenticados desktop para vendedor, admin empresa y
  superadmin.
- Capturar antes de cambiar:
  - `/`, `/ventas/nueva`, `/ventas`, `/dashboard`, `/auditoria`.
  - Un modal corto, uno largo, uno destructivo y contraseña temporal.
- Instrumentar por ruta:
  - Validación de sesión.
  - Consulta del badge de pendientes.
  - Query de página, resumen y catálogos.
  - Tamaño del payload RSC y JS del dashboard.
- Ejecutar `EXPLAIN (ANALYZE, BUFFERS)` con dataset representativo antes de
  proponer índices.

### Criterios de aceptación

- Existe una tabla “antes” con p50/p95 en entorno acordado.
- Existen capturas en `1024×768`, `1280×800` y `1440×900`, claro y oscuro.
- Se registra CLS durante skeleton → contenido.
- El reporte distingue latencia de layout, página, base de datos e hidratación.
- Ningún issue posterior afirma una mejora de rendimiento sin comparación.

### Pruebas

- Playwright autenticado.
- Axe o equivalente en las cinco rutas y cuatro variantes modales.
- Reporte de bundle de Dashboard.

---

## Issue 02 — Corregir skeleton del Dashboard Vendedor

**Prioridad:** P1 urgente  
**Tamaño:** S  
**Labels:** `type:bug`, `area:skeletons`, `area:dashboard`, `platform:desktop`,
`priority:P1`

### Evidencia

- Loading: `src/app/(app)/loading.tsx`.
- Skeleton actual: `src/components/page-skeletons.tsx:129-141`.
- UI real: `src/app/(app)/page.tsx:49-181`.

### Alcance propuesto

- Crear `InicioVendedorSkeleton` específico.
- Reproducir:
  1. Hero ancho completo con altura y radio equivalentes.
  2. Cuatro métricas en `grid-cols-2 lg:grid-cols-4`.
  3. Panel de ventas recientes con header y cinco filas.
- Reusar las mismas clases estructurales o constantes de layout de la pantalla
  real para evitar divergencia futura.
- Retirar la cabecera genérica y las dos cards actuales de esta ruta.

### Criterios de aceptación

- En `lg` se ven exactamente hero, cuatro cards y panel inferior.
- En el mismo viewport no cambia el número de columnas al resolver datos.
- Radios, gaps y anchos coinciden con la UI real.
- `aria-busy` anuncia carga y los rectángulos son decorativos para lector de
  pantalla.
- Shimmer se desactiva con reduced motion.
- CLS del intercambio queda por debajo de `0.1` en el escenario acordado.

### Fuera de alcance

- Rediseñar el Dashboard Vendedor.
- Cambiar las consultas actuales.

---

## Issue 03 — Crear skeleton desktop específico de Nueva Venta

**Prioridad:** P1 urgente  
**Tamaño:** M  
**Labels:** `type:bug`, `area:skeletons`, `area:sales`, `platform:desktop`,
`responsive`, `priority:P1`

### Evidencia

- Loading: `src/app/(app)/ventas/nueva/loading.tsx`.
- Genérico actual: `src/components/page-skeletons.tsx:44-58`.
- UI real: `src/app/(app)/ventas/nueva/form-venta.tsx:446-966`.

### Alcance propuesto

- Crear `NuevaVentaSkeleton` con variantes responsive.
- Desktop `lg`:
  - Header con kicker/título y pill de estado.
  - Grid `minmax(0,1fr) 372px`.
  - Tres tarjetas en columna principal.
  - Aside lateral sticky con progreso, filas y bloque de total.
  - Áreas de búsqueda, monto y adjuntos con alturas aproximadas reales.
- Móvil: composición compacta independiente sin aside.

### Criterios de aceptación

- Desktop nunca renderiza el skeleton estrecho `max-w-2xl`.
- El aside ocupa `372px` desde el mismo breakpoint que la pantalla final.
- Se preservan ancho, radios de `22–26px` y separación de tarjetas.
- No aparece barra inferior móvil en viewport desktop.
- CLS skeleton → formulario menor de `0.1`.

---

## Issue 04 — Definir primitives y tokens del rediseño desktop

**Prioridad:** P1  
**Tamaño:** M  
**Labels:** `type:refactor`, `ui`, `animation`, `accessibility`,
`platform:desktop`, `priority:P1`

### Problema

Las referencias aprobadas usan radios, sombras y densidades que no están
completamente centralizados. Empleados incluso mantiene una segunda versión de
header, stats y tabla. Implementar pantallas sin foundation produciría más
clases aisladas.

### Alcance propuesto

- Estabilizar primitives compartidas para:
  - Hero de página.
  - Panel/surface con header y footer.
  - Métrica.
  - Estado badge.
  - Encabezado ordenable.
  - Estado vacío.
  - Indicador pending de superficie.
- Añadir tokens o utilities de:
  - Elevación normal, hover y flotante.
  - Radios de panel, control y modal.
  - Duraciones/easing.
  - Capas de overlay/popover/toast.
- Implementar reduced motion para los nuevos patrones.
- Actualizar `docs/05-DESIGN-SYSTEM.md` sólo cuando los primitives estén usados y
  verificados; resolver las contradicciones listadas en la guía.

### Criterios de aceptación

- Las nuevas pantallas no duplican cadenas largas de sombra/radio.
- Los componentes conservan tema claro/oscuro.
- No se introducen textos operativos inferiores a 12px.
- Focus visible y contraste AA están comprobados.
- La documentación coincide con tokens reales.

---

## Issue 05 — Corregir semántica de montos y resúmenes en Ventas

**Prioridad:** P1  
**Tamaño:** M  
**Labels:** `type:bug`, `area:sales`, `data`, `priority:P1`

### Problemas a resolver

1. “Monto” muestra bruto, ordena final y filtra bruto.
2. El resumen por defecto mezcla anuladas con registradas.
3. Las labels no explican qué importe se usa.

### Ubicaciones

- `src/app/(app)/ventas/ventas-client.tsx:362-393,876-940`.
- `src/modules/ventas/query.ts:339-370,466-508`.

### Decisión requerida

Elegir y documentar una semántica:

- Opción recomendada: orden principal por “Total pagado”, con bruto y descuento
  como datos secundarios; filtros especifican si operan sobre bruto o final.
- Alternativa: mantener “Monto bruto” y ordenar/filtrar siempre bruto.

El resumen debe sumar sólo registradas y mostrar anuladas aparte, o iniciar con
el filtro `REGISTRADA`.

### Criterios de aceptación

- El valor visible bajo el encabezado ordenable coincide con el `ORDER BY`.
- Filtros dicen “Monto bruto” o “Total pagado”; no sólo “Monto”.
- Una anulada no incrementa indicadores activos sin una etiqueta explícita.
- Tests cubren ascendente, descendente, mínimo, máximo y combinación de estados.

---

## Issue 06 — Rediseñar la tabla desktop compartida de Ventas

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:enhancement`, `area:sales`, `ui`, `accessibility`,
`platform:desktop`, `priority:P1`

**Depende de:** issues 04 y 05.

### Alcance visual

- Mantener un componente compartido para Mis Ventas y Ventas Admin con columnas
  configurables.
- Panel integrado con header, resultados y paginación.
- Fila de `68–76px`:
  - Tile/iniciales + nombre en capitalización natural + documento mono.
  - Contraparte y ubicación en segundo nivel.
  - Bloque financiero con total dominante, bruto secundario y descuento.
  - Estado con icono/texto y señal de revisión.
  - Indicador de adjuntos o eliminar ese dato de la query si no se usará.
  - Chevron/acción de detalle.
- Hover tonal, foco visible y pending que conserva la tabla anterior.

### Accesibilidad

- Usar enlace real para abrir detalle.
- `scope="col"` y `aria-sort` en encabezados.
- La fila no puede depender exclusivamente de `onClick`.
- Mantener navegación y lectura útiles a zoom `200%`.

### Criterios de aceptación

- Una operación se abre con teclado y devuelve foco razonablemente al volver.
- Importes alineados con `tabular-nums`.
- Nombres ya no aparecen completamente en mayúsculas.
- La variante vendedor no deja huecos de columnas admin.
- Skeleton de la tabla tiene las mismas columnas y alturas.
- 25 filas no producen scroll horizontal en `1440px`; a `1024px` el scroll queda
  contenido dentro del panel.

---

## Issue 07 — Crear SalesDirectionTabs compartido, animado y optimista

**Prioridad:** P1  
**Tamaño:** M  
**Labels:** `type:enhancement`, `area:sales`, `area:dashboard`, `animation`,
`navigation`, `accessibility`, `priority:P1`

**Depende de:** issue 04.  
**Relacionado con:** issues 09 y 10.

### Alcance

- Sustituir las implementaciones de:
  - `dashboard/dashboard-client.tsx:79-94`.
  - `ventas/ventas-client.tsx:245-269`.
- Estado optimista para mover el indicador antes de recibir Server Components.
- Indicador compartido por `transform`, `180–240ms`.
- Contenido anterior atenuado durante transición; skeleton sólo en el panel que
  cambia.
- URL e historial correctos.
- Prefetch de la dirección alternativa cuando sea seguro, siguiendo las APIs de
  Next 16.3 instaladas.
- Semántica `tablist/tab/aria-selected` y teclado, o navegación equivalente si se
  mantiene como enlaces.
- Reduced motion sin desplazamiento.

### Criterios de aceptación

- La selección responde en menos de 100 ms aunque la red tarde.
- No hay doble navegación al pulsar repetidamente.
- No aparece el loading de otra pantalla.
- Dirección, filtros compatibles y fechas sobreviven al cambio.
- Focus, hover y selected son distinguibles en ambos temas.

---

## Issue 08 — Corregir filtros direccionales e históricos de Ventas Admin

**Prioridad:** P1  
**Tamaño:** M  
**Labels:** `type:bug`, `area:sales`, `data`, `ux`, `priority:P1`

### Alcance

- En `vendidas`:
  - Contraparte = empresa compradora.
  - Vendedor y sede propios son válidos.
- En `compradas`:
  - Contraparte = empresa vendedora.
  - Ocultar vendedor/sede si no se soportan o cargar valores distintos del
    universo comprado con labels explícitas.
- Al cambiar dirección, eliminar de la URL filtros incompatibles.
- Separar las opciones históricas de las empresas vigentes usadas para crear una
  venta.
- Validar search params en servidor.

### Ubicaciones

- `ventas/page.tsx:80-103`.
- `ventas/ventas-client.tsx:518-695`.
- `src/modules/ventas/query.ts:414-486,754-771`.
- `src/modules/empleados/query.ts:531-563`.

### Criterios de aceptación

- Ninguna opción visible pertenece necesariamente al lado incorrecto.
- Toda contraparte presente en histórico puede filtrarse.
- Cambiar a compras limpia vendedor/sede propios sin dejar chips fantasma.
- Manipular IDs o combinaciones incompatibles no rompe ni filtra fuera del
  alcance autorizado.
- Tests con dos empresas, sedes y vendedores distintos.

---

## Issue 09 — Reducir recargas y mejorar estados pending en Ventas

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:refactor`, `area:sales`, `performance`, `database`,
`priority:P1`

**Depende de:** issue 01.  
**Relacionado con:** issues 07 y 08.

### Plan técnico

1. Instrumentar sesión, badge de layout, resumen, página y catálogos.
2. Evitar bloquear el contenido por el badge de pendientes; moverlo a una
   frontera de Suspense o estrategia equivalente compatible con Next 16.3.
3. No cargar tres catálogos hasta que el panel de filtros lo requiera, o
   cachearlos con alcance/invalidation correctos.
4. Al cambiar sólo cursor, reutilizar el resumen del mismo conjunto filtrado.
5. Evitar navegaciones duplicadas del debounce de búsqueda.
6. Evaluar consolidación de round trips sólo después de medir.

### Criterios de aceptación

- Paginar no vuelve a consultar catálogos estables.
- Abrir Ventas sin filtros no paga opciones que no se usan.
- El shell o skeleton aparece sin esperar el conteo de pendientes.
- El contenido anterior permanece disponible durante búsqueda/orden/página.
- Se publica comparación p50/p95 y número de consultas antes/después.

---

## Issue 10 — Corregir modelo semántico del Dashboard Admin

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:bug`, `area:dashboard`, `data`, `priority:P1`

### Problemas incluidos

- El form de fechas pierde `dir`.
- Adopción inválida en `vendidas`.
- Sólo anuladas produce pantalla vacía.
- Rankings “Top vendedores” y “Por sede” no significan lo mismo en ambas
  direcciones.
- Granularidad temporal insuficiente.

### Alcance

- Preservar dirección al cambiar periodo.
- Modelar el DTO por dirección:
  - Vendidas: vendedores propios, sedes propias, empresas compradoras,
    beneficiarios únicos.
  - Compradas: empleados propios beneficiados, empresas vendedoras y adopción de
    empleados propios; no mostrar rankings externos sin valor operativo.
- Mantener anuladas visible fuera del estado vacío de registradas.
- Granularidad: `≤31 días = día`, `32–90 = semana`, `>90 = mes`.
- Completar periodos sin ventas con cero.
- Tests unitarios y de query para ambas direcciones.

### Criterios de aceptación

- Nunca se divide una población externa entre empleados propios.
- Un periodo con cero registradas y tres anuladas informa las tres.
- Treinta días que cruzan mes producen puntos diarios.
- Labels y rankings cambian con la dirección y describen la población real.
- Actualizar fechas conserva la pestaña.

---

## Issue 11 — Reestructurar carga e hidratación del Dashboard Admin

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:refactor`, `area:dashboard`, `performance`, `database`,
`priority:P1`

**Depende de:** issues 01 y 10.

### Plan técnico

- Separar el dashboard en Server Components para banner, métricas y rankings.
- Aislar Recharts en una isla cliente y cargarla de forma diferida si mejora el
  bundle medido.
- Introducir Suspense granular para módulos independientes.
- Medir las cinco consultas actuales.
- Evaluar:
  - CTE base reutilizado.
  - Una o dos sentencias con agregados.
  - Índices parciales por dirección/estado sólo si el plan lo justifica.
- Evitar que el conteo de pendientes del layout bloquee el contenido.

### Presupuestos sugeridos

- Feedback visual del cambio de dirección: `<100ms`.
- p95 del cambio con caché caliente y red acordada: `<800ms`.
- Reducción comprobable del JS inicial del dashboard.

### Criterios de aceptación

- Rankings estáticos no se hidratan sólo porque existe un gráfico.
- Cada módulo lento puede mostrar su fallback sin borrar el resto.
- El PR incluye planes/timings antes y después.
- No se añade un índice sin evidencia y prueba de escritura/almacenamiento.

---

## Issue 12 — Rediseñar por completo Dashboard Admin

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:enhancement`, `area:dashboard`, `ui`, `platform:desktop`,
`data-visualization`, `priority:P1`

**Depende de:** issues 04, 07, 10 y 11.

### Composición propuesta

1. Banner degradado con nombre, empresa, periodo y síntesis contextual.
2. Control de dirección y selector de periodo con presets.
3. Cuatro métricas con semántica adaptada.
4. Gráfico dominante con insight textual.
5. Rankings secundarios realmente útiles para la dirección.
6. Operaciones recientes con el patrón del Dashboard Vendedor.
7. Estado de anuladas visible pero secundario.

### Criterios de aceptación

- En `≥1024px` la jerarquía es banner → controles → métricas → gráfico →
  desgloses → recientes.
- Nombre y empresa aparecen en banner.
- Cada bloque tiene estado vacío independiente.
- El gráfico mide al menos 280px en desktop, tiene tooltip exacto y labels
  legibles.
- No hay textos operativos inferiores a 12px.
- Claro, oscuro, nombres largos, montos grandes y reduced motion cubiertos.
- Se crea skeleton específico alineado con la composición final.

---

## Issue 13 — Habilitar Auditoría de empresa para ADMIN_EMPRESA

**Prioridad:** P1  
**Tamaño:** M  
**Labels:** `type:bug`, `permissions`, `area:audit`, `priority:P1`

### Evidencia

- Contrato: `docs/PLAN.md:88-90`, `docs/03-API.md:446-455`.
- Auditoría restringida: `auditoria/page.tsx:21-25` y
  `modules/auditoria/query.ts:40-47`.

### Alcance

- Autorizar `ADMIN_EMPRESA` a consultar Auditoría de su propia empresa.
- Forzar alcance por `actor_empresa_id` en SQL, no sólo en UI.
- Mantener verificación de integridad sólo para superadmin.
- Actualizar navegación, documentación y tests.
- Conservar `/usuarios` y todas sus operaciones exclusivamente para
  `SUPERADMIN`.

### Criterios de aceptación

- Admin A no puede leer eventos de la empresa B aun manipulando la URL.
- Superadmin conserva Auditoría global y gestión exclusiva de Usuarios.
- Vendedor sigue sin acceso.
- Página, query, actions, nav y docs usan la misma matriz.

---

## Issue 14 — Rediseñar la primitive Dialog para desktop

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:refactor`, `area:modals`, `ui`, `animation`, `accessibility`,
`platform:desktop`, `priority:P1`

**Depende de:** issue 04.

### Alcance

- Variantes `form`, `confirm`, `detail`, `secret`.
- Anchos orientativos `440–760px` según variante.
- Overlay más legible, radio `24px`, sombra flotante y ring.
- Layout interno de tres regiones:
  - Header fijo.
  - Body desplazable.
  - Footer fijo/sticky.
- Header con icono/tono, título `20–24px` y descripción `14px`.
- Acciones de `44–48px`; cierre mínimo `36px` con label “Cerrar”.
- Apertura/cierre coherentes y reduced motion.
- API para bloquear cierre durante pending y para detectar cambios sin guardar.
- Tokens de z-index coordinados con popovers, toast y aviso PWA.

### Criterios de aceptación

- A `720px` de alto, las acciones de un formulario largo permanecen visibles.
- No hay doble scrollbar ni recorte de popovers.
- Escape, exterior, X y retorno de foco funcionan según estado.
- Durante pending no se desmonta el formulario accidentalmente.
- Claro/oscuro y zoom `200%` cubiertos.

---

## Issue 15 — Migrar formularios y detalles al nuevo sistema modal

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:refactor`, `area:modals`, `ui`, `accessibility`,
`priority:P1`

**Depende de:** issue 14.

### Inventario de migración

- Cambiar contraseña.
- Empleado: crear, editar, detalle.
- Sede: crear, editar.
- Empresa: crear, editar.
- Convenio: crear, editar, cambiar descuentos.
- Usuario: crear, editar.

### Trabajo adicional

- Actualizar `SelectorAsincrono` a combobox ARIA completo.
- Usar `fieldset/legend` en opciones de dirección de descuentos.
- Asociar errores con `aria-invalid` y `aria-describedby`.
- Enfocar el primer error del body.
- Evitar parpadeo al pasar detalle → editar/rechazar.
- Añadir confirmación de descarte sólo cuando existan cambios.

### Criterios de aceptación

- Flechas/Enter/Escape operan los selectores sin cerrar el modal.
- Carga y “sin resultados” se anuncian.
- Éxito cierra, refresca, muestra toast y restaura foco.
- Error mantiene abierto y enfoca el campo relevante.
- Cada formulario usa ancho y columnas adecuados; no reduce controles para caber.

---

## Issue 16 — Centralizar confirmaciones destructivas, secretos y aviso PWA

**Prioridad:** P1  
**Tamaño:** M  
**Labels:** `type:refactor`, `area:modals`, `accessibility`, `ui`,
`priority:P1`

**Depende de:** issue 14.

### Alcance

- Crear primitive `ConfirmarDestructivo` para:
  - Rechazar empleado.
  - Anular venta.
  - Desactivar/reactivar usuario.
- Usar `alertdialog` cuando corresponda.
- Foco inicial seguro o en motivo, nunca en confirmar destrucción.
- Motivo con contador y error accesible.
- Mostrar consecuencia concreta y entidad afectada.
- Migrar restablecimiento y contraseña temporal a variante `secret`.
- Anunciar “Contraseña copiada” mediante live region.
- Reclasificar el aviso PWA como notificación no modal o diálogo real; ocultarlo
  mientras exista un modal y coordinar capas.

### Criterios de aceptación

- Las tres confirmaciones comparten estructura, reglas de cierre y estados.
- Una cadena destructiva nunca usa estilo de éxito.
- Copiar contraseña tiene feedback visual y auditivo.
- No se superponen aviso PWA y modal.

---

## Issue 17 — Reemplazar skeletons genéricos del resto de rutas

**Prioridad:** P2  
**Tamaño:** L  
**Labels:** `type:enhancement`, `area:skeletons`, `responsive`, `priority:P2`

**Depende de:** layouts finales de Dashboard, Ventas, Modales y catálogos.

### Rutas

- `/dashboard`, `/ventas`, `/empleados`, `/sedes`, `/usuarios`.
- `/admin/empresas`, `/admin/convenios`.
- `/ventas/[id]`, `/login`, `/auditoria`, `/perfil`, `/perfil/password`.
- Loading raíz antes de conocer rol.

### Enfoque

- Skeleton por página o familia real, no `tabla/formulario/detalle` abstractos.
- Reusar clases estructurales del contenido.
- Añadir `aria-busy`, texto accesible y decoraciones `aria-hidden`.
- Capturas de skeleton y final lado a lado.

### Criterios de aceptación

- Ninguna vista de cards muestra una tabla durante carga.
- Mismos breakpoints y número de columnas.
- CLS menor de `0.1` por ruta priorizada.
- Reduced motion conserva contenido estable sin shimmer animado.

---

## Issue 18 — Validar y sanear search params de vistas administrativas

**Prioridad:** P1  
**Tamaño:** M  
**Labels:** `type:bug`, `data`, `area:audit`, `area:sales`, `priority:P1`

### Problema

Varias páginas castean strings de URL a enums o aceptan combinaciones
incompatibles. En Auditoría, `sp.accion` puede llegar a PostgreSQL sin validación.

### Alcance

- Esquemas de URL para Ventas, Dashboard, Auditoría y tabs de Empleados.
- Invalidar o normalizar fechas imposibles, enums, UUID, cursores y rangos.
- Eliminar filtros incompatibles al cambiar dirección.
- Mantener una función única por ruta para serializar/deserializar URL.

### Criterios de aceptación

- Querystring inválida nunca produce 500.
- La URL canónica conserva sólo valores aplicables.
- Tests incluyen acción de auditoría inválida, cursor corrupto, rango invertido,
  dirección desconocida e IDs mal formados.

---

## Issue 19 — Optimizar permisos, payload y verificación de Auditoría

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:refactor`, `area:audit`, `performance`, `permissions`,
`database`, `priority:P1`

**Depende de:** issues 01, 13 y 18.

### Alcance

- Alcance SQL por `actor_empresa_id` para admin empresa.
- Listado liviano sin snapshots completos.
- Cargar detalle/diff al expandir y memorizarlo.
- Verificación de integridad con estados `idle/pending/success/broken/error`.
- Evaluar verificación por lotes con progreso/último ID para no cargar toda la
  cadena de una vez.
- Paginación reversible o acumulación real.

### Criterios de aceptación

- Payload inicial no depende del tamaño de 100 snapshots JSON.
- Abrir un evento no calcula los otros.
- Botón de verificar se deshabilita durante ejecución.
- Una rotura nunca se pinta verde.
- Admin empresa no puede inferir eventos de otra empresa.

---

## Issue 20 — Rediseñar Auditoría como timeline operativa

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:enhancement`, `area:audit`, `ui`, `accessibility`,
`platform:desktop`, `priority:P1`

**Depende de:** issues 04, 18 y 19.

### Composición

- Cabecera sobria con estado de integridad para superadmin.
- Filtros por rango/preset, familia/acción, actor, entidad e ID.
- Chips activos y limpiar filtros.
- Timeline invertida agrupada por día.
- Mapa de familias: sesión, venta, empleado, usuario, configuración y acceso.
- Frase humana principal; IDs/enums como metadata secundaria.
- Hora formateada explícitamente en `America/Lima`.
- Diff “Antes / Después” con labels amigables y valores largos plegados.

### Criterios de aceptación

- Cada evento se entiende sin abrir JSON.
- Agrupación por día y hora no cambian entre SSR e hidratación.
- La acción es identificable por icono, texto y color semántico.
- Filtros completos son operables por teclado.
- Empty, loading, broken, error y success tienen componentes distintos.

---

## Issue 21 — Pulir Empleados y corregir alcance de filtros/exportación

**Prioridad:** P1  
**Tamaño:** L  
**Labels:** `type:bug`, `area:employees`, `ui`, `data`, `priority:P1`

### Alcance funcional

- Llevar actividad y orden a URL/SQL para todo el padrón.
- Exportar desde servidor aplicando filtros completos; indicar alcance del CSV.
- Eliminar selección múltiple hasta tener acción real o añadir una acción
  autorizada.
- Implementar historial de cursores y rangos reales.
- Combinar agregados 30d si el plan demuestra mejora.

### Pulido visual

- Adoptar header/métricas/primitives comunes.
- Elevar textos operativos de 10–11px a mínimo legible.
- Mantener personalidad actual de tabla, tabs y stats sin rehacer la pantalla.
- Estados mediante tokens semánticos y tema oscuro.

### Criterios de aceptación

- “Mayor compra” ordena todo el conjunto filtrado.
- CSV coincide con el universo anunciado.
- Página posterior muestra rango y regreso correctos.
- No existe checkbox sin consecuencia operativa.

---

## Issue 22 — Pulir Sedes y añadir contexto de empresa

**Prioridad:** P2  
**Tamaño:** M  
**Labels:** `type:enhancement`, `area:sites`, `ui`, `performance`, `priority:P2`

### Alcance

- Añadir empresa ID/nombre a la fila para superadmin.
- Filtro por empresa, estado y búsqueda.
- Cursor si el volumen lo requiere.
- Badge activo con `success`.
- Alinear acción al pie de cards de distinta altura.
- Mantener las dos métricas y cards existentes como base.

### Criterios de aceptación

- Dos sedes llamadas “Principal” se distinguen por empresa.
- Superadmin puede acotar el universo.
- La página no necesita renderizar todas las sedes del sistema.
- Cards mantienen alturas/acciones alineadas con nombres/direcciones largos.

---

## Issue 23 — Pulir Empresas y optimizar enriquecimiento por página

**Prioridad:** P2  
**Tamaño:** M  
**Labels:** `type:enhancement`, `area:companies`, `ui`, `database`,
`priority:P2`

### Alcance

- Paginar empresas base y enriquecer sólo esos IDs, condicionado a mejora medida.
- Filtro activo/inactivo.
- RUC monoespaciado.
- Estado activo con `success`.
- Truncado/tooltip de nombre y razón social.
- Acciones alineadas al pie.
- Sustituir “Cargar más” por paginación reversible o acumulación real.

### Criterios de aceptación

- El costo de agregados se relaciona con la página visible.
- Las cards no desbordan con textos largos.
- El verbo de paginación describe el comportamiento real.

---

## Issue 24 — Pulir Convenios y aclarar bidireccionalidad

**Prioridad:** P2  
**Tamaño:** M  
**Labels:** `type:enhancement`, `area:agreements`, `ui`, `database`,
`priority:P2`

### Alcance

- Cambiar A → B del título por representación bidireccional.
- Mantener las dos condiciones explícitas.
- “Sin descuento vigente” con warning en vez de `—`.
- Filtros por empresa, vigencia y estado.
- Traducir enums.
- Alinear acciones al pie.
- Agregar ventas 30d sólo a la página base si mejora el plan.
- Paginación reversible o acumulación real.

### Criterios de aceptación

- Ningún usuario interpreta el convenio como unidireccional.
- Falta de término es un estado explicado.
- Ningún enum interno se presenta directamente.

---

## Issue 25 — Pulir Usuarios, filtros y jerarquía de acciones

**Prioridad:** P2  
**Tamaño:** M  
**Labels:** `type:enhancement`, `area:users`, `ui`, `permissions`, `priority:P2`

**Depende de:** issues 15–16.

### Alcance

- Exponer filtros ya soportados: rol, empresa y activo.
- Acción principal visible; secundarias y destructivas en menú agrupado.
- Texto “Cambio de contraseña pendiente”.
- Estado activo con `success`.
- Paginar usuarios base antes de enriquecer métricas, si la medición lo valida.
- Paginación reversible o acumulación real.
- Mantener guards de página, queries y actions exclusivos de `SUPERADMIN`.

### Criterios de aceptación

- La acción destructiva queda separada y requiere confirmación común.
- `ADMIN_EMPRESA` y `VENDEDOR` no pueden abrir ni operar `/usuarios`.
- Cards mantienen jerarquía con nombres y usernames largos.
- Filtros sobreviven a paginación y URL compartida.

---

## Issue 26 — Cerrar rediseño con regresión visual, accesibilidad y presupuestos

**Prioridad:** P1 para release  
**Tamaño:** M  
**Labels:** `type:test`, `ui`, `accessibility`, `performance`,
`platform:desktop`, `priority:P1`

**Depende de:** todos los issues incluidos en la release.

### Matriz mínima

- Roles: vendedor, admin empresa, superadmin.
- Viewports: `1024×768`, `1280×800`, `1440×900`, `1920×1080`.
- Tema: claro/oscuro.
- Movimiento: normal/reduced.
- Datos: vacío, normal, 25 filas, nombres largos, importes grandes, sólo anuladas.
- Modales: corto, largo, destructivo, secreto, pending y error.

### Criterios de aceptación

- Sin regresiones visuales no aprobadas.
- Axe sin violaciones críticas/serias en alcance.
- Toda acción principal operable con teclado.
- Sin scroll horizontal en `body`.
- Skeleton → contenido con CLS menor de `0.1` en rutas objetivo.
- Feedback de tabs menor de `100ms`.
- Comparación p50/p95 y bundle frente al baseline del issue 01.
- `npm run typecheck`, `npm run lint`, `npm run format:check` y tests relevantes
  pasan.

## 4. Decisiones de producto que deben resolverse al crear issues

1. **Monto en Ventas:** total pagado recomendado frente a bruto.
2. **Permisos:** Usuarios permanece exclusivo de `SUPERADMIN`; Auditoría se
   habilita para `ADMIN_EMPRESA` sólo dentro de su propia empresa.
3. **Compras Admin:** ocultar vendedor/sede o permitir filtrar los externos.
4. **VisorAdjunto:** implementar la promesa del design system o retirarla de la
   documentación.
5. **Paginación:** elegir historial reversible o acumulación real; no llamar
   “Cargar más” a un reemplazo de página.

## 5. Definition of Done común

- Implementación respeta `docs/09-GUIA-REDISENO-UI-DESKTOP.md`.
- No introduce texto operativo inferior a 12px ni controles primarios menores de
  44px.
- Claro, oscuro, teclado y reduced motion verificados.
- Skeleton corresponde a la geometría final.
- Estados vacío, pending, error y éxito incluidos.
- Capturas y evidencia de pruebas adjuntas al PR.
- Cambios de query incluyen tests de aislamiento por rol/empresa.
- Cambios de rendimiento incluyen medición antes/después.
- Documentación local actualizada si cambian primitives, permisos o semántica.
