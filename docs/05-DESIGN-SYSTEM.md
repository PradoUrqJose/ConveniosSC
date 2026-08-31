# 05 — Sistema de diseño

Base **shadcn/ui** sobre **Tailwind CSS v4**. Neutro y sobrio, tema claro y oscuro (D24).
La app es multiempresa: no lleva la marca de ninguna.

La especificación visual e interactiva de diálogos vive en
[`14-LINEA-DISENO-MODALES.md`](./14-LINEA-DISENO-MODALES.md). Es obligatoria
para todo modal nuevo o modificado.

---

## 1. Tokens de color

En `src/app/globals.css`. Valores en OKLCH, que es lo que usa shadcn/ui con Tailwind v4.
Estos son los valores reales del código — el rediseño desktop los oscureció
ligeramente hacia azul respecto a una primera versión neutra; **no se
reintroducen los valores antiguos** (ver §12, contradicción «Colores/tokens»).

```css
:root {
  --background:          oklch(0.982 0.006 245);
  --foreground:           oklch(0.215 0.035 252);
  --card:                oklch(1 0 0);
  --card-foreground:     oklch(0.145 0 0);
  --popover:             oklch(1 0 0);
  --popover-foreground:  oklch(0.145 0 0);

  --primary:             oklch(0.49 0.18 251);   /* azul */
  --primary-foreground:  oklch(0.985 0 0);

  --secondary:           oklch(0.955 0.014 247);
  --secondary-foreground:oklch(0.29 0.045 251);
  --muted:               oklch(0.952 0.011 247);
  --muted-foreground:    oklch(0.51 0.035 252);
  --accent:              oklch(0.943 0.024 239);
  --accent-foreground:   oklch(0.28 0.06 250);

  --destructive:         oklch(0.577 0.245 27.3);
  --destructive-foreground: oklch(0.985 0 0);

  --success:             oklch(0.55 0.14 155);
  --success-foreground:  oklch(0.985 0 0);
  --warning:             oklch(0.72 0.16 75);
  --warning-foreground:  oklch(0.145 0 0);

  --border:              oklch(0.9 0.018 248);
  --input:               oklch(0.88 0.02 248);
  --ring:                oklch(0.49 0.18 251);

  --radius: 0.75rem;
}

.dark {
  --background:          oklch(0.16 0.025 254);
  --foreground:          oklch(0.985 0 0);
  --card:                oklch(0.205 0.03 254);
  --card-foreground:     oklch(0.985 0 0);
  --popover:             oklch(0.205 0.03 254);
  --popover-foreground:  oklch(0.985 0 0);

  --primary:             oklch(0.7 0.145 245);
  --primary-foreground:  oklch(0.145 0 0);

  --secondary:           oklch(0.265 0.032 252);
  --secondary-foreground:oklch(0.985 0 0);
  --muted:               oklch(0.265 0.03 252);
  --muted-foreground:    oklch(0.708 0 0);
  --accent:              oklch(0.29 0.045 250);
  --accent-foreground:   oklch(0.985 0 0);

  --destructive:         oklch(0.65 0.2 25);
  --destructive-foreground: oklch(0.985 0 0);

  --success:             oklch(0.68 0.14 155);
  --success-foreground:  oklch(0.145 0 0);
  --warning:             oklch(0.78 0.15 75);
  --warning-foreground:  oklch(0.145 0 0);

  --border:              oklch(1 0 0 / 12%);
  --input:               oklch(1 0 0 / 15%);
  --ring:                oklch(0.65 0.15 250);
}
```

La app también define `--brand`/`--brand-on-dark` (isotipo + wordmark
«Convenios», fijo, independiente del tema) y una paleta `.venta-shell` local a
Nueva Venta — ambos en `globals.css`, no se documentan aquí como tokens
generales porque no gobiernan el resto de la UI.

### Semántica de color — no improvisar

| Significado | Token | Se usa en |
|---|---|---|
| Acción principal | `primary` | Guardar venta, Ingresar, botón de nueva venta |
| Éxito / activo | `success` | Estado `ACTIVO`, venta registrada, chip de descuento |
| Advertencia | `warning` | `PENDIENTE_VERIFICACION`, `requiereRevision`, banner offline |
| Destructivo | `destructive` | Anular, rechazar, desactivar, errores de validación |
| Neutro / inactivo | `muted` | Estado `INACTIVO`, campos read-only, texto auxiliar |

