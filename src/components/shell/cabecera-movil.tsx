"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Globe2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useCuentaMovil } from "@/components/shell/contexto-cuenta-movil";
import { iniciarTransicionMovil } from "@/lib/transicion-movil";

export type VarianteCabeceraMovil = "raiz" | "secundaria" | "formulario";

export type AtrasMovil = {
  /** Destino cuando no hay historial propio (arranque en frío de la PWA). */
  href: string;
  /** Nombre accesible del control, p. ej. "Volver a ventas". */
  etiqueta: string;
};

/**
 * Back iconográfico de las pantallas secundarias — issue #52.
 *
 * Es un `<a>` real, no un `<button>`: así conserva el destino en el menú
 * contextual, el "abrir en otra pestaña" y —lo importante— funciona si el
 * JS todavía no hidrató. Cuando sí hay historial propio de la app, el clic
 * se intercepta y se hace `router.back()` para preservar el scroll y el
 * estado de la pantalla anterior en vez de empujar una entrada nueva.
 *
 * `history.state.idx` es el índice que mantiene el App Router: vale 0 en la
 * primera entrada de la sesión de navegación —justo el caso del arranque en
 * standalone desde el icono de la home— y ahí se deja pasar la navegación
 * normal hacia `href`, que es el fallback.
 */
export function BotonAtrasMovil({ href, etiqueta }: AtrasMovil) {
  const router = useRouter();

  function alHacerClic(evento: MouseEvent<HTMLAnchorElement>) {
    if (
      evento.defaultPrevented ||
      evento.button !== 0 ||
      evento.metaKey ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey
    ) {
      return;
    }
    // La transición lateral (issue #70) se inicia acá porque acá es donde
    // se decide "volver": `startViewTransition` toma la foto de esta
    // pantalla en el mismo clic, antes de que la navegación (cualquiera de
    // las dos ramas) reemplace el contenido.
    iniciarTransicionMovil("atras");
    const indice = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof indice === "number" && indice > 0) {
      evento.preventDefault();
      router.back();
    }
  }

  return (
    <Link
      href={href}
      aria-label={etiqueta}
      onClick={alHacerClic}
      className="mob-cabecera-atras"
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
    </Link>
  );
}

/**
 * Context pill de empresa/alcance — issue #52.
 *
 * Solo aporta cuando cambia la lectura de los datos de la pantalla: qué
 * empresa acota lo que se ve, o que no hay acotación (SUPERADMIN). Por eso
 * no se pinta en pantallas de cuenta ni en formularios.
 */
export function ContextoMovil() {
  const cuenta = useCuentaMovil();
  if (!cuenta) return null;
  const empresa = cuenta.perfil.empresaNombre;
  const Icono = empresa ? Building2 : Globe2;
  return (
    <p className="mob-cabecera-contexto">
      <Icono className="size-3 shrink-0" aria-hidden="true" />
      <span>{empresa ?? "Todas las empresas"}</span>
    </p>
  );
}

/**
 * Entrada a la cuenta desde las cabeceras raíz — issue #52.
 *
 * Al quitar el header global de móvil, tema, contraseña, instalación y
 * cierre de sesión perdían su único acceso: la barra inferior no tiene
 * pestaña de perfil. Todas esas acciones secundarias viven ahora en
 * `/perfil`, y este avatar de 44x44 es el camino hacia allí.
 */
export function AccionCuentaMovil() {
  const cuenta = useCuentaMovil();
  if (!cuenta) return null;
  const { nombres, apellidos } = cuenta.perfil;
  const iniciales =
    `${nombres[0] ?? ""}${apellidos[0] ?? ""}`.toUpperCase() || "U";
  return (
    <Link
      href="/perfil"
      aria-label={`Tu cuenta: ${nombres} ${apellidos}`}
      className="mob-cabecera-cuenta"
    >
      <span aria-hidden="true">{iniciales}</span>
    </Link>
  );
}

/**
 * Cabecera de pantalla del shell móvil — issue #52 (PWA-MOB-02).
 *
 * Vive dentro del contenido y se va con el scroll: en móvil no hay chrome
 * superior fijo (doc §1, principio 1). Las tres variantes comparten
 * geometría y se diferencian en qué controles admiten:
 *
 * - `raiz`: destinos de la barra inferior. Contexto + título + acciones.
 * - `secundaria`: se llegó desde otra pantalla. Back + título.
 * - `formulario`: flujo concentrado. Back + título, sin acciones que
 *   compitan con el CTA.
 *
 * El título nunca se trunca (ver `.mob-cabecera-titulo`) y todo control
 * mide como mínimo 44x44 px.
 */
export function CabeceraMovil({
  titulo,
  variante = "raiz",
  nivel = "h1",
  contexto,
  atras,
  acciones,
  className,
}: {
  /** Omitirlo deja la cabecera como barra de contexto y acciones: sirve
   *  para pantallas cuyo título ya lo da un hero dentro del contenido. */
  titulo?: string;
  variante?: VarianteCabeceraMovil;
  /** `p` cuando el `h1` de la pantalla ya está en el contenido. */
  nivel?: "h1" | "p";
  contexto?: ReactNode;
  atras?: AtrasMovil;
  acciones?: ReactNode;
  className?: string;
}) {
  const Titulo = nivel;
  return (
    <header data-variante={variante} className={cn("mob-cabecera", className)}>
      {atras ? <BotonAtrasMovil {...atras} /> : null}
      {contexto || titulo ? (
        <div className="mob-cabecera-texto">
          {contexto}
          {titulo ? (
            <Titulo className="mob-cabecera-titulo">{titulo}</Titulo>
          ) : null}
        </div>
      ) : (
        <div className="mob-cabecera-texto" />
      )}
      {acciones ? (
        <div className="mob-cabecera-acciones">{acciones}</div>
      ) : null}
    </header>
  );
}
