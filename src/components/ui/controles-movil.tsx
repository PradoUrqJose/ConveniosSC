"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Controles táctiles del sistema móvil — issue #55 (PWA-MOB-05).
 *
 * Estas son las variantes móviles que pide el issue de Button, IconButton,
 * Input, Select, LinkAction y MenuTrigger. Existen por dos razones que no
 * resuelve la red de seguridad CSS de `globals.css`:
 *
 * 1. La red de seguridad garantiza la *geometría* (44x44 mínimo, 16px de
 *    texto) de cualquier control heredado del escritorio. Estos componentes
 *    garantizan además la *semántica*: un botón es un `<button>` nativo, un
 *    destino es un `<a>` real, un campo trae etiqueta persistente y sus
 *    mensajes enlazados con `aria-describedby`. Eso no lo puede arreglar
 *    una hoja de estilos.
 * 2. Las migraciones de pantalla (MOB-06 en adelante) necesitan un lugar
 *    único donde vivan pressed / focus-visible / disabled / pendiente /
 *    error, para no re-inventarlos —cada uno un poco distinto— pantalla
 *    por pantalla.
 *
 * Toda la piel vive en `globals.css` dentro del `@media (max-width:
 * 1023.98px)` del issue #51: a 1024px o más esas clases no existen, así que
 * ninguno de estos componentes puede alterar el escritorio aprobado. Son
 * para usarse en árboles que ya son exclusivamente móviles (dentro de un
 * `MobileSheet`, de una pantalla `.mob-shell` o de una rama `lg:hidden`).
 *
 * Ninguno declara `:hover`. En un dispositivo táctil el hover no existe, y
 * cuando el navegador lo simula se queda pegado después del toque dejando
 * el control encendido y mintiendo sobre dónde está el foco.
 */

export type TonoBotonMovil =
  "primario" | "secundario" | "terciario" | "destructivo";

const CLASES_BOTON: Record<TonoBotonMovil, string> = {
  primario: "mob-boton mob-boton-primario",
  secundario: "mob-boton mob-boton-secundario",
  terciario: "mob-boton-terciario",
  destructivo: "mob-boton mob-sheet-boton-destructivo",
};

/**
 * Indicador de operación en vuelo, compartido por botones y enlaces.
 *
 * El control conserva su tamaño y su etiqueta: reemplazar el texto por un
 * spinner encoge el botón y mueve todo lo que tiene debajo justo cuando el
 * usuario acaba de tocar, que es el peor momento posible para mover el
 * layout. El spinner se suma, no sustituye.
 */
function Girando() {
  return (
    <Loader2
      className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
  );
}

/**
 * Botón móvil. Siempre un `<button>` nativo con `type` explícito: un botón
 * sin `type` dentro de un formulario envía el formulario, que es el bug
 * silencioso más caro de esta familia.
 *
 * `pendiente` deja el control visible y medible pero inerte, y lo anuncia
 * con `aria-busy` para el lector de pantalla.
 */
export function BotonMovil({
  tono = "primario",
  pendiente = false,
  type = "button",
  className,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  tono?: TonoBotonMovil;
  pendiente?: boolean;
}) {
  return (
    <button
      type={type}
      data-slot="mob-boton"
      data-pendiente={pendiente || undefined}
      aria-busy={pendiente || undefined}
      disabled={disabled}
      className={cn(CLASES_BOTON[tono], "gap-2", className)}
      {...props}
    >
      {pendiente ? <Girando /> : null}
      {children}
    </button>
  );
}

/**
 * Botón de ícono (IconButton). `etiqueta` es obligatoria y no opcional a
 * propósito: un control cuyo contenido es solo un glifo no tiene nombre
 * accesible, y sin nombre no existe para VoiceOver ni para TalkBack.
 *
 * El ícono puede medir 16 o 20px; el área táctil la fija `.mob-boton-icono`
 * en 44x44 y no se puede bajar desde la pantalla.
 */
export function BotonIconoMovil({
  etiqueta,
  tono = "superficie",
  pendiente = false,
  type = "button",
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  etiqueta: string;
  tono?: "superficie" | "plano";
  pendiente?: boolean;
}) {
  return (
    <button
      type={type}
      data-slot="mob-boton-icono"
      data-tono={tono}
      data-pendiente={pendiente || undefined}
      aria-label={etiqueta}
      aria-busy={pendiente || undefined}
      className={cn("mob-boton-icono", className)}
      {...props}
    >
      {pendiente ? <Girando /> : children}
    </button>
  );
}

/**
 * Enlace de acción (LinkAction). Se ve como un control y por dentro es un
 * `<a>` real.
 *
 * Es la corrección de semántica que pide el issue: envolver un enlace en la
 * primitiva `Button` de Base UI provoca su aviso de consola (espera un
 * `<button>` nativo), y "callarlo" con `nativeButton={false}` es peor,
 * porque le pone `role="button"` a un destino y el lector de pantalla deja
 * de anunciarlo como enlace. Un destino es navegación: se marca como
 * navegación y conserva "abrir en otra pestaña", el menú contextual y el
 * funcionamiento antes de que hidrate el JS.
 */
