# Carga, vacío, error, toast y offline — issue #56 (PWA-MOB-06)

Cierra la serie que abrieron `docs/17-TOKENS-GEOMETRIA-MOVIL.md` (#51),
`docs/18-SHELL-MOVIL-CABECERAS.md` (#52),
`docs/19-BARRA-INFERIOR-MOVIL.md` (#53), `docs/20-CAPAS-MOVILES.md` (#54) y
`docs/21-PRIMITIVAS-TACTILES-MOVIL.md` (#55), y consume sus tokens.

Referencia viva: `/estilo-movil` → sección «Carga, vacío, error y offline».

## El problema

La auditoría (`docs/16-AUDITORIA-PWA-MOBILE-2026.html`) encontró tres cosas
distintas bajo la misma etiqueta de «estados»:

1. **Vocabulario mezclado.** El sistema tenía `skeleton-shimmer`, pero
   `form-venta.tsx` dibujaba su propio `animate-pulse` y varias pantallas
   añadían spinners. Tres animaciones simultáneas se leen como tres cargas
   distintas en marcha.
2. **Sin fronteras de error.** No existía un solo `error.tsx`. Cualquier
   fallo de render llegaba a la pantalla en blanco de Next: se perdían los
   filtros, la paginación y —en el punto de venta— el formulario.
3. **Una sola causa para todos los fallos.** El fallback offline hablaba
   siempre de falta de internet y solo ofrecía «Reintentar», aunque el
   problema fuera el servidor, la sesión vencida o un permiso.

## La decisión de fondo: las reglas fuera de React

Como en `barra-scroll.ts` (#53) y `capas-movil.ts` (#54), lo que tiene
reglas de verdad vive en módulos puros:

| Módulo                    | Responde a                                              |
| ------------------------- | ------------------------------------------------------- |
| `src/lib/estados-red.ts`  | ¿qué falló?, ¿se reintenta?, ¿solo o preguntando?, ¿qué le digo al usuario? |
| `src/lib/politica-cache.ts` | ¿esta petición se puede guardar en caché?             |

Así se comprueban en `npm test` sin montar un navegador ni tumbar un
servidor, y las pantallas no repiten ni un `if`.

## 1. Siete causas, no una

`clasificarFallo({ error, estadoHttp, codigo, enLinea })` lee las señales en
orden de confianza —sin red no importa qué dijo el servidor, porque no dijo
nada— y devuelve:

| Clase         | Cuándo                                    | Salida ofrecida        |
| ------------- | ----------------------------------------- | ---------------------- |
| `offline`     | `navigator.onLine === false`              | esperar red (auto)     |
| `servidor`    | 5xx, o `fetch` rechazado **con** red      | reintentar             |
| `timeout`     | `AbortError`/`TimeoutError`, 408, 504     | reintentar             |
| `sesion`      | 401 / `NO_AUTENTICADO`                    | iniciar sesión         |
| `permiso`     | 403 / `SIN_PERMISO`                       | volver                 |
| `datos`       | 4xx de negocio (validación, conflicto…)   | volver                 |
| `desconocido` | sin señales útiles                        | reintentar             |

La distinción que más se nota es `offline` vs `servidor`: un `fetch`
rechazado **con** red significa que el dispositivo está conectado y el que
no contesta es el servidor. Decirle «no tienes internet» a alguien que está
mirando WhatsApp en la misma pantalla destruye la confianza en el aviso.

`copiaFallo(clase)` centraliza el texto: la misma caída se lee igual en la
frontera de ruta, en un panel parcial y en un toast.

## 2. Reintento: automático solo cuando es seguro

`reintentoAutomaticoSeguro({ clase, mutacion })` devuelve `false` para toda
mutación, sin excepción. Reenviar solo una petición que quizá sí llegó al
servidor duplicaría una venta; ante la duda se le pregunta al usuario. Las
lecturas sí se repiten solas ante `offline`, `servidor` y `timeout`, con
`retrasoReintento` (500 ms duplicando hasta un tope de 8 s).

## 3. El umbral de 200 ms

`EsqueletoDiferido` (`src/components/estados.tsx`) retiene el esqueleto
`MS_UMBRAL_ESQUELETO = 200` ms y envuelve a `PageSkeleton`, así que las
quince `loading.tsx` lo heredan sin tocarlas.

Dos decisiones importan:

- **Se oculta con `visibility`, no desmontando.** El árbol ocupa su alto
  desde el primer cuadro, así que al aparecer no empuja nada ni mueve el
  scroll. `display: contents` deja intacta la rejilla de la pantalla y
  `visibility` se hereda hasta las hojas.
- **La primera carga no espera.** Un módulo con `yaHidrato` distingue el
  HTML del servidor (JS todavía descargando en 3G, donde esconder el
  esqueleto dejaría la pantalla en blanco durante segundos) de una
  navegación de cliente, que es donde el destello ocurre. Solo la segunda
  aplica el umbral.

## 4. Fronteras de error por dominio

Trece `error.tsx` —uno por dominio, más el raíz, más `global-error.tsx`—
montan `ErrorRuta`. Todas se quedan **dentro** del layout, y de ahí salen
tres propiedades que la pantalla en blanco de Next no tenía:

- barra inferior y sidebar siguen ahí: la navegación no se bloquea;
- la URL no cambia, así que `reset()` vuelve a renderizar el mismo segmento
  **con los mismos filtros y la misma página**;
- el punto de venta añade una línea explícita: el borrador local
  (`lib/borrador-venta.ts`) devuelve documento, importe y evidencias, y un
  usuario que no lo sabe no toca el botón.

El registro sale como una línea JSON `convenios.error.v1` con dominio,
clase y `digest` —nunca el mensaje del error, que puede traer un documento
o un nombre—, en el mismo formato que `lib/observabilidad.ts`.

`src/app/rutas-estados.test.ts` fija el contrato: toda pantalla con
`page.tsx` tiene `loading.tsx` y queda cubierta por un `error.tsx`. Sin ese
test, la ruta número dieciséis nace sin frontera y nadie se entera hasta
que un usuario ve la pantalla blanca.

## 5. Error parcial: la pantalla no se cae entera

`ErrorParcial` es el panel de la sección que falló. En `/ventas`, cuando la
recarga del listado se cae, el aviso aparece **encima de los resultados
anteriores**: búsqueda, chips de filtro y tabla siguen donde estaban, y el
botón repite exactamente la consulta que falló (la URL se guarda en
`urlFallida`). Ese es el criterio «el usuario conserva filtros ante errores
recuperables», y no se cumple ocultando el error sino no borrando nada.

La búsqueda por DNI recibió el mismo trato: la Server Action **lanza** si
la petición no sale del dispositivo, y sin ese `try` el fallo subía a la
frontera de ruta y se llevaba por delante el formulario a medio llenar.

## 6. Los dos vacíos

`EstadoSinResultados` (en `pagina-ui.tsx`) obliga a escribir los dos textos
y elige por `hayFiltros`. «Aún no hay ventas» y «no encontramos
coincidencias» se dibujan igual y no se parecen en nada: el primero pide
crear algo, el segundo pide soltar un filtro. Empleados mostraba siempre el
segundo, incluso en una empresa que aún no había dado de alta a nadie.

## 7. Avisos que no tapan nada

- **El aviso de conexión va en el flujo del documento**, no flotando:
  empuja el contenido en vez de cubrirlo, así que ningún toque queda
  debajo. Desde este issue también confirma la vuelta («Conexión
  restablecida») y se retira solo a los 4 s.
- **Un único token para lo que flota abajo.** `--mob-hueco-avisos` vale el
  hueco de la barra inferior en general, y `:root:has(.mob-espacio-inferior-cta)`
  lo cambia por el alto del CTA en el punto de venta —donde no hay barra—.
  Lo consumen el toaster y el banner de instalación: el toast de «venta
  registrada» ya no cae encima del botón Guardar, y el toaster no necesita
  saber en qué ruta está.
- El teclado virtual no tapa nada porque el viewport declara
  `interactiveWidget: "resizes-content"` (#52): el área visible se encoge y
  los avisos fijos se recolocan con ella.

## 8. La pantalla `~offline`

Tres situaciones, tres textos y dos recuperaciones automáticas:

| Situación    | Señal                                | Qué hace                                   |
| ------------ | ------------------------------------ | ------------------------------------------ |
| Sin red      | `navigator.onLine === false`         | espera el evento `online` y vuelve sola    |
| Sin servidor | con red, la sonda falla              | sondea con espera creciente y vuelve sola  |
| Recuperado   | la sonda responde                    | lo dice y deja reintentar a mano           |

La sonda pide `HEAD /manifest.webmanifest`: confirma que hay servidor sin
tocar ninguna ruta autenticada ni gastar datos. `navigator.onLine` solo
sabe si hay interfaz de red — con un portal cautivo dice `true` y la app
seguiría rota.

Dos detalles que se ven poco y se notan mucho:

- El HTML precacheado asume **sin red** (`useEnLinea(false)`), porque esta
  pantalla existe justamente para servirse cuando la navegación falló:
  anunciar «el servidor no responde» y corregirse al hidratar sería
  ruidoso y falso.
- La recarga automática se salta si la URL es literalmente `/~offline`. En
  el fallback real el service worker sirve esta pantalla **en la ruta que
  el usuario pidió**, así que recargar lo devuelve a su sitio; abriendo
  `/~offline` a mano, recargar solo repintaría lo mismo en bucle.

## 9. Nada autenticado se cachea

El criterio «DNI, ventas y documentos no se cachean» no se podía comprobar
leyendo `sw.ts`: los matchers solo existen dentro de un worker. Ahora la
regla vive en `politica-cache.ts` y el worker la consume, así que
`politica-cache.test.ts` la verifica ruta por ruta.

| Petición                                | Política        |
| --------------------------------------- | --------------- |
| Navegaciones (`/ventas`, `/empleados`…) | `red-siempre`   |
| Server Actions (búsqueda por DNI, alta) | `red-siempre`   |
| `/api/*` (adjuntos, exportación, blob)  | `red-siempre`   |
| Payload RSC                             | `red-siempre`   |
| Cualquier método distinto de GET        | `red-siempre`   |
| Fuentes e iconos                        | `cache-primero` |
| Chunks del build                        | precaché versionado |

Fabricar velocidad guardando ventas o documentos de identidad significaría
dejarlos legibles en un dispositivo compartido y mostrar importes viejos
como si fueran de ahora.

## Qué NO se hizo

- **No se tocó el escritorio.** Los tokens nuevos viven dentro del
  `@media (max-width: 1023.98px)` del #51; a 1024px no existen.
- **No se añadió caché de datos.** Es explícitamente lo contrario de lo que
  pide el issue.
- **No se reescribieron los quince esqueletos.** Ya tenían la geometría del
  contenido real; lo que faltaba era el umbral y quitar la duplicación de
  `aria-busy` (tres pantallas anunciaban la carga dos veces).

## Verificación

- `src/lib/estados-red.test.ts` — clasificación, reintentos, umbral, copia.
- `src/lib/politica-cache.test.ts` — nada autenticado se guarda.
- `src/app/rutas-estados.test.ts` — toda ruta con carga y frontera de error.
- `e2e/estados-movil.spec.ts` — umbral y ausencia de salto, error recuperable
  con filtros intactos, offline con vuelta automática, avisos por encima de
  la barra, axe y movimiento reducido. Gated por `E2E_BASELINE=1`.
