# Guía de rediseño UI Desktop

## 1. Propósito y alcance

Esta guía traduce a reglas reutilizables las dos referencias aprobadas para el
rediseño desktop:

1. El Dashboard Vendedor (`/`), especialmente su banner, métricas y listado de
   ventas recientes.
2. Nueva Venta (`/ventas/nueva`), especialmente sus tarjetas de pasos, controles
   amplios, resumen lateral y jerarquía tipográfica.

Es una guía específica para las fases descritas en
`docs/10-PROPUESTAS-ISSUES-UI-DESKTOP.md`. No reemplaza todavía a
`docs/05-DESIGN-SYSTEM.md`; antes de hacerlo hay que implementar, validar
visualmente y estabilizar los nuevos componentes.

La auditoría se hizo sobre JSX, CSS, consultas y breakpoints. No se pudieron
obtener capturas del render porque el entorno no tenía un navegador conectado.
Por eso, cada issue visual incluye validación posterior en viewport desktop.

## 2. Fuentes de verdad observadas

| Referencia | Implementación principal | Qué se toma como guía |
|---|---|---|
| Dashboard Vendedor | `src/app/(app)/page.tsx` | Hero con identidad, cards de métricas, panel de actividad reciente y densidad general |
| Métricas y superficies | `src/components/shell/pagina-ui.tsx` y `src/app/globals.css` | Radios, sombras, ring, color semántico y estados vacíos |
| Nueva Venta | `src/app/(app)/ventas/nueva/form-venta.tsx` | Controles de tamaño cómodo, tarjetas por bloque, resumen sticky y feedback de estado |
| Layout Nueva Venta | `src/app/(app)/layout.tsx` | Ancho útil desktop, columna principal y lateral |
| Paleta Nueva Venta | `.venta-shell` en `src/app/globals.css` | Jerarquía local de azul, papel, línea, hueco y grises |

## 3. Principios rectores

### 3.1 Personalidad sin ruido

- Cada pantalla debe tener un foco visual claro, no una sucesión de rectángulos
  del mismo peso.
- El gradiente se reserva para cabeceras de alto valor o resúmenes principales.
  No se debe convertir cada card en un banner.
- La identidad cotidiana proviene de la combinación de radio, profundidad,
  iconografía, color semántico y buena jerarquía.

### 3.2 Legibilidad antes que densidad

- El texto operativo normal debe estar entre `14px` y `16px`.
- `12px` se reserva para metadatos, etiquetas o ayudas breves.
- No usar `10px` u `11px` para contenido que el usuario tenga que leer o comparar.
- Inputs y selects desktop deben conservar al menos `44px` de alto; los
  formularios destacados pueden usar `52–58px`.
- Los importes usan `font-mono` y `tabular-nums`.

### 3.3 Espacio con intención

- Separación entre secciones principales: `24–28px` en desktop.
- Separación dentro de paneles: `16–24px`.
- Padding de paneles desktop: `20–28px` según densidad.
- Las acciones relacionadas permanecen cerca; filtros, métricas y resultados no
  deben parecer módulos desconectados.

### 3.4 Profundidad moderada

- Las superficies principales usan fondo `card/90`, ring sutil y sombra baja.
- El hover puede elevar hasta `2px` y aumentar levemente la sombra.
- Una tabla debe sentirse contenida en un panel, no dibujada directamente sobre
  el fondo de la página.
- Las sombras grandes se reservan para hero, modal y elementos flotantes.

### 3.5 Movimiento funcional

- Duración estándar para estados y hover: `160–240ms`.
- Entrada o cambio de bloque: `220–300ms`.
- Curva recomendada: `cubic-bezier(0.22, 1, 0.36, 1)` para desplazamientos y
  `ease-out` para opacidad.
- Animar `opacity` y `transform`; evitar transiciones de propiedades que fuerzan
  relayout cuando no sean necesarias.
- Con `prefers-reduced-motion: reduce`, eliminar desplazamientos y conservar sólo
  cambios instantáneos o fades muy cortos.

## 4. Anatomía visual aprobada

### 4.1 Banner o hero de apertura

Patrón observado en `src/app/(app)/page.tsx:49`:

- Gradiente diagonal desde `primary` hacia azul profundo.
- Radio de `28px` en desktop.
- Padding aproximado de `28–36px`.
- Sombra inferior amplia y suave.
- Textura o halo de baja opacidad, siempre decorativo y sin competir con el
  contenido.
- Kicker pequeño, título dominante y descripción secundaria.
- Acción principal blanca o de alto contraste cuando corresponda.

Uso recomendado:

- Dashboard Admin: sí, como resumen del periodo y contexto de la organización.
- Mis Ventas y Ventas Admin: no es obligatorio; la personalidad debe concentrarse
  en el panel de resultados.
