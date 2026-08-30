# Auditoría de UI Desktop

## 1. Objetivo

Este documento localiza y describe los problemas encontrados antes del
rediseño. Cubre:

- Mis Ventas del vendedor.
- Dashboard y Ventas de administrador.
- Pestañas de ventas y compras.
- Todos los modales que pueden aparecer en desktop.
- Auditoría.
- Detalles a pulir en Empleados, Sedes, Empresas, Convenios y Usuarios.
- Skeletons, con foco en Dashboard Vendedor y Nueva Venta.
- Causas probables de latencia que afectan la percepción del cambio de vistas.

Las propuestas convertibles en issues se encuentran en
`docs/10-PROPUESTAS-ISSUES-UI-DESKTOP.md`. Las reglas visuales extraídas de las
referencias están en `docs/09-GUIA-REDISENO-UI-DESKTOP.md`.

## 2. Método y límites

Se revisaron rutas, Server y Client Components, estilos globales, primitives de
UI, loading states, queries y documentación funcional. También se contrastó la
implementación con las guías locales de Next.js 16.3 para navegación, prefetch,
`loading.tsx` y streaming.

No había navegador conectado al entorno, por lo que no fue posible inspeccionar
el render ni capturar animaciones. Los hallazgos visuales son verificables en el
código, pero las medidas de contraste, CLS, tiempos y fluidez deben confirmarse
en implementación con navegador real. Las hipótesis de base de datos requieren
instrumentación y `EXPLAIN (ANALYZE, BUFFERS)` antes de crear índices.

## 3. Resumen ejecutivo

### Prioridad P1

1. Los skeletons de Dashboard Vendedor y Nueva Venta no representan la geometría
   real y producen un cambio fuerte de layout.
2. Dashboard Admin necesita nueva jerarquía visual, pero también tiene errores de
   datos: pierde la pestaña al cambiar fechas, calcula una adopción inválida en
   “vendidas” y oculta anulaciones cuando no hay registradas.
3. La latencia administrativa no es sólo animación: el layout espera el conteo
   de pendientes antes de mostrar la página, y Dashboard hidrata todo como un
   único Client Component.
4. Ventas Admin muestra filtros propios de vendedor/sede en la dirección
   “compradas”, aunque esas ventas pertenecen a vendedores y sedes externos.
5. La tabla de ventas es visualmente plana y su fila clicable no es operable como
   enlace mediante teclado.
6. “Monto” ordena el total final, mientras la columna muestra monto bruto; el
   resumen también mezcla anuladas sin explicarlo.
7. Los modales desktop comparten una primitive demasiado pequeña, plana y con
   scroll de toda la ventana; los formularios largos pierden header y acciones.
8. Auditoría excluye a `ADMIN_EMPRESA` pese al contrato del producto, descarga
   snapshots completos y comunica mal los estados de verificación.
9. Filtros, orden y exportación de Empleados sólo operan sobre la página visible
    aunque la interfaz parece referirse a todo el padrón.

### Prioridad P2–P3

- Los catálogos de Sedes, Empresas, Convenios y Usuarios ya tienen una base visual
  aceptable, pero necesitan semántica de estados, filtros, paginación y alineación
  más consistentes.
- Muchos loading states genéricos muestran una tabla aunque la pantalla final es
  un grid de cards.
- Varias agregaciones calculan métricas globales antes de limitar la página; hay
  que medir y optimizar con datos representativos.

## 4. Matriz de superficies

