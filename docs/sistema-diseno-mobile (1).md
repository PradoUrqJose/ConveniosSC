# Sistema de diseño móvil — especificación

Documento de referencia para PWAs. Define **forma, estructura y comportamiento**. No define color ni tipografía: eso se resuelve por proyecto. Donde se hable de "superficie sólida", "superficie tenue" o "acento", son roles, no valores.

> Para el modelo: esto es una especificación, no una sugerencia. Si algo no está definido acá, proponé una opción concreta y justificá en una línea. No introduzcas patrones nuevos si uno existente resuelve el caso.

---

## Principios

1. **Sin chrome fijo.** No hay header. El título es el primer bloque de contenido y scrollea con él. El espacio superior se reserva solo para el safe area.
2. **Todo lo que interrumpe entra por abajo.** No hay modales centrados. Confirmaciones, filtros, selectores y menús son bottom sheets. Única excepción: el visor de imágenes.
3. **Sin bordes.** La separación se hace con superficie y espacio. Las únicas líneas del sistema son los divisores entre filas y las barras de progreso, que son contenido.
4. **Anidamiento por superficie.** La profundidad se construye metiendo una superficie dentro de otra, no con sombras. El radio interno siempre es menor que el externo.
5. **La inmediatez se produce, no se simula.** Navegar primero y cargar después; feedback al toque en el mismo frame; optimistic UI donde sea reversible.
6. **No existe el hover.** Estados válidos: reposo, presionado, foco visible, cargando, deshabilitado, seleccionado.

---

## 1. Geometría y espaciado

- **Escala de espaciado:** múltiplos de 4 — 4, 8, 12, 16, 20, 24, 32, 48.
- **Márgenes laterales:** 20 px. Iguales en todas las capas, incluidos los sheets y la bottom bar flotante. El contenido nunca se pega a los lados; el aire lateral es parte de la identidad, no espacio desperdiciado.
- **Padding interno de tarjeta:** 18 px. Siempre menor que el margen lateral de pantalla, para que la tarjeta se lea como objeto y no como fondo.
- **Radios:** 24 px contenedor exterior · 16 px bloque interior · 12 px elementos menores · radio completo en pills. Nunca el mismo radio en padre e hijo.
- **Squircle** para íconos en contenedor y botones de ícono: curvatura continua, radio ~32 % del lado.
- **Área táctil mínima:** 44 × 44 px, sin excepciones.
- **Separación entre tarjetas:** 16–20 px, siempre mayor que el padding interno de sus bloques.
- **Ancho de referencia:** 390 px. Verificar 320 px y 430 px.

---

## 2. Superficies

Dos superficies por modo, usadas en los dos sentidos según la capa:

| Capa | Fondo | Contenedor |
|---|---|---|
| Pantalla base | profundo | claro |
| Bottom sheet | claro | tenue |

**Decisión abierta (recomendada):** el fondo base va con **contraste profundo** respecto a la tarjeta. Separación por luminosidad, sin sombras. Es lo que conversa con la bottom bar oscura y flotante.

**Superficie invertida** (oscura sobre claro, o al revés): recurso de jerarquía más fuerte del sistema. **Una vez por pantalla**, para el bloque ancla.

### Coherencia de color

Regla de origen: **cada color que aparece en pantalla tiene que poder explicarse.** Si no se puede decir en una frase por qué está ahí, sobra.

- **El acento es uno solo** y se reserva para: acción primaria, indicador de navegación activo y degradado ambiental. No se usa para texto suelto, ni para íconos decorativos, ni para rellenar.
- **Los colores semánticos** (ok, atención, error) viven **solo dentro de pills de estado y discos de estado**. Nunca tiñen un ícono, un título ni un borde.
- **El fondo base lleva el mismo matiz que el acento**, muy desaturado. Un negro neutro debajo de un degradado de color produce un corte visible donde el degradado termina; un fondo con el mismo tono de fondo lo disuelve.
- **El acento y los semánticos no comparten fila.** Si una fila ya tiene un pill semántico, su ícono va en superficie neutra, no en superficie de acento.
- **Máximo tres familias de color por pantalla**, contando la neutra. Si hacen falta más, la pantalla está haciendo demasiado.