Los estados **nunca** se comunican solo por color: siempre llevan texto o ícono.

### Tema
El toggle escribe en `localStorage` y aplica la clase `.dark` en `<html>`. Valor inicial:
`prefers-color-scheme`. El script anti-parpadeo va inline en el `<head>`, antes de la hidratación.

---

## 2. Tipografía

Fuentes del sistema. Sin descargas: la app se usa en móviles con datos limitados.

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
```

| Uso | Clases | Notas |
|---|---|---|
| Título de página | `text-2xl font-semibold tracking-tight` | |
| Título de sección | `text-lg font-semibold` | |
| Etiqueta de campo | `text-sm font-medium` | |
| Cuerpo | `text-base` (16 px) | **Nunca menos de 16 px en inputs**: iOS hace zoom automático por debajo |
| Auxiliar | `text-sm text-muted-foreground` | |
| Micro | `text-xs text-muted-foreground` | Solo metadatos |
| **Importes** | `font-mono tabular-nums` | Obligatorio: alinea las columnas de dinero |
| DNI, RUC, username | `font-mono` | |

---

## 3. Espaciado y layout

- Escala de Tailwind por defecto. Múltiplos de 4 px.
- Padding horizontal de página: `px-4` en móvil, `px-6` en tablet, `px-8` en escritorio.
- Separación entre secciones de formulario: `space-y-6`. Entre campos: `space-y-4`.
- Ancho máximo de contenido: `max-w-2xl` en formularios; el shell general
  (`.page-shell`) usa `max-w-[1480px]`, y cada módulo decide su propio ancho
  útil dentro de ese máximo.
- Breakpoints: `sm 640` · `md 768` · `lg 1024` (aparece el sidebar; el
  rediseño desktop se diseña a partir de `lg`) · `xl 1280`.

### Alturas fijas
| Elemento | Altura |
|---|---|
| Header | 56 px |
| Tab bar móvil | 64 px + `env(safe-area-inset-bottom)` |
| Barra de acción fija (guardar) | 56 px + safe area |
| Input y botón estándar | 44 px |
| Botón primario de formulario | 48 px |
| Botón «Nueva venta» del inicio | 64 px |

---

## 4. Componentes de shadcn/ui a instalar

```
button  input  label  textarea  select  checkbox  switch  form
card  badge  alert  separator  skeleton  avatar
dialog  sheet  drawer  popover  dropdown-menu  tooltip
table  tabs  calendar  date-picker  sonner (toasts)
chart  scroll-area  accordion
```

## 5. Componentes propios (`src/components/`)

| Componente | Responsabilidad |
|---|---|
| `<CampoMonto>` | Input de dinero. `inputmode="decimal"`, prefijo `S/`, formatea al perder el foco, emite céntimos. |
| `<CampoDocumento>` | DNI/CE, input accesible y casillas visuales en escritorio. Solo busca al pulsar el botón. |
| `<CampoArchivo>` | Arrastrar/archivo en escritorio; archivo/cámara en móvil; compresión, miniatura, progreso y eliminación. |
| `<VisorAdjunto>` | Modal a pantalla completa con zoom por pellizco. PDF en pestaña nueva. |
| `<Importe>` | Renderiza céntimos como texto. Props: `valor`, `signo?`, `tamaño?`. Siempre `tabular-nums`. |
| `<EstadoBadge>` | Badge por estado de venta o empleado. Mapa de color y texto centralizado aquí. |
| `<SelectorPeriodo>` | Presets + rango personalizado. Sincroniza con la URL. |
| `<PanelFiltros>` | `Sheet` en móvil, `Popover` en escritorio. Genérico sobre un esquema de filtros. |
| `<EstadoVacio>` | Ícono, título, descripción, acción opcional. |
| `<StatTile>` | Métrica del dashboard con variación y flecha. |
| `<ListaCursor>` | Listado paginado por cursor con «Cargar más» y skeletons. |
| `<ConfirmarDestructivo>` | Diálogo con motivo obligatorio. Se usa en anular y rechazar. |

### Altura de controles hermanos

Inputs, fechas y selects de una misma fila deben usar la misma altura. Para un
`SelectTrigger` de formulario se usa `size="lg"`; no se intenta corregirlo solo
con `h-*`, porque el selector interno `data-size` tiene mayor especificidad. El
tamaño compacto del buscador de documento es una excepción responsive y debe
aplicarse con `lg:data-[size=lg]:h-*`.

---

## 6. Patrones móviles obligatorios

| Patrón | Regla |
|---|---|
| **Teclado correcto** | `inputmode="numeric"` en DNI y teléfono, `inputmode="decimal"` en montos, `autocapitalize="words"` en nombres, `autocapitalize="off"` en username. |
| **Zoom de iOS** | Ningún input con `font-size` menor a 16 px. |
| **Alcance del pulgar** | Las acciones primarias van en la mitad inferior de la pantalla. |
| **Barra fija** | El botón de guardar de un formulario largo va en una barra fija inferior, no al final del scroll. |
| **Safe area** | `padding-bottom: env(safe-area-inset-bottom)` en toda barra inferior. |
| **Doble pulsación** | Todo botón que envía se deshabilita mientras la acción está en curso. |
| **Sin hover** | Ninguna información aparece solo en `:hover`. Los tooltips también se abren con tap. |
| **Scroll horizontal** | Prohibido en el `body`. Las tablas anchas van dentro de un contenedor con `overflow-x: auto`. |
| **Autofocus** | Solo en el primer campo accionable: usuario en login, DNI en nueva venta. |

---

## 7. Escritura de la interfaz

- **Español de Perú**, tuteo. «Registra tu venta», no «Registre su venta».
- Mensajes de error que digan **qué hacer**, no solo qué falló.
  - Mal: «Error de validación».
  - Bien: «El monto no puede superar S/ 50,000. Si la venta es mayor, coordina con tu administrador.»
- Botones con verbo en infinitivo: «Guardar venta», «Crear empleado», «Anular».
- Nada de jerga técnica visible: nunca «UUID», «token», «endpoint», «payload», «null».
- Números: separador de miles con coma, decimal con punto (`S/ 1,234.50`).
- Fechas: `dd/mm/aaaa` en la UI. `03/08/2026`.
- Horas: formato 24 h. `14:32`.
- Fechas relativas solo para menos de 24 h: «hace 2 horas». Más allá, fecha absoluta.
- El DNI siempre se muestra completo, sin enmascarar: es el dato con el que se opera.

---

## 8. Íconos

`lucide-react`, tamaño 20 px en línea y 24 px en navegación.

| Concepto | Ícono |
|---|---|
| Nueva venta | `plus-circle` |
| Ventas | `receipt` |
| Empleados | `users` |
| Usuarios | `user-cog` |
| Empresas | `building-2` |
| Convenios | `handshake` |
| Sedes | `store` |
| Dashboard | `layout-dashboard` |
| Auditoría | `history` |
| Cámara | `camera` |
| Archivo | `paperclip` |
| Buscar | `search` |
| Filtros | `sliders-horizontal` |
| Anular | `ban` |
| Verificar | `check-circle-2` |
| Rechazar | `x-circle` |
| Advertencia | `alert-triangle` |
| Tema | `sun` / `moon` |

---

## 9. Gráficos

Componente `chart` de shadcn/ui (Recharts). Antes de escribir cualquier gráfico, seguir la skill
**`dataviz`**.

Reglas mínimas para este proyecto:
- Serie temporal: barras si son ≤ 31 puntos, área si son más.
- Eje Y de importes en miles con sufijo `k` y prefijo `S/`.
- Tooltip con el valor exacto formateado, nunca el número crudo.
- Un solo color de serie por defecto; usar categorías solo en el desglose por convenio.
- Los gráficos deben legibles en tema claro y oscuro: los colores vienen de variables CSS,
  nunca hardcodeados.
- Altura mínima 200 px en móvil, 280 px en escritorio.

---

## 10. Primitives y tokens del rediseño desktop

Estabilizados en `src/components/shell/pagina-ui.tsx` y
`src/app/globals.css`. Se documentan aquí porque ya están usados y
verificados (tipos, lint y tests en verde) en al menos una pantalla real —
ver `docs/09-GUIA-REDISENO-UI-DESKTOP.md` para el razonamiento visual
completo detrás de cada uno.

### 10.1 Primitives (`src/components/shell/pagina-ui.tsx`)

| Componente | Responsabilidad | Referencia |
|---|---|---|
| `<CabeceraPagina>` | Cabecera de página: kicker, título, descripción y acciones. | `empleados-client.tsx`, `ventas-client.tsx` |
| `<HeroPagina>` | Hero de apertura con gradiente, kicker y acción de alto contraste. Reservar para cabeceras de alto valor (Dashboard, Inicio Vendedor); no convertir cada card en un banner. | `app/(app)/page.tsx` |
| `<PanelSuperficie>` | `.surface-panel` con cabecera y pie opcionales; el cuerpo no impone padding propio. | — |
| `<Metrica>` | Card de métrica con icono, tono semántico y valor fluido. | `page.tsx`, `empleados-client.tsx` |
| `<EstadoBadge>` | Badge de estado centralizado: `tono` (`success`/`warning`/`destructive`/`neutral`) sigue la semántica de color de §1. Reemplaza los mapas de color ad hoc que existían por pantalla. | `ventas-client.tsx`, `empleados-client.tsx` |
| `<EncabezadoOrdenable>` + `ariaSortDe` | Encabezado de columna ordenable con icono Lucide (no flechas de texto) y `aria-sort` correcto en el `<th>`. | `ventas-client.tsx` |
| `<EstadoVacio>` | Ícono, título, descripción y acción opcional. | — |
| `<IndicadorPendienteSuperficie>` | Overlay de carga sobre una superficie con contenido; atenúa en vez de borrar. | `ventas-client.tsx` |

### 10.2 Tokens (`src/app/globals.css`)

```css
/* Elevación — tres niveles, sin variante oscura (no son color) */
--shadow-elevation-1   /* superficie en reposo: Metrica, cards */
--shadow-elevation-2   /* hover de esa misma superficie */
--shadow-elevation-3   /* flotante: hero, modal, popover */