| Superficie | Ruta | Implementación principal | Evaluación |
|---|---|---|---|
| Dashboard Vendedor | `/` | `src/app/(app)/page.tsx` | Referencia aprobada; skeleton incorrecto |
| Nueva Venta | `/ventas/nueva` | `src/app/(app)/ventas/nueva/form-venta.tsx` | Referencia aprobada; skeleton desktop incorrecto |
| Mis Ventas | `/ventas`, vendedor | `src/app/(app)/ventas/ventas-client.tsx` | Cabecera/filtros útiles; tabla plana |
| Dashboard Admin | `/dashboard` | `src/app/(app)/dashboard/dashboard-client.tsx` | Rediseño integral y correcciones de datos/rendimiento |
| Ventas Admin | `/ventas`, admin | `src/app/(app)/ventas/ventas-client.tsx` | Tabla plana, filtros direccionales erróneos y tabs lentas |
| Auditoría | `/auditoria` | `src/app/(app)/auditoria/auditoria-client.tsx` | Timeline técnica, filtros incompletos, acceso incompleto |
| Empleados | `/empleados` | `src/app/(app)/empleados/empleados-client.tsx` | Buena base; pulir alcance de filtros/exportación/paginación |
| Sedes | `/sedes` | `src/app/(app)/sedes/sedes-client.tsx` | Buena base; falta contexto de empresa y escalabilidad |
| Empresas | `/admin/empresas` | `src/app/(app)/admin/empresas/empresas-client.tsx` | Buena base; pulido de cards/filtros/paginación |
| Convenios | `/admin/convenios` | `src/app/(app)/admin/convenios/convenios-client.tsx` | Buena base; aclarar bidireccionalidad y estados |
| Usuarios | `/usuarios` | `src/app/(app)/usuarios/usuarios-client.tsx` | Buena base; acceso exclusivo de SUPERADMIN correcto, faltan filtros y jerarquía de acciones |

## 5. Mis Ventas y Ventas Administrador

### SALES-01 — Tabla desktop plana y con jerarquía insuficiente — P1

Ubicación: `src/app/(app)/ventas/ventas-client.tsx:835-968`.

Hallazgos:

- Ocho o nueve columnas tienen un peso visual parecido.
- Nombres en mayúsculas reducen legibilidad (`:915-918`).
- Bruto, descuento y total compiten; el total final no domina.
- Empresa, sede y vendedor se presentan sin agrupación o iconografía.
- `totalAdjuntos` se consulta, pero no aparece en la tabla.
- La fila navega con `onClick` (`:899-903`), no mediante un enlace real con
  semántica y teclado.
- El estado “Registrada” usa un outline neutro y no la semántica de éxito.
- La ordenación usa flechas de texto y no expone `aria-sort`.

Impacto: la tabla cumple como grilla de datos, pero no comparte la identidad del
Dashboard Vendedor ni facilita escaneo rápido.

### SALES-02 — Orden y columna “Monto” no significan lo mismo — P1

Ubicaciones:

- UI: `ventas-client.tsx:876-940`.
- SQL: `src/modules/ventas/query.ts:339-370,466-470`.

La cabecera ordenable “Monto” se ubica sobre el bruto, pero el SQL ordena por
`monto_final_centimos`. Los filtros mínimo/máximo sí comparan bruto. Una misma
palabra tiene tres comportamientos distintos.

### SALES-03 — Resumen agrega anuladas sin aclaración — P1

Ubicaciones: `ventas/page.tsx:72-94`, `ventas/query.ts:489-508` y
`ventas-client.tsx:362-393`.

El estado inicial es `TODAS`. Las cards de monto y descuento suman registradas y
anuladas, aunque sus etiquetas parecen indicadores de operación activa.

### SALES-04 — Filtros incompatibles en “Compraron mis empleados” — P1

Ubicaciones:

- Carga de opciones: `ventas/page.tsx:96-101`.
- Aplicación de filtros: `ventas/query.ts:426-443`.
- Vendedores/sedes propios: `ventas/query.ts:20-32,754-771`.
- Controles: `ventas-client.tsx:608-644`.

En la dirección `compradas`, los vendedores y sedes pertenecen a empresas
externas. La UI ofrece vendedores y sedes de la empresa compradora y luego filtra
las ventas externas con esos IDs; normalmente produce una lista vacía por
construcción.

### SALES-05 — Opciones de empresa no cubren todo el histórico — P2

Ubicaciones: `ventas/page.tsx:96-103` y
`src/modules/empleados/query.ts:531-563`.

