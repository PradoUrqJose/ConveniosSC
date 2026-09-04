# Tokens y geometría móvil — issue #51 (PWA-MOB-01)

Especificación completa: `docs/sistema-diseno-mobile (1).md`. Este documento
resume qué se implementó, dónde vive y cómo lo consumen los issues
MOB-02..06 y las migraciones de pantalla posteriores.

## Dónde vive

- **Tokens y primitivas:** `src/app/globals.css`, bloque
  `@media (max-width: 1023.98px)` (sección "Sistema de tokens y primitivas
  móviles"). Todo el bloque —tokens `--mob-*` y clases `.mob-*`— está
  aislado dentro de ese único media query: a 1024px o más ninguna de estas
  reglas existe en la hoja de estilos, así que no hay forma de que
  alteren el desktop aprobado, ni por accidente en un componente
  compartido.
- **Referencia viva:** `/estilo-movil` (solo `SUPERADMIN`, sin
  entrada de menú). Renderiza cada primitiva con datos de ejemplo — es el
  material de verificación visual (capturas Playwright, revisión manual),
  no una pantalla de producto. Vive *fuera* del grupo `(app)` a propósito:
  ese grupo agrega Sidebar/Header/TabBarMovil (chrome claro,
  desktop-primero), y envolver ahí el `.mob-shell` (fondo azul noche,
  "sin chrome fijo" por diseño) mezclaba los dos temas en una misma
  pantalla — justo lo que el principio 1 del doc de diseño prohíbe.
- **Verificación automatizada:** `e2e/tokens-movil.spec.ts` (gate
  `E2E_BASELINE=1`, igual que `baseline-desktop.spec.ts`): sin overflow
  horizontal a 320/390/430px en claro y oscuro, y capturas del dashboard a
  1024/1280/1440px para confirmar paridad con desktop.

## Tabla de tokens

| Token | Valor / origen | Rol |
|---|---|---|
| `--mob-bg` | claro `oklch(0.932 0.016 250)` · oscuro `oklch(0.145 0.032 255)` | Fondo de pantalla. Valor propio por modo, no alias. |
| `--mob-bg-foreground` | claro `var(--foreground)` · oscuro `oklch(0.985 0 0)` | Texto sobre el fondo profundo. |
| `--mob-superficie` | claro `oklch(1 0 0)` · oscuro `oklch(0.215 0.032 254)` | Contenedor de tarjeta. Siempre más claro que `--mob-bg` del mismo modo. |
| `--mob-superficie-tenue` | claro `oklch(0.963 0.011 250)` · oscuro `oklch(0.275 0.03 252)` | Bloque anidado dentro de una tarjeta. |
| `--mob-acento` | `var(--primary)` | Único acento: acción primaria + indicador de navegación activo. Reutiliza el `--primary` de la app. |
| `--mob-divisor` | claro `oklch(0.905 0.016 250)` · oscuro `oklch(1 0 0 / 12%)` | Línea entre filas de una lista, nunca antes de la primera. |
| `--mob-pill-ok-fg` / `-atencion-fg` / `-error-fg` | ver CSS | Texto de los pills semánticos. El fondo translúcido es igual en los dos modos; el texto no puede serlo (oscurecido en claro, luminoso en oscuro). |
| `--mob-font-sans` | `var(--font-sans)` | Alias explícito al stack de sistema del desktop. Cero descarga de red — ver "Fuentes" abajo. |
| `--mob-margen-pantalla` | `1.25rem` (20px) | Margen lateral, igual en pantalla, sheets y barra flotante. |
| `--mob-padding-tarjeta` | `1.125rem` (18px) | Padding interno de tarjeta, siempre menor que el margen de pantalla. |
| `--mob-padding-bloque` | `0.875rem` (14px) | Padding del bloque anidado, siempre menor que el de la tarjeta. |
| `--mob-gap-tarjeta` | `1.25rem` (20px) | Separación entre tarjetas. |
| `--mob-radius-tarjeta` / `-bloque` / `-control` | 24px / 16px / 12px | Escala de radios por jerarquía — nunca el mismo radio en padre e hijo. |
| `--mob-radius-pill` | `999px` | Pills y botones primario/secundario. |
| `--mob-squircle` | `32%` | Curvatura de contenedores de ícono. |
| `--mob-toque-min` | `2.75rem` (44px) | Área táctil mínima, sin excepciones. |
| `--mob-shadow-flotante` / `-sheet` | ver CSS | Únicos usos de sombra: barra flotante y bottom sheet. El resto de la profundidad es superficie, no sombra. |
| `--mob-duration` / `--mob-ease` | `200ms` / `cubic-bezier(0.2, 0, 0, 1)` | Movimiento propio del sistema móvil, distinto de `--duration-*`/`--ease-standard` de desktop. |
| `--mob-safe-top` / `--mob-safe-bottom` | `env(safe-area-inset-*, 0px)` | Safe areas. La barra flotante debe usar `margin-bottom`, nunca `padding` (doc §3). |

**Regla de color del sistema móvil (invariante):** `--mob-bg`,
`--mob-superficie` y `--mob-superficie-tenue` son **una sola rampa por
modo** y se declaran juntas en `:root` y en `.dark`. No se aliasan a
tokens de escritorio, porque esos no cambian todos igual con el tema:
`--sidebar` es azul noche en claro *y* en oscuro, mientras `--card` es
blanco en claro. Mezclarlos producía exactamente la pantalla prohibida
por el principio 1 del doc — página oscura con tarjetas blancas. Si en
el futuro hace falta un nuevo token de superficie móvil, se define en
los dos bloques a la vez o no se define.

El doc de diseño (§2) pide "dos superficies **por modo**": fondo profundo
y contenedor claro, separados por luminosidad y sin bordes. En claro eso
es fondo gris azulado + tarjeta blanca; en oscuro, fondo azul noche +
tarjeta elevada. El único acento (`--primary`) y los semánticos ya tienen
su variante por tema, así que no se redefinen acá.

## Primitivas (`.mob-*`)

`.mob-shell` (pantalla base) → `.mob-tarjeta` (radio 24, contenedor
exterior) → `.mob-tarjeta-encabezado` (fila de navegación, fuera del
bloque) → `.mob-bloque` (radio 16, subtarjeta de datos) → `.mob-fila`
(alto 56px, divisor inset vía `:not(:first-child)`). Además: `.mob-pill`
+ 3 variantes semánticas (`-ok`, `-atencion`, `-error`, siempre dentro de
una pill, nunca tiñendo un ícono o título suelto), `.mob-icono` /
`.mob-icono-acento` (squircle), y `.mob-boton-primario` /
`-secundario` / `-terciario`.

Ejemplos renderizados de anidamiento, estados semánticos y el caso
"tarjeta → fila" están en `/estilo-movil` (código fuente:
`src/app/estilo-movil/page.tsx`).

## Fuentes

No hay ninguna dependencia de Google Fonts en el proyecto (se verificó con
`grep -r "next/font/google"` — cero resultados). `--mob-font-sans` es un
alias explícito a `--font-sans` (stack de sistema, `ui-sans-serif,
system-ui, ...`) para que ninguna migración futura reintroduzca una
descarga de red "para este flujo".

## Cómo lo consumen los siguientes issues

MOB-02..06 y las migraciones de pantalla deben usar `var(--mob-*)` y las
clases `.mob-*` en vez de repetir `20px`, `24px/16px/12px`, colores o
easing sueltos. Si una pantalla necesita una primitiva que no existe acá
(por ejemplo el bottom sheet completo o la bottom bar flotante, que son
alcance de MOB-03/04), se agrega a este mismo bloque `@media` para que
seguir aislado del desktop sea automático, no una disciplina manual.
