# Capas móviles unificadas — issue #54 (PWA-MOB-04)

Continúa `docs/17-TOKENS-GEOMETRIA-MOVIL.md` (#51),
`docs/18-SHELL-MOVIL-CABECERAS.md` (#52) y
`docs/19-BARRA-INFERIOR-MOVIL.md` (#53), y consume sus tokens.
Especificación de diseño: `docs/sistema-diseno-mobile (1).md` §5 y §7.

## Qué cambió

En móvil convivían tres mecanismos de capa con comportamientos distintos:
`Dialog` (diálogo centrado que en <640px se pegaba abajo), `Sheet`,
`DropdownMenu` y, encima, la rueda nativa de cada `<select>` de la barra de
filtros — una capa distinta por criterio, con su propio cierre y su propia
geometría. Ahora hay **una sola**: el bottom sheet.

- **`MobileSheet`** (`src/components/ui/mobile-sheet.tsx`) es el mecanismo
  de capa por debajo de 1024px: filtros, edición, detalle y confirmación.
  La única excepción que declara el doc de diseño es el visor de imágenes.
- **Escritorio no cambia.** `Dialog` y `AlertDialog` siguen exactamente
  como estaban, con su mismo marcado y sus mismas clases.
- **`Capa`** (`src/components/ui/capa.tsx`) es quien elige: una pantalla
  describe su capa una vez y el ancho decide el mecanismo.

## El corte, y por qué no es `lg:`

`useEsMovil()` (`src/components/ui/use-es-movil.ts`) lee
`max-width: 1023.98px` con `useSyncExternalStore` — el mismo corte que
aísla los tokens móviles en `globals.css`, así que CSS y JS no pueden
discrepar. `Capa` monta **un solo árbol**, no los dos con `lg:hidden`:

- un sheet con la geometría de un diálogo centrado (o al revés) es
  precisamente el híbrido que este issue elimina;
- dos árboles montados a la vez duplicarían los `id` de cada campo y cada
  `<form>`, y el lector de pantalla recorrería el que no se ve.

El snapshot de servidor es `false` (escritorio): las capas se montan
siempre después de una interacción, así que ese valor no llega a pintarse,
y si algún día se renderizara en el servidor caería del lado que no debe
cambiar.

## La primitiva

`MobileSheet` se apoya en `Drawer` de Base UI, que ya resuelve lo caro y lo
fácil de romper a mano: gesto de arrastre, foco atrapado y devuelto al
elemento invocador, bloqueo del scroll de fondo y teclado virtual
(`VirtualKeyboardProvider`). Lo que aporta el archivo es el sistema.

| Parte | Qué hace |
|---|---|
| `MobileSheet` | Raíz: altura, protección de cierre, pila, `rol` (`dialog`/`alertdialog`). |
| `MobileSheetPagina` | Una página de la pila. Dibuja su encabezado si recibe `titulo`. |
| `MobileSheetEncabezado` | Título grande a la izquierda + **un** botón circular a la derecha. |
| `MobileSheetCuerpo` | El único elemento desplazable de la capa. |
| `MobileSheetAcciones` | Pie fijo: acción primaria de ancho completo. |
| `MobileSheetFormulario` | `<form>` que envuelve cuerpo + pie y declara "hay cambios" al primer input. |
| `MobileSheetFilaOpcion` / `MobileSheetFilaAccion` / `MobileSheetOpciones` | Filas de opción (pill + chevron), filas de menú y selección persistente. |
| `MobileSheetBoton` / `MobileSheetCerrar` / `MobileSheetError` / `MobileSheetCargando` | Botones (primario, secundario, destructivo, terciario) y estados inline. |

**Tres alturas** (`altura`), como tope, no como alto fijo: la altura la
pone el contenido y el tope la limita — `compacta` 48dvh (selección
rápida), `media` 70dvh (por defecto), `casi-completa` 92dvh (formularios
largos). El tope descuenta el teclado virtual.

**Pila multipágina.** Las filas de opción no despliegan dropdowns: empujan
una subpágina dentro del mismo sheet. Mientras hay pila, la X del
encabezado pasa a flecha de volver — nunca están las dos. Las páginas de la
pila **siguen montadas** y se ocultan con `hidden` + `inert`: desmontarlas
se llevaba por delante lo escrito en el formulario de abajo, que es justo
lo que la protección de cierre intenta salvar. `hidden` las saca del árbol
de accesibilidad y del orden de tabulación, así que ocultas no las recorre
nadie.

## Protección de cierre

La regla vive fuera de React y del DOM, en `src/lib/capas-movil.ts`
(`decidirCierre`), igual que `barra-scroll.ts` del issue #53, y por eso se
prueba sin montar un sheet ni abrir un navegador
(`src/lib/capas-movil.test.ts`).

| Situación | Escape · X · arrastre | Toque fuera · pérdida de foco |
|---|---|---|
| Operación en curso (`pendiente`) | no pasa nada | no pasa nada |
| Formulario modificado | confirmación **dentro de la capa** | no pasa nada |
| Sin cambios | cierra | cierra |
| Cierre pedido por el código tras guardar | cierra | — |

El toque fuera es el gesto más accidental de todos, y el doc §5 lo dice
explícitamente: tocar afuera no cierra un sheet con un formulario a medio
llenar. La confirmación es una **página más de la misma capa** (variante
"decisión" del doc §5: composición centrada, destructivo arriba, cancelar
debajo), no un segundo modal encima del primero. En el DOM el orden es el
inverso al visual —`.mob-sheet-acciones` es `column-reverse`—, así que la
tabulación y el foco inicial caen siempre en la salida segura y **nunca**
en la acción destructiva.

Los sheets de **selección** (filtros) no se protegen: no hay nada escrito
que perder y el doc §7 pide que arrastrar descarte.

## Filtros

`FiltrosMovil` (`src/components/ui/filtros-movil.tsx`) sustituye a los
`<select>` nativos de la barra de filtros en Empleados y Sedes. Un icon
button (44x44) abre una sola capa; cada criterio es una fila con pill +
chevron que empuja su subpágina.

- **No filtra en vivo**: se trabaja sobre un borrador y solo se aplica al
  confirmar. Cerrar descarta, y la siguiente apertura parte de lo aplicado.
- **Filtros activos = un punto**, sin número (`.mob-punto-filtros`): el
  sheet es la única fuente de verdad.
- En escritorio los `select` siguen siendo los de siempre (`lg:block`), y
  el icon button no existe (`lg:hidden`).

## Qué se migró

| Antes | Ahora en móvil |
|---|---|
| `Dialog` de crear/editar sede y empleado | sheet `casi-completa` vía `Capa` |
| `Dialog` de detalle de empleado | sheet `media` vía `Capa` |
| `AlertDialog` de rechazo de empleado (y toda `ConfirmarDestructivo`) | sheet con variante destructiva y `role="alertdialog"` |
| Lista de acciones de cuenta en `/perfil` (#52) | sheet `compacta`, con la confirmación de cierre de sesión como subpágina |
| `<select>` de actividad, orden, estado y empresa | un único sheet de filtros multipágina |

El `DropdownMenu` de la fila de la tabla de Empleados no se tocó: vive
dentro del `hidden lg:block` de la tabla, es decir, nunca se pinta en
móvil.

Las demás pantallas (Usuarios, Ventas, Empresas, Convenios) migran
cambiando sus imports de `Dialog*` por `Capa*`: es el mismo contrato de
partes. Eso es alcance de MOB-06 y de cada pantalla, no de este issue.

## Safe area, teclado y capas

- El sheet está **pegado al borde**, así que acá el safe area sí es
  `padding` del pie (`max(0.875rem, --mob-safe-bottom)`) — al revés que la
  barra flotante del #53, que lo paga con `margin`.
- El teclado virtual se resuelve con `Drawer.VirtualKeyboardProvider`: el
  viewport del sheet se empuja con `padding-bottom:
  var(--drawer-keyboard-inset, 0px)` y el tope de altura lo descuenta. El
  fallback `0px` es obligatorio: la variable solo existe mientras el
  teclado está alineado.
- El sheet usa `--z-modal` y su backdrop `--z-overlay`, los tokens que fijó
  el #53: la capa tapa la barra inferior, nunca al revés.
- **El fondo no se atenúa** (doc §5): el backdrop es transparente y la
  separación la dan la superficie del sheet y `--mob-shadow-sheet`. El
  backdrop sigue existiendo para capturar el toque fuera y marcar la
  modalidad.
- `prefers-reduced-motion`: el sheet aparece y desaparece igual (eso no es
  decoración, es la capa), pero sin desplazamiento animado.

## Verificación

- `src/lib/capas-movil.test.ts` (vitest): las nueve razones de cierre de
  Base UI contra las tres decisiones, y los helpers del borrador de filtros.
- `e2e/capas-movil.spec.ts` (gate `E2E_BASELINE=1`, como el resto de los
  specs autenticados): geometría de bottom sheet a 390px, un solo elemento
  desplazable, fondo bloqueado, toque fuera/Escape/descartar contra un
  formulario modificado, foco devuelto al invocador, foco atrapado, filtros
  multipágina que no aplican en vivo, axe (wcag2a/aa) sobre la capa y
  escritorio a 1024px con el diálogo centrado intacto.
- Medición directa en Chrome (Playwright, 390x844, claro y oscuro): sheet
  de 390px de ancho pegado al borde inferior con radio superior de 24px y 0
  abajo; topes de 405/591/776px para las tres alturas a 844px de alto;
  subpágina con flecha de volver y sin X; el valor del formulario intacto
  tras "Seguir editando"; pie fijo mientras el cuerpo desplaza; áreas
  táctiles ≥44px; y a 1280px ninguna regla `.mob-sheet` existe (radio 0,
  fondo transparente, `max-height: none`).
- Axe sobre las tres capas (formulario, filtros, destructiva): 0
  violaciones, con nombre accesible correcto y `role="alertdialog"`
  conservado en la destructiva.
- `npm run check` y `npm run build`.

## Referencia viva

`/estilo-movil` (solo SUPERADMIN) suma la sección "Capas: bottom sheet":
las tres alturas, la pila multipágina, el formulario protegido, la variante
destructiva y el sheet de filtros, todos interactivos
(`src/app/estilo-movil/demo-sheets.tsx`).