El selector usa empresas activas con convenios actualmente vigentes. Una venta
histórica puede permanecer visible cuando su convenio o contraparte ya no
aparece como opción de filtro.

### SALES-06 — Interacciones recalculan datos estables — P1, validar con métricas

Ubicaciones: `ventas/page.tsx:96-101`, `ventas/query.ts:583-615` y
`ventas-client.tsx:135-161`.

Cada búsqueda, orden, paginación o cambio de dirección vuelve a solicitar:

- Resumen agregado completo.
- Página de ventas.
- Empresas para el selector.
- Vendedores propios.
- Sedes propias.

Las opciones se pagan aunque el usuario no abra filtros, y el resumen se repite
al cambiar sólo el cursor.

## 6. Dashboard Administrador

### DASH-01 — Falta jerarquía e identidad — P1

Ubicación: `src/app/(app)/dashboard/dashboard-client.tsx:40-249`.

La pantalla presenta cabecera, fechas, tabs, cuatro métricas, gráfico, cuatro
rankings y adopción con superficies casi equivalentes. No hay un foco visual que
resuma el periodo, nombre al administrador o sitúe su empresa. Frente al
Dashboard Vendedor, la distribución se siente plana y larga.

### DASH-02 — Cambiar fechas elimina la dirección “compradas” — P1

Ubicación: `dashboard-client.tsx:51-77`.

El formulario GET envía `desde` y `hasta`, pero no `dir`. Al pulsar Actualizar
desde `dir=compradas`, la ruta vuelve al valor por defecto `vendidas`.

### DASH-03 — Adopción inválida en “vendidas” — P1

Ubicaciones: `src/modules/metricas/query.ts:95-114` y
`dashboard-client.tsx:226-245`.

En “vendidas”, el numerador cuenta empleados externos que compraron a la empresa,
mientras el denominador cuenta empleados activos propios. El porcentaje mezcla
dos poblaciones incompatibles.

### DASH-04 — Un periodo sólo con anuladas se muestra vacío — P1

Ubicación: `dashboard-client.tsx:38,95-148`.

`vacio` depende de la cantidad de registradas. Si existen anuladas pero ninguna
registrada, desaparecen incluso el aviso y el total de anulaciones.

### DASH-05 — Gráfico con granularidad y continuidad deficientes — P2

Ubicaciones: `metricas/query.ts:88-93` y `dashboard-client.tsx:149-180`.

- Sólo usa días cuando ambas fechas están en el mismo mes.
- Treinta días que cruzan mes pueden convertirse en dos barras mensuales.
- No completa días sin ventas.
- El tipo declara semana, pero la query nunca la usa.
- Las etiquetas ISO y la altura desktop reducen legibilidad.

### DASH-06 — Arquitectura de carga pesada — P1, validar con métricas

Ubicaciones:

- Cinco agregaciones: `src/modules/metricas/query.ts:95-159`.
- Client Component completo: `dashboard-client.tsx:1-21`.
- Bloqueo del layout: `src/app/(app)/layout.tsx:46-50`.

El dashboard ejecuta cinco consultas paralelas sobre el mismo alcance. El
paralelismo es correcto como punto de partida, pero cada consulta vuelve a
recorrer ventas para un agregado distinto. Además, importar Recharts convierte
banner, métricas y rankings en parte del mismo árbol cliente.

La causa transversal más importante está antes de la página: el layout espera
`contarPendientesVerificacion` para poder construir navegación. Según la
convención `loading.tsx` de la versión instalada, el loading del segmento no
cubre trabajo asíncrono del layout del mismo nivel. En consecuencia, una vuelta
de base de datos puede retrasar incluso la aparición del skeleton.

## 7. Pestañas ventas/compras

### TABS-01 — Dos implementaciones y feedback tardío — P1

Ubicaciones:

- Dashboard: `dashboard-client.tsx:79-94`.
- Ventas: `ventas-client.tsx:128-142,245-269`.
- Primitive disponible: `src/components/ui/tabs.tsx`.

