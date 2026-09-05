# Transiciones de navegación y continuidad visual — issue #70 (PWA-MOTION-01)

Especificación completa: `docs/sistema-diseno-mobile (1).md` §11
("Movimiento y gestos"). Este documento resume qué se implementó, dónde
vive y por qué no se usó el `<ViewTransition>` declarativo de React que
documenta `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`.

## Por qué no `<ViewTransition>` de React

Next 16.3 soporta ese componente, pero requiere el build de React canary
que Next vendoriza para sus propios internos
(`next/dist/compiled/react`). El proyecto declara `react@19.2.8` estable
en `package.json` — es el que de verdad se empaqueta para el navegador, y
esa versión no exporta `ViewTransition` (se verificó: cero matches en
`node_modules/react/cjs/react.development.js`). Se optó por la **View
Transitions API nativa del navegador** (`document.startViewTransition`),
que no depende de la versión de React: es una llamada de DOM, tipada ya en
`lib.dom.d.ts` de TypeScript 5.9.

## Dónde vive

- **Orquestación:** `src/lib/transicion-movil.ts`. Expone
  `iniciarTransicionMovil(direccion)` (llamarlo en el `onClick` del enlace
  que navega, antes de que la navegación real ocurra: ahí es donde
  `startViewTransition` toma la foto de la pantalla actual) y
  `resolverTransicionMovilPendiente()` (la pantalla destino la libera
  cuando ya terminó su propio ajuste de layout). Un tope de 1.5 s libera la
  transición si nunca llega una pantalla que la resuelva (navegación
  fallida, `notFound()` fuera del flujo esperado).
- **Resolución automática:** `src/components/shell/transicion-movil-resolver.tsx`,
  montado una sola vez en `(app)/layout.tsx` **después** de `{children}`.
  Por orden de efectos de React (los de un hijo anterior en el árbol
  corren antes que los de un hermano posterior), si la pantalla que acaba
  de montar restaura su propio scroll con `requestAnimationFrame` (como ya
  hacía `VentasClient` desde antes de este issue), ese `rAF` se encola
  primero y el de acá se resuelve después, en el mismo frame — la "foto
  nueva" de la transición sale ya con el scroll en su posición final.
- **Disparadores:**
  - Volver: `BotonAtrasMovil` en `src/components/shell/cabecera-movil.tsx`
    — es el back compartido por todas las pantallas secundarias (issue
    #52), así que cualquier pantalla que lo use ya participa de la
    transición de vuelta sin cambios propios.
  - Ir al detalle: el enlace de cada tarjeta en
    `src/app/(app)/ventas/ventas-client.tsx` (única ruta con lista →
    detalle real, `/ventas` → `/ventas/[id]`).
- **CSS:** bloque `@media (max-width: 1023.98px)` de `src/app/globals.css`
  (mismo bloque que aísla todo `--mob-*`/`.mob-*` del desktop — issue #51).
  `data-mob-transicion="adelante"|"atras"` en `<html>` selecciona la
  dirección; las animaciones usan `--mob-duration`/`--mob-ease` (200 ms,
  dentro del rango 150–250 ms del doc). Fuera de ese breakpoint no existe
  ni el atributo ni la regla: el desktop no puede adoptar la transición
  por accidente.
- **Barra inferior anclada:** `.mob-barra-inferior` tiene
  `view-transition-name: mob-barra-inferior` y su propio grupo se excluye
  de la animación — vive en las dos pantallas (lista y detalle) y debe
  quedarse fija mientras el contenido desliza, igual que el "anchoring the
  header" del doc de Next.

## Reduced motion y no bloquear input

- `puedeTransicionarMovil()` (en `transicion-movil.ts`) revisa
  `prefers-reduced-motion` **antes** de llamar a `startViewTransition`: con
  la preferencia activa, la navegación es instantánea y nunca se marca
  `data-mob-transicion`. El bloque `@media (prefers-reduced-motion:
  reduce)` ya existente en `globals.css` agrega además una red de
  seguridad (`animation-duration: 1ms`) por si la preferencia cambia
  mientras el atributo ya estaba puesto.
- `::view-transition { pointer-events: none; }` deja pasar el toque a la
  pantalla ya montada debajo del overlay de la transición mientras dura.

## Skeletons sin shimmer continuo (doc §9)

`.skeleton-shimmer::after` (usada por `<Skeleton>`, compartida con
desktop) tenía un barrido `infinite` de 1.4 s — el doc de diseño móvil ya
pedía desde el issue #56 "sin shimmer, pulso muy sutil o estático", pero
el componente compartido nunca se ajustó. Se apaga sólo dentro del mismo
`@media` móvil (el desktop no estaba cubierto por esa regla y no se toca
acá): el skeleton queda como su fondo `--muted` estático.

## INP y frames perdidos

`src/components/rendimiento-real.tsx` ya reportaba INP vía
`useReportWebVitals` (issue #57). Se agregó un segundo observer sobre
`long-animation-frame` (Long Animation Frames API): cada frame de más de
~50 ms del hilo principal se publica como métrica `framesPerdidos` en el
mismo esquema RUM (`src/lib/rendimiento.ts`). Sin soporte del navegador,
el observer no se registra — no falla, no reporta. Sirve para detectar si
la transición lateral (u otra cosa del hilo principal) cuesta cuadros de
verdad, más allá de lo que ya mide INP.

## Cómo verificar

- `npm run build` y `npm run test` (suite completa) — ambos deben pasar
  sin tocar nada de este issue.
- Manual: iniciar sesión, abrir `/ventas` a ≤1023px, tocar una tarjeta
  (desliza a la izquierda, la barra inferior se queda fija), volver con el
  back de la cabecera (desliza a la derecha, la lista aparece ya en la
  posición de scroll donde estaba la tarjeta tocada). Activar
  "reducir movimiento" del sistema operativo y repetir: la navegación debe
  verse instantánea. A ≥1024px no debe verse ningún desplazamiento lateral
  en ningún caso.
