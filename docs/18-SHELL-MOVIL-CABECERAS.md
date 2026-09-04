# Shell móvil y cabeceras por pantalla — issue #52 (PWA-MOB-02)

Continúa `docs/17-TOKENS-GEOMETRIA-MOVIL.md` (#51) y consume sus tokens.
Especificación de diseño: `docs/sistema-diseno-mobile (1).md` §1 y §3.

## Qué cambió

Antes, en móvil, un `Header` global sticky ocupaba ~56px + notch en todas
las pantallas con logo, tema y avatar — el mismo chrome para el dashboard y
para el detalle de una venta. Ahora:

- **No hay chrome superior fijo por debajo de 1024px.** El `Header` global
  se eliminó (`src/components/shell/header.tsx`, borrado) y con él el único
  elemento sticky superior del shell.
- **Cada ruta trae su cabecera dentro del contenido** y se va con el scroll.
- **Escritorio (≥1024px) no cambió.** El shell de escritorio nunca renderizó
  ese header —era `lg:hidden`—, así que quitarlo no le quita nada; y la
  cabecera de página de escritorio conserva su marcado intacto, ahora bajo
  `hidden … lg:flex`.

## Las tres cabeceras

`src/components/shell/cabecera-movil.tsx` — `CabeceraMovil`, con `variante`:

| Variante | Cuándo | Contenido |
|---|---|---|
| `raiz` | destinos de la barra inferior | context pill + título + acciones + avatar de cuenta |
| `secundaria` | se llegó desde otra pantalla | back iconográfico + título + acciones |
| `formulario` | flujo concentrado (punto de venta, contraseña) | back + título, sin acciones que compitan con el CTA |

Reglas que impone el componente (y su CSS en `globals.css`, dentro del
`@media (max-width: 1023.98px)` del issue #51):

- **El título nunca se trunca.** `.mob-cabecera-titulo` envuelve
  (`overflow-wrap: anywhere`, `text-wrap: balance`); a 320px un ellipsis se
  come justo el dato que identifica la pantalla.
- **Todo control mide ≥44x44** (`--mob-toque-min`): back, avatar y cada hijo
  de `.mob-cabecera-acciones`.
- **Safe area superior en la cabecera**, no en el `<main>`:
  `padding-top: max(0.75rem, var(--mob-safe-top))`. Los insets laterales
  (landscape con notch) los paga el contenedor del `<main>` en el layout.

## Back con historial y fallback

`BotonAtrasMovil` es un `<a>` real, no un `<button>`: conserva el destino en
el menú contextual y funciona sin hidratar. Si `history.state.idx > 0` (el
índice que mantiene el App Router) intercepta el clic y hace `router.back()`,
preservando scroll y estado de la pantalla anterior. En el arranque en frío
de la PWA standalone `idx` vale 0 y la navegación normal al `href` actúa de
fallback.

## Dónde fueron las acciones del header

Tema, instalación de la PWA y cierre de sesión vivían en el menú del avatar
del header global. Ahora:

- El avatar de las cabeceras raíz lleva a `/perfil`.
- `/perfil` reúne esas acciones en móvil (`AccionesCuentaMovil`, `lg:hidden`).
- En escritorio siguen exactamente donde estaban: el Sidebar.

El context pill (`ContextoMovil`) muestra la empresa del espacio de trabajo
o «Todas las empresas» — solo en cabeceras raíz, donde el alcance cambia la
lectura de los datos. Se apaga en `/perfil` (la empresa ya está en el
contenido) y en formularios.

## Coordinación del borde inferior

Un solo lugar reserva el hueco: `--mob-bottom-bar` (alto de `TabBarMovil`) y
`--mob-cta-flotante` (CTA fijo del punto de venta). La barra consume el mismo
token que el hueco (`.mob-barra-inferior` / `.mob-espacio-inferior`), así que
no pueden desincronizarse. El teclado virtual se resuelve con
`interactiveWidget: "resizes-content"` en el `viewport` raíz: reduce el
viewport en vez de tapar el campo enfocado.

## Semántica de Base UI

`<Button render={<Link/>}>` hacía que Base UI avisara por consola: con
`nativeButton` por defecto (`true`) espera un `<button>` nativo. Poner
`nativeButton={false}` habría callado el aviso añadiendo `role="button"` a un
enlace — peor para el lector de pantalla. Los cinco casos del repo pasaron a
ser enlaces reales con `buttonVariants(...)`, que es lo que semánticamente
son: `CabeceraPuntoVenta`, `AccionCambiarPassword`, exportar de Empleados y
dos enlaces de la pantalla de venta registrada.

## Verificación

- `e2e/shell-movil.spec.ts` (gate `E2E_BASELINE=1`, como el resto de los
  specs autenticados): títulos sin recorte a 320/390/430px, ausencia de
  chrome fijo superior, reserva de safe area, landscape sin overflow, back
  con nombre accesible y área ≥44px, axe (wcag2a/aa) en raíz, secundaria y
  formulario, y cabecera de escritorio intacta a 1024px.
- `npm run check` y `npm run build`.