Dashboard usa `Link`; Ventas usa botones y `router.push` dentro de
`useTransition`. En Ventas, la selección visual sigue ligada a las props del
servidor, por lo que no cambia hasta que llega la respuesta. Dashboard no tiene
un estado pendiente local. Ninguna versión usa semántica completa de tabs ni un
indicador compartido que se desplace.

La animación por sí sola no resolverá la latencia del layout y las consultas. Se
necesitan dos capas:

1. Feedback optimista en menos de 100 ms.
2. Reducción de trabajo bloqueante y prefetch medido.

## 8. Inventario exhaustivo de modales desktop

Se encontraron 20 experiencias que pueden mostrarse como diálogo o superficie
equivalente en desktop. Catorce implementaciones contienen `DialogContent`; las
variantes crear/editar y activar/desactivar comparten algunas de ellas.

| Área | Experiencia | Disparador/ubicación | Contenido |
|---|---|---|---|
| Global | Cambiar contraseña | `src/components/auth/cambiar-password-dialog.tsx:22-42` | Mismo archivo |
| Global | Aviso de instalación PWA | `src/components/pwa/banner-instalacion.tsx:144-169` | Superficie propia con `role="dialog"` |
| Empleados | Crear empleado | `empleados-client.tsx:484-492` | `empleados/form-empleado.tsx:109-311` |
| Empleados | Ver detalle | `empleados-client.tsx:493-509` | `empleados-client.tsx:752-842` |
| Empleados | Editar empleado | `empleados-client.tsx:510-519` | `empleados/form-empleado.tsx:109-311` |
| Empleados | Rechazar empleado | `empleados-client.tsx:520-527` | `empleados/dialogo-rechazo.tsx:55-103` |
| Sedes | Crear sede | `sedes-client.tsx:136-147` | `sedes/form-sede.tsx:74-150` |
| Sedes | Editar sede | `sedes-client.tsx:136-147` | `sedes/form-sede.tsx:74-150` |
| Empresas | Crear empresa | `admin/empresas/empresas-client.tsx:153-160` | `admin/empresas/form-empresa.tsx:85-262` |
| Empresas | Editar empresa | `admin/empresas/empresas-client.tsx:153-160` | `admin/empresas/form-empresa.tsx:85-262` |
| Convenios | Crear convenio | `admin/convenios/convenios-client.tsx:163-179` | `admin/convenios/form-convenio.tsx:80-249` |
| Convenios | Editar convenio | `admin/convenios/convenios-client.tsx:163-179` | `admin/convenios/form-editar.tsx:67-146` |
| Convenios | Cambiar descuentos | `admin/convenios/convenios-client.tsx:163-179` | `admin/convenios/dialogo-cambiar-termino.tsx:104-210` |
| Usuarios | Crear usuario | `usuarios-client.tsx:241-274` | `usuarios/form-usuario.tsx:124-292` |
| Usuarios | Editar usuario | `usuarios-client.tsx:241-274` | `usuarios/form-usuario.tsx:124-292` |
| Usuarios | Restablecer contraseña | `usuarios-client.tsx:260-267` | `usuarios/dialogo-resetear.tsx:54-94` |
| Usuarios | Desactivar usuario | `usuarios-client.tsx:267-273` | `usuarios/dialogo-desactivar.tsx:58-102` |
| Usuarios | Reactivar usuario | `usuarios-client.tsx:267-273` | `usuarios/dialogo-desactivar.tsx:58-102` |
| Usuarios | Mostrar contraseña temporal | `usuarios-client.tsx:276-285` | `usuarios/dialogo-password.tsx:40-102` |
| Ventas | Anular venta | `ventas/[id]/venta-detalle-client.tsx:235-242` | `ventas/[id]/dialogo-anular.tsx:54-95` |

Fuera del alcance desktop inmediato, pero inventariados:

- Sheet de filtros de Ventas, sólo bajo `lg`:
  `ventas/ventas-client.tsx:305-334`.
- Sheet de revisión de Nueva Venta, sólo móvil:
  `ventas/nueva/form-venta.tsx:969-1042`.