/* Duración / easing */
--duration-fast   /* 160ms */
--duration-base   /* 220ms */
--duration-slow   /* 300ms */
--ease-standard   /* cubic-bezier(0.22, 1, 0.36, 1) */

/* Radios por rol, sobre la escala --radius-* de shadcn/ui */
--radius-panel     /* 24px: surface-panel */
--radius-control    /* ~17px: inputs, selects, botones de formulario */
--radius-modal      /* 28px: Dialog desktop, ver línea específica de modales */

/* Superficies propias de formulario modal */
--modal-field
--modal-field-hover
--modal-shadow

/* Capas de apilamiento */
--z-pwa      /* 30 */
--z-overlay  /* 50 */
--z-modal    /* 51 */
--z-popover  /* 52: debe quedar sobre el modal portalizado */
--z-toast    /* 60 */
```

Utilities: `elevation-normal` y `elevation-hover` (aplicadas juntas) dan la
sombra + desplazamiento de hover de una superficie; `elevation-floating` es
de un solo nivel. Ambas respetan `prefers-reduced-motion`: la transición se
desactiva y el hover deja de desplazar la superficie, conservando solo el
cambio de sombra.

Los tokens de capas de apilamiento (`--z-*`) están definidos para que los
primitives de modal/popover/toast y el aviso PWA se coordinen sobre ellos;
la migración de esos componentes existentes es responsabilidad de sus
propios issues de rediseño, no de este documento.

### 10.3 Estado de las contradicciones de `docs/09-GUIA-REDISENO-UI-DESKTOP.md` §10

| Tema | Resolución |
|---|---|
| Radio base | `--radius: 0.75rem` (§1 arriba ya actualizado). |
| Ancho de contenido | `.page-shell` usa `max-w-[1480px]`; cada módulo acota su propio ancho dentro de ese máximo (§3 arriba). |
| Aparición de sidebar | `lg` (§3 arriba). El rediseño desktop se diseña desde `lg`. |
| Fuentes | La fuente global sigue siendo del sistema; Nueva Venta puede seguir usando una familia local justificada por flujo (`.venta-shell`), sin generalizarla al resto de la app. |
| Colores/tokens | Los valores actuales de `globals.css`, más azulados que la primera versión, son la fuente de verdad (§1 arriba). |
