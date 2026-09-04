# Primitivas táctiles, inputs y movimiento reducido — issue #55 (PWA-MOB-05)

Continúa `docs/17-TOKENS-GEOMETRIA-MOVIL.md` (#51),
`docs/18-SHELL-MOVIL-CABECERAS.md` (#52),
`docs/19-BARRA-INFERIOR-MOVIL.md` (#53) y `docs/20-CAPAS-MOVILES.md` (#54),
y consume sus tokens. Especificación de diseño:
`docs/sistema-diseno-mobile (1).md` §6 y §9.

Este issue cierra la base del sistema móvil: es el último de los que
bloquean las migraciones de pantalla.

## El problema

La inspección a 390px encontró controles propios de 16, 20, 28, 30, 32 y
40px: los enlaces "Ver cambios" de auditoría medían 16px de alto y las
acciones de fila de empleados, empresas, convenios y usuarios 28px
(`size="icon-sm"` heredado del escritorio). Además había campos con
`text-sm` escrito a mano en cinco pantallas de filtros, que por debajo de
16px hacen que Safari iOS haga zoom al enfocar y deje el formulario
descuadrado.

## Las dos mitades de la solución

El issue pide dos cosas distintas y conviene no confundirlas.

### 1. Red de seguridad: geometría para lo que ya existe

En `src/app/globals.css`, dentro del `@media (max-width: 1023.98px)` del
#51 pero **fuera de `@layer components`**:

- `min-height: 44px` (y `min-width` donde el contenido puede ser solo un
  ícono) sobre todo control: `button`, `select`, `input`, `textarea`,
  `summary`, los roles de menú/tab/radio y los `data-slot` de las
  primitivas compartidas.
- `font-size: 1rem` sobre todo campo de formulario.

Va sin capa a propósito: las utilidades de Tailwind viven en su propia
capa y le ganan a cualquier regla puesta en `components`, así que un `h-6`
o un `text-sm` de una pantalla vieja volvería a dejar el target de 24px o
el campo de 14px. Se fija `min-height` y nunca `height`: el control crece
hasta el mínimo y sigue pudiendo ser más grande.

**Checkbox y switch quedan fuera** de esas dos reglas (Base UI los
renderiza como `<button>`, así que las habrían agarrado): la casilla mide
16px y el riel 20px por diseño, y estirarlos los convierte en otra cosa.
Su área táctil se extiende a 44x44 con el `::after` que ya traían de
escritorio — el ícono puede ser menor, el hit area no. Los tests miden
`max(caja, ::after)` justamente por eso.

**Escape hatches**, los dos grepeables y ambos usados solo donde el
elemento no es un objetivo táctil:

| Marca | Para qué |
|---|---|
| `data-toque="compacto"` | El elemento no es un target (chevron interno de un popup, cierre de un toast que ya trae el suyo). |
| `data-texto="propio"` | El campo necesita otro tamaño de texto. Siempre mayor que 16px, nunca menor. |

### 2. Primitivas: semántica para lo que se va a escribir

`src/components/ui/controles-movil.tsx` — las variantes móviles que pide el
issue. La red de seguridad arregla la geometría; esto arregla lo que una
hoja de estilos no puede:

| Componente | Qué garantiza |
|---|---|
| `BotonMovil` | `<button>` nativo con `type` explícito, tonos primario/secundario/terciario/destructivo, estado `pendiente` con `aria-busy`. |
| `BotonIconoMovil` | 44x44 con `etiqueta` **obligatoria**: un glifo sin nombre accesible no existe para VoiceOver ni TalkBack. |
| `EnlaceAccionMovil` | Se ve como control, por dentro es un `<a>`/`<Link>` real. |
| `DisparadorMenuMovil` | El `<button>` nativo que Base UI espera en `render`, con `aria-haspopup` correcto. |
| `CampoMovil` | Etiqueta persistente, 16px, 44px, ayuda y error enlazados por `aria-describedby` + `aria-invalid`. |
| `SelectorMovil` | `<select>` nativo: la rueda del sistema le gana a cualquier popup propio en un teléfono. |

Ninguno declara `:hover`. Tailwind v4 ya emite el variante `hover:` dentro
de `@media (hover: hover)`, así que en un dispositivo táctil esas reglas ni
se declaran; lo que faltaba —y es lo que agrega este issue— era el
`:active` equivalente, que se pinta en el mismo frame del toque.

Los cuatro estados que el issue exige que existan sin depender del puntero:

- **pressed** — `:active` con `scale(0.94–0.97)` y cambio de superficie.
- **focus-visible** — anillo propio de 2px de acento con offset, global
  por debajo de 1024px.
- **disabled** — opacidad, sin `pointer-events: none`: un control
  deshabilitado tiene que seguir recibiendo el toque para poder explicar
  por qué no se puede usar.
- **pendiente** — `data-pendiente` + `aria-busy`. El control conserva
  tamaño y etiqueta y el spinner se suma; no lo sustituye, porque
  reemplazar el texto encoge el botón y mueve el layout justo después del
  toque.

## Movimiento reducido, ahora global

Antes cada componente traía su propio bloque `prefers-reduced-motion`
(modal, skeleton, elevación, barra inferior, sheet). Funciona mientras
alguien se acuerde de escribirlo. Ahora hay una **política global** en
`globals.css`: con la preferencia activada nada se anima (`1ms`, no `0s`,
para que los `transitionend`/`animationend` de los que dependen las capas
de Base UI sigan disparándose), el shimmer y los spinners se apagan del
todo, y los bloques por componente quedan como documentación del caso
particular.

Auditoría de duraciones: todas las transiciones y animaciones del proyecto
caen ya dentro de la banda 100–500ms (`--duration-fast` 160ms,
`--duration-base` 220ms, `--duration-slow` 300ms, `--mob-duration` 200ms,
sheet y diálogo 420ms). Fuera de la banda quedan solo dos bucles
decorativos —el shimmer del esqueleto (1.4s) y el caret del campo de DNI
(1.05s)—, que la política global apaga.

## Cambios puntuales de semántica y de campo

- **`DatePicker`**: por debajo de 1024px se usa el `<input type="date">`
  nativo. La rejilla de react-day-picker es el único control al que no se
  le puede dar 44x44 por geometría (7 columnas × 44 = 308px, que a 320px
  con el padding del popover no entran), y el selector nativo respeta
  `min`/`max`, ya es accesible y es el gesto que el usuario tiene
  aprendido. El corte es por CSS, no por `useEsMovil()`, para que el HTML
  del servidor traiga los dos y no haya un frame con el control
  equivocado. El `<input>` oculto que envía el valor no cambia: el
  formulario es idéntico.
- **`Input`/`Textarea`**: el `md:text-sm` pasó a `lg:text-sm`, y la regla
  de 15px de los campos dentro de un diálogo (línea visual de escritorio,
  `docs/14-LINEA-DISENO-MODALES.md`) arranca ahora en 1024px y no en
  640px. Entre 640 y 1023px eran campos de 15px en un teléfono en
  horizontal.
- **`--mob-destructivo`**: el `--destructive` del modo oscuro es un rojo
  claro (L 0.65) pensado para texto y bordes; como fondo de un botón con
  texto blanco daba 3.56:1 y no pasaba AA. El token móvil baja a L 0.58 —
  mismo tono y saturación— y llega a 4.74:1, sin tocar el token de
  escritorio. Lo encontró el test de contraste, no el ojo.
- **Formularios**: `autoComplete` (`given-name`, `family-name`,
  `tel-national`), `inputMode` y ayudas enlazadas por `aria-describedby`
  en el alta de empleados; `autoComplete="off"` en el username del alta de
  usuarios, donde el autocompletado ofrecería el del administrador que
  está creando la cuenta.

## Verificación

| Qué | Dónde | Cómo se corre |
|---|---|---|
| Contraste claro/oscuro de cada par del sistema | `src/lib/contraste-movil.test.ts` (lee los tokens reales del CSS con `src/lib/color.ts`) | `npm test` |
| Semántica de botón: cero `render={<Link/>}`, cero `nativeButton={false}`, `type` explícito | `src/lib/semantica-controles.test.ts` | `npm test` |
| Bounding boxes ≥44x44 en 15 rutas a 320/390/430, campos ≥16px, consola sin avisos, axe, teclado, reduced motion, escritorio intacto | `e2e/primitivas-tactiles-movil.spec.ts` | `E2E_BASELINE=1 E2E_BASELINE_SUPERADMIN_USER=… E2E_BASELINE_SUPERADMIN_PASSWORD=… npx playwright test e2e/primitivas-tactiles-movil.spec.ts --project=mobile` |
| Referencia visual de los controles | `/estilo-movil` (solo SUPERADMIN) | manual / capturas |

Pendiente de dispositivo físico: VoiceOver y TalkBack en los flujos
críticos, y la comprobación de que Safari iOS efectivamente no hace zoom
(el test mide el `font-size`, que es la causa; el zoom es el efecto).

## Cómo lo consumen las migraciones

Una pantalla migrada usa `controles-movil.tsx` y las clases `.mob-*`, no
`Button size="icon-sm"` ni `<input class="text-sm">`. La red de seguridad
está para que lo que todavía no se migró no sea inaccesible mientras
tanto; no es el destino. Si aparece un control que necesita una primitiva
que no existe, se agrega a `controles-movil.tsx` y su piel al mismo
`@media` de `globals.css`, para que seguir aislado del escritorio sea
automático y no una disciplina manual.