- `Drawer` base completo sin consumidores: `src/components/ui/drawer.tsx`.
- El design system promete un `VisorAdjunto` modal, pero el detalle abre adjuntos
  en pestaña nueva (`ventas/[id]/venta-detalle-client.tsx:193-220`).

### MODAL-01 — Primitive desktop compacta y genérica — P1

Ubicaciones: `src/components/ui/dialog.tsx:26-149`,
`src/components/ui/input.tsx:11-13` y `src/components/ui/button.tsx:23-39`.

- Overlay `black/10`, demasiado tenue sobre vistas densas.
- Popup desktop `rounded-xl`, `p-4`, título base de `16px`.
- Inputs y botones estándar parten de `32px` de alto.
- Los catorce contenidos heredan casi la misma caja sin identidad de operación.
- El botón de cierre es pequeño y el lector lo anuncia como “Close”.

### MODAL-02 — Header y footer desaparecen al hacer scroll — P1

`DialogContent` aplica `overflow-y-auto` a toda la ventana. Afecta en especial los
formularios largos de Empleado, Empresa, Convenio y Usuario. Contexto, errores y
acciones dejan de estar visibles a la vez.

### MODAL-03 — Movimiento inconsistente y sin reduced motion — P1

- Dialog: overlay 100 ms y popup 200 ms.
- Sheet: 150/200 ms.
- Drawer: 450 ms.
- Sólo el shimmer tiene una regla de `prefers-reduced-motion`.

### MODAL-04 — Cierre durante envío o con cambios pendientes — P1

Los roots controlados permiten cierre exterior/Escape y mantienen la X mientras
las acciones están pendientes. Desmontar el contenido puede hacer perder feedback
local, toast o refresh.

### MODAL-05 — Combobox asíncrono incompleto — P1

`src/components/selector-asincrono.tsx:56-107` no implementa roles ARIA de
combobox/listbox, navegación por flechas ni anuncio de carga. Afecta crear
Convenio y Usuario, y su popup puede quedar recortado por el scroll actual.

### MODAL-06 — Confirmaciones destructivas duplicadas — P1

Rechazar empleado, anular venta y desactivar usuario duplican el patrón pese a que
`docs/05-DESIGN-SYSTEM.md` define `ConfirmarDestructivo`. No comparten
`alertdialog`, foco seguro, iconografía ni reglas de motivo.

### MODAL-07 — Aviso PWA compite en la misma capa — P1

El aviso usa `role="dialog"` y `z-50`, pero no es modal, no mueve foco y puede
coexistir con un diálogo real en el mismo nivel de apilamiento.

## 9. Auditoría

### AUDIT-01 — Falta el acceso acotado de ADMIN_EMPRESA — P1

Ubicaciones:

- Guarda de página: `src/app/(app)/auditoria/page.tsx:21-25`.
- Guarda de query: `src/modules/auditoria/query.ts:40-47`.
- Contrato: `docs/03-API.md:446-455` y `docs/PLAN.md:88-90`.

La implementación sólo permite `SUPERADMIN`, mientras el contrato exige que el
administrador vea filas de su empresa y que únicamente la verificación global
quede restringida al superadministrador.

### AUDIT-02 — Timeline técnica y poco escaneable — P1

Ubicación: `auditoria-client.tsx:92-162`.

- No agrupa por día.
- Todas las acciones usan el mismo punto azul.
- Muestra enums y `entidadId` como mensaje principal.
- No traduce eventos a lenguaje humano.
- La zona horaria depende del navegador.
- El diff es una lista plana y expone valores sin tratamiento de datos largos.

### AUDIT-03 — Filtros incompletos y sin validación — P1

Ubicaciones: `auditoria/page.tsx:26-35`,
`auditoria-client.tsx:61-91` y `auditoria/query.ts:12-20,48-55`.

La query soporta actor y entidad ID, pero la UI no. Acción y entidad son texto
libre. `sp.accion` se castea sin validar contra el enum y una URL manipulada puede
terminar en un error SQL.

