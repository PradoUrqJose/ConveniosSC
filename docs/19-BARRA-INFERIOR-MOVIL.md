# Barra inferior flotante — issue #53 (PWA-MOB-03)

Continúa `docs/17-TOKENS-GEOMETRIA-MOVIL.md` (#51) y
`docs/18-SHELL-MOVIL-CABECERAS.md` (#52), y consume sus tokens.
Especificación de diseño: `docs/sistema-diseno-mobile (1).md` §3.

## Qué cambió

La barra inferior estaba pegada al borde, se separaba del contenido con un
borde + sombra y pagaba el safe area como `padding` interno. Ahora:

- **Píldora flotante**: 20px de margen lateral (el margen de pantalla del
  sistema móvil) y 12px —o el safe area, el que sea mayor— sobre el borde
  inferior. Radio completo, superficie sólida (`--mob-superficie`), sombra
  flotante. Ya no hay borde ni línea divisoria.
- **Etiqueta siempre visible** junto al ícono en todos los destinos, con
  **indicador activo deslizante** anclado al borde inferior de la píldora.
- **Se oculta al scrollear** ~80px hacia abajo y vuelve con ~30px hacia
  arriba.
- **El destino destacado (registrar venta) ya no sobresale** como FAB: el
  ícono sube de contraste dentro de la píldora, con su etiqueta como el
  resto. Nada rompe la silueta de la barra ni se sale del área táctil.

Escritorio no cambió: la barra es `lg:hidden` y todo su CSS vive dentro del
`@media (max-width: 1023.98px)` del issue #51.

## Safe area y hueco del contenido

Regla crítica del doc §3: el inset inferior es **`margin-bottom` del
contenedor flotante, nunca padding interno**. Tres tokens, un solo origen:

| Token | Qué es |
|---|---|
| `--mob-bottom-bar` | alto de la píldora (3.9rem) |
| `--mob-bottom-bar-margen` | `max(0.75rem, safe-area-inset-bottom)` |
| `--mob-bottom-bar-hueco` | la suma: lo que la barra le quita a la pantalla |

`--mob-bottom-bar-hueco` lo consumen el hueco del contenido
(`.mob-espacio-inferior`), el offset móvil de los toasts
(`components/ui/sonner.tsx`) y el aviso de instalación de la PWA. Si la
barra cambia de alto o de separación, se cambia el token y nada más: barra,
contenido, toast y aviso no pueden desincronizarse.

## Capas

Las tres capas fijas del móvil se declaran juntas en `globals.css`:

- `--z-cta-movil: 35` — CTA fijo de pantalla (punto de venta).
- `--z-nav-movil: 40` — barra inferior.
- `--z-overlay/--z-modal/--z-popover: 50-52`, `--z-toast: 60`.

Es decir: un sheet o un modal tapa la navegación, nunca al revés; y el CTA
queda por debajo de la barra (hoy no coinciden en ninguna pantalla —
`/ventas/nueva` no monta la barra—, pero el orden queda fijado).

## Ocultamiento por scroll

La regla vive en `src/lib/barra-scroll.ts`, fuera de React y del DOM, y es
la única parte con estado real:

- **80px** de scroll descendente acumulado la ocultan; **30px** ascendente
  la devuelven (recuperar es barato, ocultar no).
- El acumulado se mide desde un **ancla que se reinicia en cada cambio de
  dirección**: 80px hacia abajo son 80px seguidos, no repartidos entre idas
  y vueltas.
- **Bloqueo de 150ms** entre cambios de estado: el rebote de iOS no la hace
  parpadear.
- **Siempre visible** en los primeros 80px y al final del documento; el
  rebote por encima del tope o por debajo del fondo no cuenta como
  intención de scroll.

`TabBarMovil` sólo le pasa medidas (una evaluación por frame vía
`requestAnimationFrame`) y aplica el resultado como `data-oculta`. La barra
**no se oculta nunca** cuando:

- hay foco dentro de ella (`focusin`/`focusout`),
- el teclado está abierto (`visualViewport` más de 120px más corto que el
  layout viewport),
- hay un toque en curso sobre la barra (`pointerdown` … `pointerup`),
- el sistema pide `prefers-reduced-motion: reduce` — ahí no hay
  desplazamiento no esencial: ni ocultamiento, ni deslizamiento del
  indicador, ni escala del pressed.

Oculta sigue en el DOM y accesible: si el foco llega por teclado, vuelve.

## Destinos, etiquetas y feedback

- Los destinos salen de `navegacionPorRol(rol)` (3 a 5, orden estable): 3
  VENDEDOR, 5 ADMIN_EMPRESA, 4 SUPERADMIN.
- `DestinoNav.etiquetaCorta` es la etiqueta de la barra cuando la larga no
  entra ("Nueva venta" → "Vender"); el `aria-label` conserva la larga, así
  que el lector de pantalla sigue anunciando el destino completo.
- A 320px con cinco destinos cada pestaña mide 56x62 (≥44x44) y la etiqueta
  baja un punto de tamaño para entrar entera. Recortar con ellipsis
  ("Emplea…") es justo lo que la etiqueta existe para evitar.
- **Feedback inmediato**: al tocar, la pestaña se enciende y el indicador
  se desliza en el mismo frame del clic, sin esperar la respuesta del
  servidor. El destino "pendiente" se guarda junto a la ruta desde la que
  se tocó, así que deja de aplicar solo cuando `pathname` cambia (sin
  efectos que lo limpien), con un tope de 5s por si la navegación nunca
  llega. `aria-current="page"` acompaña al estado pintado y el foco se
  queda en el enlace: nadie lo mueve al navegar.
- **Prefetch medido**: se quitó el `prefetch` forzado. La barra está
  siempre en viewport, así que el modo automático del App Router ya
  prefetchea los destinos; forzarlo sólo añadía peticiones de datos
  dinámicos que la mayoría de las sesiones no usa.

## Verificación

- `src/lib/barra-scroll.test.ts` (vitest): umbrales, histéresis, bloqueo
  antiparpadeo, tope/fondo, rebote iOS y congelado por foco/teclado/reduced
  motion.
- `e2e/barra-inferior-movil.spec.ts` (gate `E2E_BASELINE=1`, como el resto
  de los specs autenticados): geometría flotante y hueco sin solape,
  etiquetas sin recorte y áreas ≥44px a 320px, axe (wcag2a/aa) sobre la
  barra, ocultamiento y recuperación por scroll, congelado con teclado y
  reduced motion, feedback inmediato + foco al cambiar de ruta, y
  escritorio a 1024px con el sidebar.
- Medición directa en Chrome del CSS compilado a 320 y 390px: píldora de
  280/350px, 20px laterales, 12px inferiores, 5 pestañas de 56x62 sin
  etiqueta recortada, indicador dentro de la píldora en los dos extremos y
  en los dos modos de color.
- `npm run check` y `npm run build`.