- Auditoría: usar una cabecera más sobria orientada a estado e integridad.

### 4.2 Cards de métricas

Patrón observado en `src/components/shell/pagina-ui.tsx:95`:

- Radio de `20px`.
- Fondo `card/90`, ring fino y sombra baja.
- Icono en tile de `36px` con tono semántico.
- Etiqueta secundaria, valor dominante y detalle opcional.
- Grid de dos columnas que escala a cuatro, sin reducir el texto para forzar el
  encaje.

Regla: las métricas deben responder una pregunta concreta. No mostrar cero como
estado vacío cuando “sin datos” sea semánticamente distinto.

### 4.3 Paneles

Basarse en `.surface-panel` (`src/app/globals.css:234`):

- Radio objetivo `24px`.
- Cabecera del panel separada por borde cuando tenga acciones o contexto.
- Padding horizontal `24px` desktop.
- Ring sutil para conservar definición en tema claro y oscuro.
- El contenido puede usar divisores internos; no envolver cada fila en otra card.

### 4.4 Formularios y controles

Patrón observado en Nueva Venta:

- Contenedores de formulario: radio `24–26px`.
- Inputs normales: radio `14–18px`, altura `44–58px`.
- Campos de monto o resultado principal: hasta `72px`, cifra de `24–28px`.
- Focus visible con borde `primary` y halo exterior, nunca sólo cambio de color.
- Labels de `13–14px`, `font-semibold`.
- Texto de ayuda de `13–14px`, con instrucción accionable.
- Botón principal de formularios importantes: `52–58px`.

## 5. Patrón de tabla desktop

La tabla rediseñada debe combinar la claridad de una tabla con la personalidad de
las ventas recientes:

### Contenedor

- Un único `.surface-panel` con cabecera, tabla y paginación integradas.
- Cabecera contextual con título, cantidad, orden actual y acciones secundarias.
- `overflow-x-auto` dentro del panel, nunca en `body`.

### Encabezado

- Altura aproximada de `48px`.
- Fondo tonal suave, no gris plano opaco.
- Etiquetas de `12px`, peso 700 y contraste suficiente.
- Orden interactivo con icono Lucide y foco visible; no usar flechas de texto
  `↑/↓` como único indicador.

### Filas

- Altura objetivo `68–76px`.
- La entidad principal agrupa avatar/tile, nombre y documento.
- Fechas, empresas y sedes se presentan como información secundaria coherente,
  no como nueve columnas con el mismo peso.
- Importes alineados a la derecha y con números tabulares.
- El total final debe dominar sobre bruto y descuento.
- Estados usan texto más icono o punto, nunca sólo color.
- La fila completa puede ser clicable, pero debe conservar navegación por teclado
  y una acción explícita accesible.
- Hover tonal y transición de `160–200ms`.

### Estado pendiente

- Conservar dimensiones de columnas y filas.
- Atenuar contenido previo o superponer skeletons con baja opacidad.
- No borrar la tabla para mostrar un loader aislado.

## 6. Pestañas de dirección

Aplicable a Dashboard Admin y Ventas Admin.

- Usar un único componente compartido con semántica de tabs (`tablist`, `tab`,
  `aria-selected`) o navegación equivalente correctamente anunciada.
- Alto mínimo `44px`; texto `14px`, peso 600.
- Contenedor redondeado con padding interno de `4–6px`.
- Indicador activo compartido que se desplace mediante `transform`, no dos fondos
  que aparecen y desaparecen.
- Actualizar el indicador de forma optimista al pulsar.
- Durante la navegación, conservar el contenido anterior atenuado y mostrar
  actividad discreta en la pestaña seleccionada.
- Prefetch de ambos destinos cuando sea técnicamente seguro.
- Teclado: flechas para cambiar foco cuando se implemente como tabs; Enter/Espacio
  para activar.
- Reducir movimiento a cambio instantáneo de fondo con
  `prefers-reduced-motion`.

## 7. Sistema de modales desktop

La especificación estabilizada y vinculante de esta sección está en
[`14-LINEA-DISENO-MODALES.md`](./14-LINEA-DISENO-MODALES.md). La referencia
aprobada es el modal de Nuevo empleado; cualquier evolución del patrón se
documenta primero allí.

### 7.1 Variantes

| Variante | Uso | Ancho desktop orientativo |
|---|---|---|
| `form` | Crear o editar entidades | `660px` |
| `confirm` | Anular, rechazar, desactivar, reactivar | `480px` |
| `detail` | Resumen de empleado u otra entidad | `608px` |
| `secret` | Contraseña temporal o dato sensible de una sola lectura | `496px` |

### 7.2 Anatomía

