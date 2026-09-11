# Rediseño PWA — hero de pantallas raíz y movimiento (2026-09)

Punto de partida: imagen de referencia del usuario (app financiera móvil) y
las skills instaladas para esta fase — `emilkowalski/skills` (animación) y
`mobile-app-ui-design` + `apple-web-app` (rediseño PWA). **Solo se rediseña
la PWA (< 1024px)**; el escritorio conserva su composición aprobada. Las
mejoras de animación sí aplican a los dos (ver commit
`feat(motion): curvas fuertes…`).

## Movimiento (móvil y escritorio)

- Tokens globales en `:root`: `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`,
  `--ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer`
  `cubic-bezier(0.32, 0.72, 0, 1)` y `--duration-press` 160ms. Van sin capa,
  así que también reemplazan las curvas de las utilidades `ease-out` /
  `ease-in-out` de Tailwind.
- Pulsación única: `scale(0.97)` a 160ms `--ease-out`. La barra inferior
  presiona instantáneo y suelta con transición (asimétrico).
- Sin fundidos en skeletons ni en listas: la navegación instantánea (#58)
  no paga 300–500ms de fade por visita. Nada anima por tecla (casillas DNI).
- Sheet, navegación lateral (300ms) y pila multipágina con curva de drawer
  iOS; los pasos de Nueva venta y las subpáginas del sheet entran según la
  dirección con `@starting-style`.
- Dialog de escritorio: salida 150ms `--ease-out` (antes `ease-in`), stagger
  de 30ms. Hover con movimiento solo con puntero real.
- Reduced motion: el sheet se funde en su lugar en vez de aparecer de golpe.

`--mob-ease` (`cubic-bezier(0.2, 0, 0, 1)`, doc §11) se conserva para
movimientos dentro de la pantalla (barra inferior, indicador).

## Hero de pantalla raíz

`src/components/shell/hero-movil.tsx` — reemplaza a `CabeceraMovil` en `/`
(vendedor) y `/dashboard`:

- **v2 (a pedido del usuario):** tarjeta redondeada con la piel del banner
  de escritorio — diagonal de `--mob-hero` a `--mob-hero-profundo`, trama de
  puntos y halo cian —, ya no un bloque a sangre que se funde con el fondo.
  La tarjeta destacada se pinta debajo, como tarjeta propia. El margen
  superior de la tarjeta paga el safe area.
- Fila superior: avatar (el mismo `AccionCuentaMovil`, nombre accesible
  "Tu cuenta: …"), saludo por hora de Lima (`src/lib/saludo.ts`) y nombre
  como `h1` con `.mob-cabecera-titulo` (contrato e2e #52: no se trunca). Sin
  buscador en el dashboard (se quitó en la v2).
- Cifra protagonista (`CifraHero`): el valor pesa más que la etiqueta; el
  dashboard la hace llegar por streaming con un esqueleto de igual altura.
- Acciones: `PildoraHero` blancas + un cuadro oscuro opcional (en el
  dashboard, el disparador de filtros). A < 400px las píldoras se compactan
  y a < 360px pierden el ícono, para no recortar la etiqueta.
- `TarjetaDestacadaMovil`: un único mensaje accionable, con el dato clave
  en `<strong>` (nunca se parte "S/") y la acción dentro del bloque tenue.

## Lista de movimientos

`src/components/shell/lista-recientes-movil.tsx`: encabezado de sección,
chips que filtran de verdad (Todas / Hoy, 36px visibles con área táctil de
44px por `::after` y `data-toque="compacto"`) y filas `.mob-movimiento`.
Tocar una fila usa la transición lateral del #70.

**v2:** cada fila es una tarjeta blanca (`--mob-shadow-fila`) con ícono en
squircle tintado (`data-tono` atencion / error / neutro según el estado),
título en negrita con la meta en un chip tenue debajo, e importe en píldora
azul con el dato secundario (descuento) bajo ella. Aplica a todas las
listas móviles: operaciones recientes, ventas, empleados y catálogos.

## Pantallas raíz de listado (Ventas, Empleados, Sedes)

`src/components/shell/hero-lista-movil.tsx` — el mismo bloque del
dashboard con el título de la pantalla en lugar del saludo. Se pasa a
`CabeceraPagina` por la prop `movil`, que reemplaza a la cabecera móvil sin
tocar la de escritorio:

- Alcance (empresa o "Todas las empresas") sobre el título y el avatar de
  cuenta a la izquierda; a la derecha, la acción primaria como círculo
  sólido (`data-tono="solido"`: nuevo empleado, nueva sede).
- Cifra: total pagado (ventas), empleados registrados, sedes activas. Las
  métricas de escritorio quedan `max-lg:hidden`.
- Fila de acciones: `BuscadorHero` (píldora blanca, mismo estado que el
  buscador de escritorio) y el cuadro oscuro de filtros —
  `FiltrosMovil variante="hero"` en Empleados y Sedes, el sheet de filtros
  propio en Ventas—. La barra de filtros de escritorio queda `max-lg:hidden`.
- Listas: `.mob-movimiento` en las tres (y en Empresas, Convenios y
  Usuarios vía `FilaCatalogoMovil`): iniciales en squircle para personas,
  meta truncada y estado o importe a la derecha. En Ventas la fecha ("Hoy",
  "Ayer" o la fecha) abre el chip de cada tarjeta —sin encabezados de día—
  y el descuento va bajo el total; las anuladas se tachan. En Empleados las tabs de estado pasan a chips con conteo que
  desplazan de lado.
- Skeletons: `HeroListaEsqueleto` + filas del mismo alto.

## Tarjeta de venta (v3)

Referencia del usuario (HTML de "card de pago"), llevada a `.mob-venta*` en
`ventas-client.tsx` y `src/lib/presentacion-venta.ts` (funciones puras con
test):

- Dos líneas: nombre + total pagado (azul, 18px); y fecha corta
  ("Hoy, 16:11", "18 ago, 23:36" — `fechaCortaVenta`), contraparte en
  píldora y sede. La meta envuelve en vez de truncar.
- Inicial con color estable por persona (`tonoPersona`, hash del
  documento) en seis tonos `--mob-tono-*` con variante oscura.
- Etiqueta de descuento por tramo (`tramoDescuento` sobre `descuentoBps`):
  hasta 10% verde, hasta 20% ámbar, más de 20% rojo; el porcentaje exacto
  sale de `formatearPorcentaje` y el lector de pantalla oye "de descuento".
- Pie con descuento y estado: a la derecha de la meta desde 640px; debajo
  en teléfonos, para que la meta quede en una línea.
- Más aire: 18px de padding, 14px entre tarjetas. "Requiere revisión"
  suma una franja ámbar en el borde izquierdo; "Anulada" apaga la tarjeta.
- Diferencia con la referencia: la fecha no usa #94A3B8 (≈2.6:1 sobre
  blanco); toda la meta usa el gris secundario del sistema, que pasa AA.
  Los siete tonos se miden en `contraste-movil.test.ts`.

## Barra inferior y status bar

- El indicador pasó de barra corta a una píldora tenue del tamaño de la
  pestaña que se desliza detrás; el activo usa tinta plena y el acento queda
  para el destino destacado (vender).
- Con `black-translucent` el reloj de iOS es siempre blanco: `body::before`
  pinta una franja fija del alto de `env(safe-area-inset-top)` en
  `--mob-hero` para que siga legible al hacer scroll sobre contenido claro.
  Con inset 0 (navegador, sin notch) no existe.

## Contraste

`src/lib/contraste-movil.test.ts` mide blanco y blanco 86% sobre
`--mob-hero`, y el ícono sobre `--mob-hero-oscuro`, en claro y en oscuro.

## Verificación pendiente en dispositivo

Sin acceso a un iPhone con la PWA instalada: quedan **sin verificar** la
franja de status bar con notch/Dynamic Island, el muestreo de color de
Safari 26 y la sensación del sheet y la navegación lateral bajo el dedo.
