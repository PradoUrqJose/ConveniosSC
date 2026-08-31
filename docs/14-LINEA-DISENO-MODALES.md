# Línea de diseño de modales

Esta es la fuente de verdad visual y de interacción para todos los diálogos de
Convenios. Nace de la referencia aprobada de **Nuevo empleado** y complementa
las reglas generales de `05-DESIGN-SYSTEM.md` y
`09-GUIA-REDISENO-UI-DESKTOP.md`.

La implementación canónica vive en:

- `src/components/ui/dialog.tsx`: estructura y API.
- `src/app/globals.css`: tokens, movimiento y estilos compartidos.
- `src/app/(app)/empleados/form-empleado.tsx`: composición de formulario de
  referencia.

No se deben crear modales independientes con overlay, focus trap o keyframes
propios. Siempre se compone sobre `Dialog` y sus regiones.

## 1. Personalidad

El modal debe sentirse ligero, preciso y claramente separado de la pantalla sin
parecer otra aplicación:

- Superficie limpia con radio amplio de `28px`.
- Lavado azul superior que desaparece antes de llegar al cuerpo.
- Kicker pequeño en mayúsculas, título fuerte y descripción breve.
- Campos sin borde visible en reposo, sobre una superficie azul-gris suave.
- Acciones tipo píldora y una sola acción dominante.
- Profundidad concentrada en el panel, no en cada control.

Los colores siempre parten de los tokens del tema. Los valores de la referencia
visual no se copian como hexadecimales dentro de componentes.

## 2. Anatomía obligatoria

```text
DialogContent
├── DialogHeader    kicker + título + descripción + cerrar
├── DialogForm
│   ├── cuerpo desplazable y escalonado
│   └── DialogFooter progreso opcional + acciones
└── DialogBody      alternativa sin formulario
```

- Sólo el cuerpo se desplaza.
- Header y footer permanecen visibles en una ventana de `720px` de alto.
- El popup usa `overflow: hidden`; select, popover y tooltip se portalizan sobre
  la capa modal.
- El footer está separado por un único borde superior y conserva fondo de
  superficie.

## 3. Variantes y anchos

| Variante | Uso | Ancho canónico |
|---|---|---:|
| `form` | Crear o editar entidades | `660px` |
| `confirm` | Confirmar acciones sensibles | `480px` |
| `detail` | Consultar una ficha | `608px` |
| `secret` | Contraseñas y datos de una sola lectura | `496px` |

El ancho nunca obliga a reducir controles por debajo de sus medidas. A zoom
`200%`, el popup se limita al viewport y el cuerpo conserva su propio scroll.

## 4. Cabecera y lavado de identidad

- Padding desktop: `26px 30px 20px`.
- El lavado ocupa `240px` desde el borde superior y combina un radial en la
  esquina superior izquierda con un degradado vertical.
- Kicker: `11px`, peso `700`, tracking `0.18em`, mayúsculas.
- Título: `26–27px`, peso `800`, tracking `-0.025em`.
- Descripción: `14.5px`, color secundario, máximo `56ch`.
- El icono semántico es opcional y, cuando existe, acompaña discretamente al
  kicker. No se usa como una card dominante.

Kickers recomendados:

| Área | Kicker |
|---|---|
| Empleados | `Afiliación al convenio` / `Gestión de empleados` |
| Usuarios | `Gestión de accesos` |
| Empresas | `Directorio empresarial` |
| Convenios | `Gestión de convenios` |
| Ventas | `Gestión de ventas` |
| Contraseñas | `Seguridad de cuenta` / `Credencial temporal` |

## 5. Movimiento

El movimiento tiene entrada expresiva y salida rápida:

| Elemento | Entrada | Salida |
|---|---|---|
| Overlay | fade `220ms ease` | fade `170ms ease` |
| Panel | `420ms cubic-bezier(.16,1,.3,1)` | `170ms cubic-bezier(.4,0,1,1)` |
| Panel: posición | `translateY(18px) scale(.965)` | `translateY(6px) scale(.985)` |
| Campos | rise `10px`, `380ms`, inicio `90ms` + stagger de `45ms` | sin coreografía propia |
| Cerrar | giro de `90deg`, `200ms` en hover | — |

Base UI mantiene montado el contenido durante la transición de salida. No se
deben añadir temporizadores de montaje en cada modal.