export function EnlaceAccionMovil({
  href,
  tono = "superficie",
  externo = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string;
  tono?: "superficie" | "acento" | "plano";
  /** Descargas y rutas de API: `<a>` nativo, sin prefetch del App Router. */
  externo?: boolean;
}) {
  const clases = cn("mob-enlace-accion", className);
  if (externo) {
    // `prefetch` es del App Router: en un `<a>` nativo sería un atributo
    // desconocido y React avisaría por consola.
    const resto = { ...props, prefetch: undefined };
    delete resto.prefetch;
    return (
      <a
        href={href}
        data-slot="mob-enlace-accion"
        data-tono={tono}
        className={clases}
        {...(resto as React.ComponentProps<"a">)}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      data-slot="mob-enlace-accion"
      data-tono={tono}
      className={clases}
      {...props}
    >
      {children}
    </Link>
  );
}

/**
 * Disparador de menú o de capa (MenuTrigger).
 *
 * Pensado para ir en el `render` de un `DropdownMenuTrigger` de Base UI o
 * para abrir un `MobileSheet` a mano. Es un `<button>` nativo —que es
 * justo lo que Base UI espera recibir— con nombre accesible obligatorio y
 * `aria-haspopup` correcto según lo que abra.
 */
export function DisparadorMenuMovil({
  etiqueta,
  abre = "menu",
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  etiqueta: string;
  abre?: "menu" | "dialog" | "listbox";
}) {
  return (
    <button
      type="button"
      data-slot="mob-disparador-menu"
      aria-label={etiqueta}
      aria-haspopup={abre}
      className={cn("mob-boton-icono", className)}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Etiqueta + control + ayuda + error, con los ids ya enlazados.
 *
 * `CampoMovil` y `SelectorMovil` comparten esta envoltura para que la parte
 * accesible no se decida por pantalla: la etiqueta es persistente (nunca un
 * placeholder haciendo de label, porque desaparece al escribir y con él la
 * única pista de qué se está escribiendo), la ayuda y el error se enlazan
 * con `aria-describedby`, y el error además viaja por `aria-invalid` para
 * que no sea solo un color.
 */
function useCampo({
  id,
  ayuda,
  error,
}: {
  id?: string;
  ayuda?: React.ReactNode;
  error?: string;
}) {
  const auto = React.useId();
  const idCampo = id ?? auto;
  const idAyuda = `${idCampo}-ayuda`;
  const idError = `${idCampo}-error`;
  const describedBy =
    [ayuda ? idAyuda : null, error ? idError : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return { idCampo, idAyuda, idError, describedBy };
}

function Envoltura({
  idCampo,
  idAyuda,
  idError,
  etiqueta,
  ayuda,
  error,
  className,
  children,
}: {
  idCampo: string;
  idAyuda: string;
  idError: string;
  etiqueta: string;
  ayuda?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={idCampo} className="mob-campo-etiqueta">
        {etiqueta}
      </label>
      {children}
      {ayuda ? (
        <p id={idAyuda} className="mob-campo-ayuda">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        // `role="alert"` y no solo el color: el error tiene que llegar
        // también a quien no puede verlo.
        <p id={idError} role="alert" className="mob-campo-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Campo de texto móvil.
 *
 * Fija los 16px de font-size (menos que eso hace que Safari iOS haga zoom
 * al enfocar y deje el formulario descuadrado) y los 44px de alto, y exige
 * `etiqueta`. `autoComplete` e `inputMode` se pasan tal cual: son lo que
 * decide si el teclado del sistema aparece numérico, si el gestor de
 * contraseñas ofrece la clave y si el autocompletado del teléfono funciona.
 */
export function CampoMovil({
  etiqueta,
  ayuda,
  error,
  id,
  className,
  claseCampo,
  ...props
}: Omit<React.ComponentProps<"input">, "id"> & {
  etiqueta: string;
  ayuda?: React.ReactNode;
  error?: string;
  id?: string;
  /** Ajustes de la caja del input (ancho, fuente mono, etc.). */
  claseCampo?: string;
}) {
  const { idCampo, idAyuda, idError, describedBy } = useCampo({
    id,
    ayuda,
    error,
  });
  return (
    <Envoltura
      idCampo={idCampo}
      idAyuda={idAyuda}
      idError={idError}
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      className={className}
    >
      <input
        id={idCampo}
        data-slot="mob-campo"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("mob-campo", claseCampo)}
        {...props}
      />
    </Envoltura>
  );
}

/**
 * Selector móvil: `<select>` nativo, no un popup propio.
 *
 * En un teléfono la rueda del sistema le gana a cualquier menú que
 * dibujemos nosotros — no se sale de la pantalla, ya es accesible, ya trae
 * el target táctil correcto y es el gesto que el usuario tiene aprendido.
 * Los popups propios se reservan para lo que el nativo no sabe hacer
 * (buscar dentro de las opciones, mostrar dos líneas por opción), y ese
 * caso vive en el `MobileSheet` como subpágina de selección, no acá.
 */
export function SelectorMovil({
  etiqueta,
  ayuda,
  error,
  id,
  className,
  claseCampo,
  children,
  ...props
}: Omit<React.ComponentProps<"select">, "id"> & {
  etiqueta: string;
  ayuda?: React.ReactNode;
  error?: string;
  id?: string;
  claseCampo?: string;
}) {
  const { idCampo, idAyuda, idError, describedBy } = useCampo({
    id,
    ayuda,
    error,
  });
  return (
    <Envoltura
      idCampo={idCampo}
      idAyuda={idAyuda}
      idError={idError}
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      className={className}
    >
      <select
        id={idCampo}
        data-slot="mob-selector"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("mob-campo mob-select", claseCampo)}
        {...props}
      >
        {children}
      </select>
    </Envoltura>
  );
}