### AUDIT-04 — Payload y diff eager — P1

Ubicaciones: `auditoria/query.ts:62-86`, `auditoria-client.tsx:113-151` y
`src/lib/audit/diff.ts`.

La primera carga descarga `datos_antes` y `datos_despues` de 50 eventos y calcula
el diff de todos, aunque permanezcan cerrados.

### AUDIT-05 — Verificación sin estados fiables — P1

Ubicaciones: `auditoria-client.tsx:35-59` y
`src/lib/audit/verificar.ts:74-122`.

- El botón no se deshabilita ni muestra progreso.
- No hay manejo visible de excepción.
- Una cadena rota se pinta con estilo verde e icono de éxito.
- La verificación carga y recalcula la cadena completa en una acción.

### AUDIT-06 — “Cargar más” reemplaza la página — P2

Ubicación: `auditoria-client.tsx:21-26,105-109`.

El enlace no agrega eventos; navega a otra página sin mecanismo de regreso ni
conteo. La etiqueta no describe el comportamiento real.

## 10. Pulido de módulos existentes

### Empleados

| ID | Prioridad | Hallazgo | Ubicación |
|---|---|---|---|
| EMP-01 | P1 | Actividad, orden y CSV sólo afectan la página visible, pero se presentan como globales | `empleados-client.tsx:145-208` |
| EMP-02 | P2 | Selección múltiple no tiene acción; sólo puede limpiarse | `empleados-client.tsx:166-180,341-357` |
| EMP-03 | P2 | Anterior siempre deshabilitado y rangos incorrectos en páginas posteriores | `empleados-client.tsx:437-480` |
| EMP-04 | P2 | Agregaciones de 30 días recorren más datos de los necesarios; medir y combinar | `src/modules/empleados/query.ts:391-416,487-513` |
| EMP-05 | P3 | Usa header/stat cards propios en vez de primitives compartidas; hay textos operativos de 10–11px | `empleados-client.tsx:210-260,532-567,633-660` |

### Sedes

| ID | Prioridad | Hallazgo | Ubicación |
|---|---|---|---|
| SITE-01 | P1 | Superadmin ve sedes de todas las empresas sin empresa en el tipo ni en la card | `sedes/page.tsx:41-49`, `sedes/query.ts:8-61` |
| SITE-02 | P2 | Lista completa sin búsqueda, filtro o paginación | `sedes/query.ts:38-52`, `sedes-client.tsx:71-134` |
| SITE-03 | P3 | Estado activo usa badge primario en vez de `success`; acciones de cards no siempre alinean | `sedes-client.tsx:88-131` |

### Empresas

| ID | Prioridad | Hallazgo | Ubicación |
|---|---|---|---|
| COMPANY-01 | P2 | Agregados de usuarios/empleados/convenios se calculan antes de limitar a 20 empresas | `src/modules/empresas/query.ts:47-84` |
| COMPANY-02 | P2 | “Cargar más” reemplaza la lista y no permite volver | `admin/empresas/empresas-client.tsx:137-151` |
| COMPANY-03 | P3 | RUC debería usar mono; estado activo debe usar success; falta filtro activo/inactivo | `admin/empresas/empresas-client.tsx:85-135` |

### Convenios

| ID | Prioridad | Hallazgo | Ubicación |
|---|---|---|---|
| AGREEMENT-01 | P2 | El título usa A → B aunque el convenio es bidireccional | `admin/convenios/convenios-client.tsx:81-120` |
| AGREEMENT-02 | P2 | Ventas 30d se agregan para todos los convenios antes de paginar | `src/modules/convenios/query.ts:49-90` |
| AGREEMENT-03 | P3 | `—` no explica que falta descuento vigente; faltan filtros por empresa/estado/vigencia | `admin/convenios/convenios-client.tsx:97-120` |
| AGREEMENT-04 | P2 | “Cargar más” reemplaza la lista | `admin/convenios/convenios-client.tsx:148-161` |

### Usuarios