- Overlay `black/42` con blur de `6px`.
- Radio desktop de `28px`.
- Sombra amplia, con borde/ring sutil.
- Header con kicker de `11px`, título de `26–27px` y descripción de `14.5px`.
- Lavado azul de `240px`; los iconos acompañan discretamente al kicker y no se
  presentan como otra card.
- Cuerpo desplazable independiente.
- Footer fijo o sticky dentro del modal, separado por borde; las acciones no deben
  desaparecer al hacer scroll.
- Botón de cierre de al menos `36px`, label accesible en español y foco visible.
- Formularios largos pueden usar dos columnas desde `sm`, sin comprimir campos.

### 7.3 Movimiento

- Overlay: fade `220ms`; salida `170ms`.
- Contenido: fade + `translateY(18px)` + escala `0.965`, `420ms` con
  `cubic-bezier(.16,1,.3,1)`.
- Salida: `translateY(6px)`, escala `0.985` y `170ms`.
- Los campos entran con rise de `10px` y stagger de `45ms`.
- El origen visual debe ser estable en el centro; evitar saltos entre bottom-sheet
  y modal dentro de viewports desktop.
- Deshabilitar cierre accidental mientras una mutación irreversible está en curso,
  si la primitive lo permite, y explicar el estado.

### 7.4 Destructivos

- Icono y encabezado destructivos, sin convertir todo el modal en rojo.
- Explicar entidad afectada y consecuencia.
- Confirmación primaria con verbo específico: “Anular venta”, “Rechazar empleado”.
- Cancelar queda disponible y visualmente secundario.
- Si se pide motivo, mostrar contador, validación inline y ayuda concreta.

## 8. Skeletons

Un skeleton no es un formulario genérico: debe reproducir la geometría estable de
la pantalla final.

- Mismos breakpoints, columnas, radios, alturas y separaciones que el contenido.
- Las piezas decorativas se simplifican, pero la distribución no cambia.
- Dashboard Vendedor: hero + cuatro métricas + panel con cabecera y cinco filas.
- Nueva Venta desktop: header + tres tarjetas en columna principal + resumen
  lateral de `372px`.
- Dashboard Admin rediseñado: hero/filtros + tabs + métricas + módulos de datos.
- Conservar el shimmer actual de `1.4s` y su regla de reduced motion; el problema
  actual es de composición.
- Criterio de éxito: ausencia de salto de layout visible al sustituir el skeleton.

## 9. Tema oscuro y accesibilidad

- Toda superficie nueva debe validarse en claro y oscuro.
- Los colores de estado parten de tokens semánticos; no introducir colores raw sin
  equivalente oscuro.
- Contraste mínimo WCAG AA para texto operativo.
- Focus visible en tabs, filas accionables, botones de orden y cierre de modal.
- No comunicar estado únicamente con color.
- Objetivos interactivos de al menos `36px` en desktop; `44px` cuando sean acciones
  primarias o frecuentes.
- Modales: foco inicial intencional, focus trap de la primitive, retorno de foco al
  disparador y cierre con Escape salvo durante estados bloqueados documentados.

## 10. Contradicciones con documentación anterior

Antes de actualizar `docs/05-DESIGN-SYSTEM.md`, los issues deben resolver estas
diferencias entre documento y código:

| Tema | Documento anterior | Implementación de referencia actual | Decisión para este rediseño |
|---|---|---|---|
| Radio base | `0.625rem` | `0.75rem`, con paneles de `20–28px` | Usar la jerarquía implementada; documentarla al estabilizar |
| Ancho de contenido | `max-w-7xl` | `1480–1600px` en shell desktop | Mantener shell amplio y limitar cada módulo según su función |
| Aparición de sidebar | `md` | `lg` | Diseñar desktop desde `lg` |
| Fuentes | Sólo sistema | Nueva Venta usa `next/font` local al flujo | Mantener fuente global del sistema; permitir familias locales justificadas |
| Nueva Venta | Documento antiguo sin pasos | Implementación con tres pasos visuales | Tratar la implementación aprobada como referencia |
| Colores/tokens | Valores iniciales neutros | Tokens actuales más azulados en `globals.css` | No reintroducir los valores antiguos |

## 11. Lista de verificación visual por PR

- Viewports mínimos: `1024×768`, `1280×800`, `1440×900` y `1920×1080`.
- Tema claro y oscuro.
- Datos normales, nombres largos, importes grandes, lista vacía y lista con 25
  filas.
- Estado normal, hover, focus, pending, success y error.
- `prefers-reduced-motion` activo.
- Zoom del navegador al `200%` sin pérdida de acciones.
- Sin scroll horizontal en `body`.
- Comparación de skeleton y contenido final en el mismo viewport.
- Capturas de regresión de las superficies principales y de cada variante modal.
