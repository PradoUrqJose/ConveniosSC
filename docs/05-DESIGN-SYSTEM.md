# 05 — Sistema de diseño

Base **shadcn/ui** sobre **Tailwind CSS v4**. Neutro y sobrio, tema claro y oscuro (D24).
La app es multiempresa: no lleva la marca de ninguna.

---

## 1. Tokens de color

En `src/app/globals.css`. Valores en OKLCH, que es lo que usa shadcn/ui con Tailwind v4.

```css
:root {
  --background:          oklch(1 0 0);
  --foreground:          oklch(0.145 0 0);
  --card:                oklch(1 0 0);
  --card-foreground:     oklch(0.145 0 0);
  --popover:             oklch(1 0 0);
  --popover-foreground:  oklch(0.145 0 0);

  --primary:             oklch(0.45 0.15 250);   /* azul */
  --primary-foreground:  oklch(0.985 0 0);

  --secondary:           oklch(0.97 0 0);
  --secondary-foreground:oklch(0.205 0 0);
  --muted:               oklch(0.97 0 0);
  --muted-foreground:    oklch(0.556 0 0);
  --accent:              oklch(0.97 0 0);
  --accent-foreground:   oklch(0.205 0 0);

  --destructive:         oklch(0.577 0.245 27.3);
  --destructive-foreground: oklch(0.985 0 0);

  --success:             oklch(0.55 0.14 155);
  --success-foreground:  oklch(0.985 0 0);
  --warning:             oklch(0.72 0.16 75);
  --warning-foreground:  oklch(0.145 0 0);

  --border:              oklch(0.922 0 0);
  --input:               oklch(0.922 0 0);
  --ring:                oklch(0.45 0.15 250);

  --radius: 0.625rem;
}

.dark {
  --background:          oklch(0.145 0 0);
  --foreground:          oklch(0.985 0 0);
  --card:                oklch(0.205 0 0);
  --card-foreground:     oklch(0.985 0 0);
  --popover:             oklch(0.205 0 0);
  --popover-foreground:  oklch(0.985 0 0);

  --primary:             oklch(0.65 0.15 250);
  --primary-foreground:  oklch(0.145 0 0);

  --secondary:           oklch(0.269 0 0);
  --secondary-foreground:oklch(0.985 0 0);
  --muted:               oklch(0.269 0 0);
  --muted-foreground:    oklch(0.708 0 0);
  --accent:              oklch(0.269 0 0);
  --accent-foreground:   oklch(0.985 0 0);

  --destructive:         oklch(0.65 0.20 25);
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
- Ancho máximo de contenido: `max-w-2xl` en formularios, `max-w-7xl` en listados y dashboard.
- Breakpoints: `sm 640` · `md 768` (aparece el sidebar) · `lg 1024` · `xl 1280`.

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