| ID | Prioridad | Hallazgo | Ubicación |
|---|---|---|---|
| USER-01 | P2 | Backend soporta empresa/rol/activo; UI sólo busca texto | `usuarios-client.tsx:97-114`, `usuarios/query.ts:46-72` |
| USER-02 | P2 | Hasta cuatro acciones compiten en cada card; destructiva poco separada | `usuarios-client.tsx:192-219` |
| USER-03 | P2 | Métricas de ventas se agregan para todos antes de limitar la página | `usuarios/query.ts:78-103` |
| USER-04 | P3 | “cambiar password” usa anglicismo y estado activo no usa token success | `usuarios-client.tsx:149-171` |

La restricción actual de `/usuarios` y sus queries a `SUPERADMIN` coincide con el
contrato actualizado y debe conservarse con pruebas de autorización.

## 11. Skeletons

La primitive de shimmer (`src/components/ui/skeleton.tsx` y
`src/app/globals.css:172-202`) sí es adecuada y respeta reduced motion. El
problema es la composición genérica de `src/components/page-skeletons.tsx`.

### SKEL-01 — Dashboard Vendedor — P1 urgente

Loading efectivo: `src/app/(app)/loading.tsx` → variante `inicio` en
`page-skeletons.tsx:129-141`.

Actual:

- Cabecera genérica.
- Dos cards.
- Sin banner.
- Sin cuatro métricas.
- Sin ventas recientes.

Real: `src/app/(app)/page.tsx:49-181` contiene hero, cuatro métricas y panel con
cinco ventas.

### SKEL-02 — Nueva Venta desktop — P1 urgente

Loading: `src/app/(app)/ventas/nueva/loading.tsx` → `Formulario` en
`page-skeletons.tsx:44-58`.

Actual: `max-w-2xl`, una columna, un panel y cinco inputs de 36px.

Real: header, estado, grid `1fr + 372px`, tres tarjetas de pasos, campos de
58–72px, adjuntos en dos columnas y resumen sticky
(`form-venta.tsx:446-966`).

### Resto del inventario

| Prioridad | Ruta | Desajuste |
|---|---|---|
| P1 | `/dashboard` | Omite filtros, tabs, rankings y adopción; debe rehacerse después del nuevo layout |
| P1 | `/ventas` | Omite tabs, tres métricas y la geometría real de tabla |
| P1 | `/empleados` | Omite cuatro estadísticas, filtros, tabs y footer |
| P1 | `/sedes` | Muestra tabla, pero la vista final son métricas + cards |
| P1 | `/usuarios` | Muestra tabla, pero la vista final son buscador + cards |
| P1 | `/admin/empresas` | Muestra tabla, pero la vista final es buscador + cards |
| P1 | `/admin/convenios` | Muestra tabla, pero la vista final son cards direccionales |
| P1 | `/ventas/[id]` | No representa hero ni múltiples paneles |
| P1 | `/login` | `400px` frente a layout desktop dividido `max-w-4xl` |
| P2 | `/auditoria` | Tabla con avatares frente a filtros + timeline |
| P2 | `/perfil` | Formulario genérico frente a card de identidad |
| P2 | `/perfil/password` | Formulario genérico frente a card centrada específica |
| P2 | Loading raíz | La variante `inicio` no puede representar el shell antes de conocer el rol |

## 12. Riesgos y decisiones pendientes

1. Habilitar Auditoría para `ADMIN_EMPRESA` con alcance obligatorio a su empresa.
   Usuarios debe permanecer exclusivo de `SUPERADMIN`. Ambos permisos requieren
   tests de aislamiento y autorización.
2. Definir qué valor significa “Monto” en Ventas: bruto o total final.
3. Definir semántica del Dashboard según dirección; no todos los rankings tienen
   sentido en ambas.
4. Medir antes de cachear o crear índices. Los catálogos cambian poco, pero son
   dependientes de rol y empresa y requieren invalidación correcta.
5. Decidir si el visor de adjuntos prometido sigue dentro del producto o si la
   documentación debe eliminarlo.
