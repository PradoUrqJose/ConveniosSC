"use client";

import * as React from "react";
import { Drawer } from "@base-ui/react/drawer";
import { ChevronRight, ChevronLeft, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { decidirCierre, type RazonCierre } from "@/lib/capas-movil";

/**
 * Bottom sheet móvil — issue #54 (PWA-MOB-04).
 *
 * Mecanismo único de capa por debajo de 1024px (doc de diseño §5): filtros,
 * edición, detalle y confirmación entran por abajo, con la misma geometría,
 * el mismo cierre y la misma protección de formulario. La única excepción
 * declarada por el doc es el visor de imágenes.
 *
 * Se apoya en `Drawer` de Base UI, que ya resuelve lo caro y lo fácil de
 * romper a mano: gesto de arrastre, foco atrapado y restaurado al elemento
 * invocador, bloqueo del scroll de fondo y teclado virtual
 * (`VirtualKeyboardProvider`). Lo que aporta este archivo es el sistema:
 * alturas, pila multipágina, protección de cierre y variantes.
 *
 * Toda su piel vive en `globals.css` dentro del `@media (max-width:
 * 1023.98px)` del issue #51, así que el escritorio no puede heredarla ni
 * por accidente. Escritorio sigue usando `Dialog`; `components/ui/capa.tsx`
 * es el que elige uno u otro.
 */

export type AlturaSheet = "compacta" | "media" | "casi-completa";
export type TonoSheet = "neutro" | "destructivo";

/** Id reservado de la página de confirmación de descarte. */
const PAGINA_CONFIRMAR = "__confirmar-cierre";

type ContextoSheet = {
  pila: string[];
  paginaActual: string;
  hayPila: boolean;
  abrirPagina: (id: string) => void;
  volver: () => void;
  pendiente: boolean;
  /** Un hijo (un formulario) declara que tiene cambios sin guardar. */
  registrarCambios: (cambios: boolean) => void;
};

const Contexto = React.createContext<ContextoSheet | null>(null);

function useSheet(): ContextoSheet {
  const contexto = React.useContext(Contexto);
  if (!contexto) {
    throw new Error("Las partes de MobileSheet requieren <MobileSheet>.");
  }
  return contexto;
}

export function MobileSheet({
  abierto,
  alCerrar,
  altura = "media",
  pendiente = false,
  hayCambios = false,
  agarradera = false,
  rol = "dialog",
  paginaInicial = "raiz",
  textoDescartar = "Se perderá lo que escribiste en este formulario.",
  children,
}: {
  abierto: boolean;
  alCerrar: () => void;
  altura?: AlturaSheet;
  /** Operación en vuelo: nada cierra la capa mientras dure. */
  pendiente?: boolean;
  /** Cambios sin guardar declarados por quien monta el sheet. */
  hayCambios?: boolean;
  agarradera?: boolean;
  /** `alertdialog` para las confirmaciones irreversibles. */
  rol?: "dialog" | "alertdialog";
  paginaInicial?: string;
  textoDescartar?: string;
  children: React.ReactNode;
}) {
  const [pila, setPila] = React.useState<string[]>([paginaInicial]);
  const [cambiosInternos, setCambiosInternos] = React.useState(false);
  const confirmando = pila[pila.length - 1] === PAGINA_CONFIRMAR;
  const cambios = hayCambios || cambiosInternos;

  // Cada apertura empieza en la primera página: un sheet reabierto no debe
  // aparecer en la subpágina donde lo dejó el usuario la vez anterior. Es
  // el ajuste de estado en render que recomienda React para reaccionar a un
  // cambio de prop, no un efecto: así no hay un frame pintado con la pila
  // vieja ni una cascada de renders.
  const [abiertoPrevio, setAbiertoPrevio] = React.useState(abierto);
  if (abierto !== abiertoPrevio) {
    setAbiertoPrevio(abierto);
    if (!abierto) {
      setPila([paginaInicial]);
      setCambiosInternos(false);
    }
  }

  const abrirPagina = React.useCallback((id: string) => {
    setPila((actual) => [...actual, id]);
  }, []);

  const volver = React.useCallback(() => {
    setPila((actual) => (actual.length > 1 ? actual.slice(0, -1) : actual));
  }, []);

  const manejarCambio = React.useCallback(
    (siguiente: boolean, detalles: { reason: string; cancel: () => void }) => {
      if (siguiente) return;
      // La confirmación de descarte es una página *dentro* de la capa: si
      // ya está visible, el gesto se resuelve ahí y no se reevalúa.
      if (confirmando) {
        detalles.cancel();
        return;
      }
      const decision = decidirCierre({
        razon: detalles.reason as RazonCierre,
        hayCambios: cambios,
        pendiente,
      });
      if (decision === "cerrar") {
        alCerrar();
        return;
      }
      detalles.cancel();
      if (decision === "confirmar") abrirPagina(PAGINA_CONFIRMAR);
    },
    [abrirPagina, alCerrar, cambios, confirmando, pendiente],
  );

  const contexto = React.useMemo<ContextoSheet>(
    () => ({
      pila,
      paginaActual: pila[pila.length - 1] ?? paginaInicial,
      hayPila: pila.length > 1,
      abrirPagina,
      volver,
      pendiente,
      registrarCambios: setCambiosInternos,
    }),
    [abrirPagina, paginaInicial, pendiente, pila, volver],
  );

  return (
    <Drawer.Root
      open={abierto}
      onOpenChange={manejarCambio}
      swipeDirection="down"
      modal
    >
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          {/* Doc §5: el fondo NO se atenúa. La capa se separa por su propia
              superficie y una sombra amplia hacia arriba. El backdrop sigue
              existiendo para capturar el toque fuera y marcar la modalidad. */}
          <Drawer.Backdrop className="mob-sheet-fondo" />
          <Drawer.Viewport className="mob-sheet-viewport">
            <Drawer.Popup className="mob-sheet" data-altura={altura} role={rol}>
              <Drawer.Content className="mob-sheet-contenido">
                {agarradera ? (
                  <span className="mob-sheet-agarradera" aria-hidden="true" />
                ) : null}
                <Contexto.Provider value={contexto}>
                  {children}
                  {confirmando ? (
                    <ConfirmarDescarte
                      texto={textoDescartar}
                      alDescartar={alCerrar}
                      alSeguir={volver}
                    />
                  ) : null}
                </Contexto.Provider>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}

/**
 * Una página del sheet.
 *
 * Se montan las páginas que están en la pila y se oculta con `hidden` la
 * que no es la de arriba. No se desmontan: una subpágina —o la propia
 * confirmación de descarte— desmontaría el formulario de abajo y con él
 * todo lo escrito, que es exactamente lo que la protección de cierre
 * intenta salvar. `hidden` las saca del árbol de accesibilidad y del orden
 * de tabulación, así que ocultas no las recorre nadie.
 */
export function MobileSheetPagina({
  id,
  titulo,
  descripcion,
  children,
  className,
}: {
  id: string;
  /** Si se pasa, la página dibuja su propio encabezado. */
  titulo?: React.ReactNode;
  descripcion?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const { paginaActual, pila } = useSheet();
  const contenedor = React.useRef<HTMLDivElement>(null);
  const activa = paginaActual === id;
  const enPila = pila.includes(id);
  // Al empujar una subpágina el control que la abrió se oculta: sin esto el
  // foco caería al `<body>`. La primera página no se toca — ahí manda el
  // foco inicial de Base UI.
  const esSubpagina = pila.length > 1 && pila[0] !== id;

  React.useEffect(() => {
    if (activa && esSubpagina) contenedor.current?.focus();
  }, [activa, esSubpagina]);

  if (!enPila) return null;

  return (
    <div
      ref={contenedor}
      data-slot="mobile-sheet-pagina"
      data-pagina={id}
      tabIndex={-1}
      hidden={!activa}
      inert={!activa}
      className={cn("mob-sheet-pagina", className)}
    >
      {titulo !== undefined ? (
        <MobileSheetEncabezado>
          <MobileSheetTitulo>{titulo}</MobileSheetTitulo>
          {descripcion ? (
            <MobileSheetDescripcion>{descripcion}</MobileSheetDescripcion>
          ) : null}
        </MobileSheetEncabezado>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Encabezado: título grande a la izquierda y un único botón circular a la
 * derecha (doc §5). Ese botón es la X en la primera página y la flecha de
 * volver mientras haya pila — nunca los dos a la vez.
 */
export function MobileSheetEncabezado({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { hayPila, volver, pendiente } = useSheet();
  return (
    <header
      data-slot="mobile-sheet-encabezado"
      className={cn("mob-sheet-encabezado", className)}
    >
      <div className="mob-sheet-encabezado-texto">{children}</div>
      {hayPila ? (
        <button
          type="button"
          onClick={volver}
          disabled={pendiente}
          aria-label="Volver"
          className="mob-sheet-boton-circular"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
      ) : (
        <Drawer.Close
          disabled={pendiente}
          aria-label="Cerrar"
          className="mob-sheet-boton-circular"
        >
          <X className="size-5" aria-hidden="true" />
        </Drawer.Close>
      )}
    </header>
  );
}

export function MobileSheetTitulo({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Title>) {
  return (
    <Drawer.Title className={cn("mob-sheet-titulo", className)} {...props} />
  );
}

export function MobileSheetDescripcion({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Description>) {
  return (
    <Drawer.Description
      className={cn("mob-sheet-descripcion", className)}
      {...props}
    />
  );
}

/** Cuerpo desplazable. El único scroll de la capa: nunca hay doble scroll. */
export function MobileSheetCuerpo({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mobile-sheet-cuerpo"
      className={cn("mob-sheet-cuerpo", className)}
      {...props}
    />
  );
}

/**
 * Acción principal fija abajo, ancho completo (doc §5). Paga el safe area y
 * el alto del teclado virtual (`--drawer-keyboard-inset`, que expone
 * `VirtualKeyboardProvider`; el fallback `0px` es obligatorio porque la
 * variable solo existe mientras el teclado está alineado).
 */
export function MobileSheetAcciones({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mobile-sheet-acciones"
      className={cn("mob-sheet-acciones", className)}
      {...props}
    />
  );
}

/**
 * Formulario dentro del sheet: el `<form>` envuelve cuerpo y acciones (para
 * que el submit funcione), pero solo el cuerpo desplaza. Declara "hay
 * cambios" al primer input, que es lo que activa la protección de cierre.
 */
export function MobileSheetFormulario({
  className,
  children,
  onInputCapture,
  onChangeCapture,
  ...props
}: React.ComponentProps<"form">) {
  const { registrarCambios } = useSheet();
  return (
    <form
      data-slot="mobile-sheet-formulario"
      className={cn("mob-sheet-formulario", className)}
      onInputCapture={(evento) => {
        registrarCambios(true);
        onInputCapture?.(evento);
      }}
      onChangeCapture={(evento) => {
        registrarCambios(true);
        onChangeCapture?.(evento);
      }}
      {...props}
    >
      {children}
    </form>
  );
}

const VARIANTES_BOTON = {
  primario: "mob-boton mob-boton-primario",
  secundario: "mob-boton mob-boton-secundario",
  destructivo: "mob-boton mob-sheet-boton-destructivo",
  terciario: "mob-boton-terciario",
} as const;

export function MobileSheetBoton({
  variante = "primario",
  className,
  cargando = false,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  variante?: keyof typeof VARIANTES_BOTON;
  cargando?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="mobile-sheet-boton"
      className={cn(VARIANTES_BOTON[variante], className)}
      {...props}
    >
      {cargando ? (
        <Loader2
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

/** Cierra la capa pasando por la misma protección que Escape o el arrastre. */
export function MobileSheetCerrar({
  className,
  variante = "secundario",
  children,
  ...props
}: React.ComponentProps<"button"> & {
  variante?: keyof typeof VARIANTES_BOTON;
}) {
  const { pendiente } = useSheet();
  return (
    <Drawer.Close
      disabled={pendiente}
      className={cn(VARIANTES_BOTON[variante], className)}
      {...props}
    >
      {children}
    </Drawer.Close>
  );
}

/**
 * Fila de opción que empuja una subpágina (doc §4 y §7): pill con el valor
 * elegido + chevron. Nunca despliega un dropdown ni abre otra capa encima.
 */
export function MobileSheetFilaOpcion({
  etiqueta,
  valor,
  pagina,
  className,
}: {
  etiqueta: string;
  valor: string;
  pagina: string;
  className?: string;
}) {
  const { abrirPagina, pendiente } = useSheet();
  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => abrirPagina(pagina)}
      className={cn("mob-sheet-fila-opcion", className)}
    >
      <span className="mob-sheet-fila-etiqueta">{etiqueta}</span>
      <span className="mob-sheet-fila-valor">
        <span className="mob-pill">{valor}</span>
        <ChevronRight className="size-4 opacity-60" aria-hidden="true" />
      </span>
    </button>
  );
}

/**
 * Fila de acción de un sheet de menú: ícono a la izquierda (distingue
 * categorías, doc §4), etiqueta, y chevron solo si empuja una subpágina.
 */
export function MobileSheetFilaAccion({
  icono,
  etiqueta,
  onClick,
  pagina,
  tono = "neutro",
  className,
}: {
  icono?: React.ReactNode;
  etiqueta: React.ReactNode;
  onClick?: () => void;
  /** Si se pasa, la fila empuja esa subpágina dentro de la misma capa. */
  pagina?: string;
  tono?: TonoSheet;
  className?: string;
}) {
  const { abrirPagina, pendiente } = useSheet();
  return (
    <button
      type="button"
      disabled={pendiente}
      data-tono={tono}
      onClick={() => (pagina ? abrirPagina(pagina) : onClick?.())}
      className={cn("mob-sheet-fila-accion", className)}
    >
      {icono ? (
        <span className="mob-sheet-fila-icono" aria-hidden="true">
          {icono}
        </span>
      ) : null}
      <span className="mob-sheet-fila-etiqueta">{etiqueta}</span>
      {pagina ? (
        <ChevronRight className="size-4 opacity-60" aria-hidden="true" />
      ) : null}
    </button>
  );
}

/**
 * Selección persistente (doc §7): el elegido sube de contraste y el resto
 * se apaga. Sin checkmarks flotantes ni bordes de color.
 */
export function MobileSheetOpciones({
  etiqueta,
  opciones,
  valor,
  alElegir,
}: {
  etiqueta: string;
  opciones: { valor: string; etiqueta: string }[];
  valor: string;
  alElegir: (valor: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="mob-sheet-opciones">
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          role="radio"
          aria-checked={opcion.valor === valor}
          data-elegida={opcion.valor === valor}
          onClick={() => alElegir(opcion.valor)}
          className="mob-sheet-opcion"
        >
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  );
}

/** Error inline: se anuncia sin sacar al usuario de la capa. */
export function MobileSheetError({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <p id={id} role="alert" aria-live="assertive" className="mob-sheet-error">
      {children}
    </p>
  );
}

/** Estado de carga inline, con nombre accesible propio. */
export function MobileSheetCargando({ etiqueta }: { etiqueta: string }) {
  return (
    <p role="status" className="mob-sheet-cargando">
      <Loader2
        className="size-4 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      {etiqueta}
    </p>
  );
}

/**
 * Confirmación de descarte — variante "decisión" del doc §5: composición
 * centrada, destructivo arriba y cancelar debajo, y ocurre *dentro* de la
 * misma capa, sin encadenar un modal sobre otro.
 */
function ConfirmarDescarte({
  texto,
  alDescartar,
  alSeguir,
}: {
  texto: string;
  alDescartar: () => void;
  alSeguir: () => void;
}) {
  const seguirRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    // Nunca se enfoca la acción destructiva.
    seguirRef.current?.focus();
  }, []);
  return (
    <div
      data-slot="mobile-sheet-confirmar"
      role="alertdialog"
      aria-label="Descartar cambios"
      className="mob-sheet-pagina mob-sheet-confirmar"
    >
      <div className="mob-sheet-cuerpo">
        <p className="mob-sheet-confirmar-titulo">¿Descartar los cambios?</p>
        <p className="mob-sheet-confirmar-texto">{texto}</p>
      </div>
      {/* `.mob-sheet-acciones` invierte el orden visual: en pantalla queda
          el destructivo arriba y "Seguir editando" debajo (doc §5), pero
          en el DOM —y por tanto en la tabulación y en el foco inicial—
          manda la salida segura. */}
      <MobileSheetAcciones>
        <button
          type="button"
          ref={seguirRef}
          onClick={alSeguir}
          className="mob-boton mob-boton-secundario"
        >
          Seguir editando
        </button>
        <button
          type="button"
          onClick={alDescartar}
          className="mob-boton mob-sheet-boton-destructivo"
        >
          Descartar
        </button>
      </MobileSheetAcciones>
    </div>
  );
}