### Degradado ambiental (opcional por pantalla)

- Nace en el borde superior, detrás del safe area. Se disuelve antes del primer tercio.
- **Opacidad máxima ~12 %** sobre el fondo base, con al menos tres paradas para que la caída sea curva y no lineal. Si se ve dónde termina, está demasiado fuerte.
- Color principal muy diluido sobre el fondo base. Baja saturación.
- Es fondo, no contenedor: no scrollea, nada se apoya en él con transparencia.
- **Se activa solo en pantallas raíz** (destinos de la bottom bar). Las pantallas apiladas van sin degradado. El color comunica nivel.
- Apagado por defecto. Flag por vista.

---

## 3. Navegación

### Bottom bar

- **Píldora flotante**, no barra pegada al borde. Margen lateral propio, radio ≈ mitad de su altura. Superficie sólida con textura de grano fino, discreta.
- 3–5 destinos. Ícono de trazo fino arriba, etiqueta de texto abajo, **siempre visible en todos**.
- **Activo:** mismo ícono, mismo tamaño, contraste pleno. Inactivo, apagado. El ícono no cambia a relleno.
- **Indicador:** barra corta anclada al borde **externo inferior** de la píldora, ancho ≈ el del ícono, esquinas redondeadas. Su resplandor se proyecta hacia arriba y hacia adentro, con caída suave y sin bordes duros.
- **Transición entre destinos:** el indicador se desliza horizontalmente, con el contraste de íconos y etiquetas interpolando en paralelo.

**Safe area — regla crítica.** La barra tiene altura fija propia. El inset se aplica como `margin-bottom: max(12px, env(safe-area-inset-bottom))` en el contenedor flotante, **nunca como padding interno**. Usar `100dvh`, nunca `100vh`. Esto es lo que evita el hueco de más o de menos entre plataformas.

**Ocultamiento al scrollear.** Se va deslizando hacia abajo con fade tras ~80 px de scroll descendente. Vuelve con ~30 px de scroll ascendente. Siempre visible al tope y al final de la lista. Bloqueo de cambios de estado durante 150 ms para evitar parpadeo. El botón fijo de acción se oculta y aparece junto con ella, como un solo bloque.

### Fila de encabezado de pantalla

Sin header fijo: cada pantalla arranca con título grande + icon buttons a la derecha, y todo scrollea.

**Decisión abierta (recomendada):** el encabezado **se va con el scroll**, sin barra compacta de reemplazo. Es lo consistente con "sin chrome". Si una app tiene listas muy largas donde el buscador debe estar siempre a mano, se puede habilitar por excepción una barra compacta con título pequeño y los icon buttons.

### Contexto de cuenta / empresa

En apps multiempresa o multiorganización, el selector de contexto **no vive como fila destacada arriba del contenido**. Una fila de ancho completo antes del título compite con el título, retrasa el contenido real y se lee como un aviso.

Vive como **pill compacta en la fila de acciones del encabezado**, junto a los icon buttons: ícono más nombre abreviado. Abre el sheet de cambio de contexto. Y se repite como lista completa en Perfil, que es su lugar de administración.

Regla general: **el contexto se muestra, no se anuncia.** Ocupa el espacio de un botón, no el de un bloque.

### Volver

Icon button pequeño, arriba a la izquierda, flotando sobre el contenido. El contenido necesita colchón superior propio para no pasar por debajo.

### Acción principal fija

Botón de ancho completo, anclado abajo, solo para **la** acción de la app en esa pantalla (vender, crear). Se apila sobre la bottom bar respetando los mismos márgenes laterales y la misma separación. No está en todas las pantallas.

---

## 4. Contenedores

### Tarjeta

Radio 24. Sin borde, sin sombra dura. Ancho completo menos márgenes. Estructura en dos niveles:

```
┌─────────────────────────────────────┐
│  [icono]  Título            [ › ]   │  ← fila de encabezado, tocable
│  ┌───────────────────────────────┐  │
│  │  bloque de datos (radio 16)   │  │  ← subtarjeta
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

La fila de encabezado vive fuera de la subtarjeta y es el área de navegación. El chevron va en su propio contenedor con fondo, no suelto contra el borde.

### Fila de lista

Las filas **viven dentro de una tarjeta**; no son tarjetas. Alto 56–64 px.

- **Divisor** fino entre filas, inset respecto al padding de la tarjeta. Nunca antes de la primera ni después de la última.
- **Dos líneas, orden invertido:** metadato arriba, pequeño y apagado; nombre abajo, grande y sólido.
- **Elemento final según función:**

| Final de fila | Significado |
|---|---|
| Pill de estado | dato, sin navegación |
| Pill + chevron | abre selector o subpágina |
| Chevron en contenedor | navega |
| Nada | ítem homogéneo, sin acción |

- **Ícono a la izquierda solo si distingue categorías.** Si todos los ítems son del mismo tipo, la fila va desnuda.
- El texto se trunca antes de invadir el bloque derecho.

---

## 5. Bottom sheet

Mecanismo único de capa. Sin agarradera visible, sin barra de título.

- Título grande a la izquierda, botón de cerrar circular a la derecha, misma línea óptica.
- Márgenes laterales iguales al resto de la app.
- Acción principal fija abajo, ancho completo, visible aunque esté deshabilitada.
- **Fondo de atrás sin atenuar.** El sheet se separa por su propia superficie más una sombra amplia y muy difusa hacia arriba.
- Tocar afuera cierra los sheets de dato o selección. **No** cierra los que tienen un formulario a medio llenar: ahí solo la X o el arrastre.

**Tres alturas.** Media altura (selección rápida) · altura de contenido (formularios) · pantalla completa al arrastrar hasta el tope. En el paso a completa, el radio superior interpola a cero y el botón de cerrar se convierte en flecha de volver. La transición es continua durante el arrastre, no un salto.

**Multipágina.** Las filas de opción no despliegan dropdowns: empujan una subpágina dentro del mismo sheet, con transición lateral. El sheet anima a la altura nueva. La X pasa a flecha atrás mientras haya pila. El botón de abajo no se mueve.

### Confirmaciones

Composición **centrada**, única ruptura de la alineación a la izquierda del sistema.

**Variante aviso** — algo ya ocurrió. Ícono de estado en disco circular tenue (~72 px) con glifo saturado, título, dos líneas de apoyo, un solo botón que cierra. Los destellos decorativos alrededor del ícono se usan **solo aquí y solo en éxito**.

**Variante decisión** — antes de una acción destructiva. Dos botones apilados de ancho completo: destructivo arriba, cancelar debajo en superficie tenue. Arrastrar para cerrar equivale a **cancelar**, nunca a confirmar. El rojo va en el botón o en el texto, no en ambos.

---

## 6. Botones

- **Primario:** superficie sólida de máximo contraste, ancho completo en sheets, radio grande, alto ~56 px. Una o dos palabras, sentence case, sin ícono.
- **Secundario:** misma geometría, superficie tenue. **Nunca outline.**
- **Terciario:** pill compacta de superficie tenue, alto 38–40 px, texto en tono sólido. **Nunca texto suelto sin contenedor:** un texto tocable sin superficie no se lee como botón y no tiene área táctil clara. Esto incluye los "Ver todos" y los "Limpiar" junto a los encabezados de sección.
- **Icon button:** squircle 44–48 px, glifo al **40 % del lado** — el aire es la mitad del diseño. Trazo grueso con puntas redondeadas. Solo para íconos inequívocos (cerrar, volver, más, buscar, compartir, copiar). Si dudás si se entiende, lleva texto.
- **Ícono + texto:** ícono a la izquierda, del alto de la mayúscula del texto, nunca mayor. Solo si agrega información.
- **Nada por debajo de 44 px.** Si haría falta, es un enlace de texto o una fila.

**Dos pesos de ícono en el sistema:** trazo fino para navegación, trazo grueso para acción.

---

## 7. Entradas y selección

- **Input:** bloque de superficie tenue, radio grande, alto ~56 px, sin borde. Tamaño de texto ≥ 16 px (menos provoca zoom en iOS).
- **Etiqueta:** el placeholder no es etiqueta. Al escribir, la etiqueta se reduce y sube sobre el valor, para no perder la referencia con el campo lleno.
- `inputmode`, `type` y `autocomplete` correctos en todos los campos.
- Un campo por fila. Validación al salir del campo, no por tecla. El error va debajo, en texto, sin desplazar el layout.
- **Segmented control:** bloque tenue con la pastilla activa en superficie clara, radio interno menor que el externo.
- **Selección persistente:** el seleccionado **sube de contraste**, el resto se apaga. Sin checkmarks flotantes ni bordes de color. Los chips invierten a superficie sólida.

### Buscador

Se abre desde un icon button; no ocupa espacio permanente. **Reemplaza la fila del título en la misma pantalla**, no abre capa. Cross-fade con el título, no deslizamiento. Input tenue con lupa pequeña adentro a la izquierda, alto ~48 px, X a la derecha para cerrar y devolver el título. Los resultados usan el mismo formato de fila que la lista. El vacío de búsqueda es propio: dice qué se buscó y ofrece limpiar.

### Filtros

Icon button junto a la lupa, abre sheet. Filas de opción con pill + chevron, cada una empujando una subpágina. Botón fijo abajo para aplicar; un terciario para limpiar todo.

- **No se aplican en vivo.** Se aplican al confirmar. Cerrar arrastrando descarta.
- **Filtros activos:** punto pequeño sobre el icon button, sin número. El sheet es la única fuente de verdad.

---

## 8. Contenido

### Pantalla de detalle

Sin hero. Volver arriba a la izquierda; debajo, ícono en contenedor squircle, título grande, subtítulo apagado; de ahí a las tarjetas. Entra desde la derecha, sale hacia la derecha con el contenido anterior desplazándose en contrasentido. Sin degradado ambiental.

### Datos densos

Pares etiqueta-valor dentro de una tarjeta: etiqueta apagada a la izquierda, valor sólido a la derecha, divisor inset entre filas. Alto menor que el de una fila de lista. Los valores largos (IBAN, identificadores) **se parten en dos líneas manteniendo la alineación derecha, nunca se truncan**. Los identificadores llevan icon button de copiar y confirman con toast. Cada grupo es su propia tarjeta con encabezado de sección afuera.

### Métricas

Un solo número protagonista por pantalla, en la tarjeta de superficie invertida: etiqueta chica arriba, número grande, acciones en fila debajo. Secundarias en grid de dos columnas, tarjetas iguales, sin ícono. **Nunca scroll horizontal de métricas.** La variación va como pill junto al número, con flecha y signo; el significado no depende solo del color.

### Imágenes

- **Miniatura en fila:** squircle 40–48 px, recorte a centro, nunca deformada. Ocupa la posición del ícono. Sin imagen, cae al placeholder: misma forma en superficie tenue con glifo del tipo de documento. Nunca un hueco.
- **Preview en detalle:** proporción 3:4 o 4:5 (deja leer el documento sin abrirlo), radio grande, sin borde. Varias → grid de dos columnas con el gap del espaciado entre tarjetas.
- **Visor a pantalla completa:** la imagen se expande **desde su posición de origen**, fondo sólido opaco, sin bottom bar, sin degradado. Pinch y doble toque para zoom, arrastre para mover, swipe hacia abajo para cerrar volviendo a su lugar. Varias → swipe lateral con indicador de posición discreto. Cerrar con icon button arriba a la izquierda.
- Cargando: la forma en superficie tenue, sin spinner. Fallo: la misma forma con glifo de error, tocar para reintentar.

### Avatares y badges

- **Avatar:** siempre circular. Junto al ícono de confirmación, la única forma circular del sistema — **círculo = persona**. Tamaños 24 (inline) · 40 (fila) · 72 (cabecera). Sin foto, iniciales sobre superficie tenue.
- **Badge sobre avatar:** solapado abajo a la derecha, con anillo del color del fondo. Punto de estado, o ícono pequeño en contenedor circular para tipo.
- **Badge de conteo:** definido, **desactivado por defecto**. Pill de radio completo, alto ~18 px, tope 99+. Sobre íconos de la bottom bar va arriba a la derecha del ícono, con anillo del color de la barra, nunca sobre la etiqueta.
- **Regla de activación:** conteo solo cuando el número es accionable (el usuario puede llevarlo a cero). Si no, punto. **Un solo destino con badge a la vez**; si hacen falta dos, la jerarquía de la app está mal.

---

## 9. Estados

### Carga

El skeleton es la forma real del componente en superficie tenue: mismo alto, mismo padding, mismo radio. Si al llegar los datos el layout salta, el skeleton estaba mal. Tres a cinco filas fantasma, no diez.

- **Sin shimmer.** Pulso muy sutil de opacidad, o estático. Estático es más honesto.
- **Umbral 200 ms:** si la respuesta llega antes, no se muestra nada. Si ya se mostró, dura mínimo 300 ms para no titilar.
- **Solo en primera carga.** Al refrescar o cambiar filtros, el contenido viejo se queda con opacidad reducida. Nunca reemplazar contenido existente por fantasmas.
- **Progreso determinado** solo con porcentaje real (subir una imagen): barra fina sobre la miniatura.

**Inmediatez.** El skeleton no la produce, la disimula. Lo que la produce:
1. Respuesta al toque en el mismo frame, antes de que la red conteste.
2. **Navegar primero, cargar después:** el detalle entra con el título y el ícono que ya venían de la fila; solo el bloque faltante muestra skeleton. Nunca una pantalla en blanco esperando.
3. **Optimistic UI** en lo reversible (crear, marcar, borrar), revertido con toast si falla. Nunca en pagos o acciones irreversibles.

### Vacío

La petición funcionó y no hay nada que mostrar. Composición centrada, ícono en círculo tenue, una línea diciendo qué falta.

- **Primer uso:** invitación con botón primario que resuelve.
- **Sin resultados:** sin acción primaria; ofrece limpiar búsqueda o filtros.

### Error

La petición falló. Misma composición centrada, texto que dice qué pasó en términos del usuario, botón de reintentar. Sin códigos ni jerga. **No pide disculpas:** dice qué pasó y qué hacer.

**Error parcial:** si la pantalla cargó y solo falló una sección, el error vive dentro de esa tarjeta con un reintentar chico, sin ocupar la pantalla.

> Confundir vacío con error hace que el usuario crea que borró algo cuando en realidad se le cayó la conexión.

### Deshabilitado y solo lectura

- **Se ve, no se esconde.** Opacidad ~0.4, misma posición y tamaño, sin animación de presionado.
- **Primario deshabilitado pierde la superficie sólida** y cae a la tenue. **Secundario deshabilitado** solo baja la opacidad del texto. Así se distinguen sin depender del color.
- **Todo control deshabilitado debe poder explicar por qué.** Si no se explica en la pantalla, tocarlo muestra un toast con el motivo. Un botón muerto y mudo es de las cosas que más frustran.
- **Solo lectura ≠ deshabilitado.** Un dato relevante se muestra como par etiqueta-valor a contraste pleno, no como campo apagado.

### Presionado

Aplica a todo lo tocable, no solo botones.

- **Objetos compactos:** escala a 0.96 + cambio leve de luminosidad, vuelta en 120 ms.
- **Bloques anchos** (filas de ancho completo): solo cambio de superficie, sin escala.

### Selección múltiple

Es un estado de **pantalla**, no de fila. Se entra con pulsación larga o icon button. La fila de encabezado pasa a mostrar el conteo de seleccionados y cancelar; el botón fijo pasa a ser la acción sobre la selección. Check en contenedor circular a la izquierda de cada fila, y la fila seleccionada sube de contraste.

---

## 10. Avisos

### Toast

Vive **abajo, apilado sobre la bottom bar**, con su misma separación y sus mismos márgenes laterales.

- Píldora de superficie sólida, radio ≈ mitad de la altura, alto ~48 px, **ancho ajustado al contenido** con tope, no de borde a borde.
- Una sola línea. Si no entra, el mensaje está mal escrito.
- Sin ícono salvo que el estado no sea evidente por el texto.
- **Máximo una acción**, a la derecha, como texto en acento, no como botón. "Deshacer" es prácticamente la única que lo justifica. Dos acciones → es un sheet.
- **Duración:** 4 s sin acción, 6 s con acción. Tocarlo cancela el temporizador.
- **Uno a la vez, sin pila.** Un toast nuevo reemplaza al anterior.
- Entra deslizando desde abajo (200 ms), sale con fade y desplazamiento mínimo (150 ms). Se descarta con swipe hacia abajo.
- **Nunca es el único aviso de un error accionable.** El toast es para lo que se puede ignorar sin consecuencia.

### Banner

Para condiciones persistentes (offline). Ancho completo, arriba pegado al safe area, bajo contraste, **empuja el contenido en vez de taparlo**. Se va cuando se resuelve la condición, no por tiempo. Uno solo, y nunca dos mecanismos de aviso simultáneos.

---

## 11. Movimiento y gestos

**Base:** 150–250 ms, easing de salida rápida y entrada suave (`cubic-bezier(0.2, 0, 0, 1)`). La animación explica qué cambió y de dónde vino; si no explica nada, va fuera. Nada de fade-and-slide-up por sección al scrollear. `prefers-reduced-motion` respetado siempre.

### View transitions

**Solo cuando hay un elemento que persiste entre las dos pantallas.** El caso canónico: tarjeta del dashboard → página de detalle.

- Los elementos que continúan son el **ícono en su contenedor squircle** y el **título**. El resto entra con fade después de que la transformación termina.
- Duración ~300 ms, más larga que una transición normal porque hay cambio de posición y tamaño.
- Al volver, transición exactamente inversa: el elemento regresa a su posición en la lista. Si el origen ya no está visible, degrada al deslizamiento lateral.
- `view-transition-name` único por elemento — dos con el mismo nombre en pantalla hacen fallar la API en silencio. Fallback al deslizamiento lateral sin soporte.

### Scroll infinito

- Precarga cuando faltan **dos o tres pantallas** para el final, no al llegar al borde.
- Dos o tres skeletons de fila al final mientras carga. Si falla, una fila con reintentar en su lugar, sin toast.
- Cierre discreto al llegar al final, para que el usuario deje de tirar.
- **Guardar y restaurar la posición al volver del detalle** — obligatorio, o la view transition devuelve al principio de la lista y arruina el efecto.

### Formularios por pasos

- Progreso arriba: barra fina segmentada por pasos, no texto "2 de 4".
- Los pasos entran deslizando lateral, misma dirección que la navegación general.
- **Un paso, un objetivo.** Dos o tres campos como máximo.
- Botón de avanzar fijo abajo, ancho completo, deshabilitado hasta que el paso sea válido, con etiqueta específica en vez de "Siguiente" cuando se pueda.
- Volver es el icon button arriba a la izquierda. **Nunca se pierde lo escrito al retroceder.**
- Si el formulario vive en un sheet, usa la misma pila multipágina.

---

## 12. PWA

- `viewport-fit=cover` y safe areas manejadas arriba y abajo.
- `display: standalone`: sin barra de navegador, así que **cada vista secundaria necesita su propio botón de volver**.
- Estado offline como banner persistente; definir qué se puede seguir haciendo sin red.
- Prompt de instalación nunca al primer segundo: después de que el usuario haya hecho algo de valor.
- Pull-to-refresh en listas que cambian; desactivar el del navegador si compite con un gesto propio.
- Íconos del manifest con `purpose: maskable`.
- Imágenes en formatos modernos con dimensiones declaradas, para evitar saltos de layout.

---

## Checklist de entrega

- [ ] Funciona a 320 px sin scroll horizontal
- [ ] Todas las zonas táctiles ≥ 44 px
- [ ] Contraste 4.5:1 en texto, 3:1 en controles
- [ ] Carga, vacío y error diseñados en cada vista con datos
- [ ] Safe areas: barra flotante con `margin-bottom`, nunca padding; `100dvh`
- [ ] Sin dependencias de hover
- [ ] `prefers-reduced-motion` respetado
- [ ] Foco de teclado visible
- [ ] Teclado correcto en cada input
- [ ] `view-transition-name` únicos y con fallback
- [ ] Posición de scroll restaurada al volver del detalle
- [ ] Ningún elemento fijo tapa el final del contenido