`DialogForm` aplica `animation-fill-mode: both` a cada hijo conceptual directo:
el retardo es `90 + índice × 45ms`. Nombres y apellidos se agrupan en un solo
hijo porque forman una misma unidad; no se escalonan sus columnas por separado.

Con `prefers-reduced-motion: reduce`, todas las duraciones bajan a `1ms`, se
elimina el stagger y la X no gira.

## 6. Campos y formularios

- Altura base: `54px`.
- Radio: `16px`.
- Fondo: `--modal-field`; hover: `--modal-field-hover`.
- Reposo sin borde visible.
- Focus: superficie `popover` e inset de `2px` con `primary`.
- Texto: `15px` en desktop y `16px` en móvil para impedir el zoom automático
  de iOS; los datos técnicos usan `font-mono`.
- Labels: `13px`, peso `600`, color secundario.
- Ayudas: `12–13px`, concretas y próximas al control.
- Separación vertical de bloques: `22px`.

### Documento de empleado

- DNI se representa con ocho celdas de `54px`, tipografía mono y foco en la
  celda activa.
- CE usa un único campo mono; no se muestran tipos que el modelo de datos no
  soporte.
- El cambio DNI/CE es un control segmentado accesible (`radiogroup`). Un único
  indicador de superficie se desplaza con `transform` entre ambas opciones; el
  contenido asociado entra con un fade-rise breve.
- El input real conserva `name`, `required`, `inputMode` y semántica de foco.

### Consentimiento

- Se presenta como un bloque de radio `20px`.
- El estado seleccionado cambia a una superficie azul suave.
- La explicación legal se expande dentro del bloque y respeta reduced motion.
- Nunca se reemplaza el checkbox real por un elemento puramente visual.

## 7. Footer y acciones

- Padding desktop: `18px 30px 22px`.
- Botones de al menos `48px` y radio píldora.
- Cancelar usa superficie neutra con línea sutil.
- La acción primaria usa `primary` y sombra azul corta.
- Una acción destructiva usa `destructive`; el modal completo no se tiñe rojo.
- Active desplaza `1px` y escala a `.99`.
- Disabled elimina sombra y no debe parecer accionable.
- El footer es una fila real al final de `DialogForm`: no usa `sticky`, márgenes
  negativos ni padding compensatorio. Sólo el cuerpo situado encima hace scroll.

`DialogProgress` es opcional. Se usa cuando existen requisitos breves y
objetivos, como los cuatro pasos de Nuevo empleado; no se inventa progreso en
formularios donde no aporta comprensión.

## 8. Comportamiento y accesibilidad

- La primitive gestiona focus trap, Escape, exterior y retorno de foco.
- La X mide `40px`, tiene nombre accesible `Cerrar` y foco visible.
- `pending` bloquea Escape, exterior, X y botones de cierre para no desmontar una
  mutación en curso.
- `hasUnsavedChanges` intercepta el intento de cierre y lo comunica mediante
  `onCloseAttempt`.
- El estado no se comunica sólo con color: siempre hay texto o icono.
- No hay textos operativos menores a `12px`.
- Claro, oscuro, reduced motion y zoom `200%` son parte de la definición de
  terminado.

## 9. API de composición

```tsx
<DialogContent variant="form" pending={pendiente}>
  <DialogHeader eyebrow="Gestión de convenios">
    <DialogTitle>Crear convenio</DialogTitle>
    <DialogDescription>Descripción breve y accionable.</DialogDescription>
  </DialogHeader>

  <DialogForm>
    {/* Cada hijo directo es una unidad conceptual animada. */}
    <CampoEmpresa />
    <CampoDocumento />
    <GrupoNombreYApellido />
    <DialogFooter>{/* acciones */}</DialogFooter>
  </DialogForm>
</DialogContent>
```

Para detalles o secretos sin formulario se usa `DialogBody` entre header y
footer. Las acciones siempre viven en `DialogFooter`.

## 10. Lista de revisión

- `1024×720`, `1280×800`, `1440×900` y zoom `200%`.
- Tema claro y oscuro.
- Entrada, salida, Escape, exterior, X y retorno de foco.
- Normal, focus, invalid, disabled y pending.
- Footer visible con formulario largo.
- Popovers y selects por encima del panel, sin recorte.
- Sin scrollbar doble ni scroll horizontal del documento.
- Reduced motion sin desplazamientos ni giros.
