import type { ReactNode } from "react";

/**
 * Fila compacta de catálogo administrativo — issue #68 (PWA-UI-06),
 * restilizada en el rediseño PWA 2026-09.
 *
 * Patrón único para Sedes, Empresas, Convenios y Usuarios en móvil
 * (<1024px): el mismo lenguaje de fila que la lista de movimientos del
 * dashboard (`.mob-movimiento`) — ícono en squircle, título y meta
 * truncada, estado a la derecha — sin tarjeta ni divisores. Toda la fila es
 * un único `<button>` nativo de 44px+ que abre el sheet de detalle; no hay
 * botones propios dentro que compitan por el toque.
 *
 * Solo vive en la rama `lg:hidden` de cada pantalla: el desktop aprobado
 * (tarjetas o tabla) no cambia.
 */
export function FilaCatalogoMovil({
  icono,
  titulo,
  badge,
  meta,
  onClick,
  ariaLabel,
}: {
  icono: ReactNode;
  titulo: ReactNode;
  badge?: ReactNode;
  /** Segunda línea, ya compuesta por el llamador (con sus propios "·"). */
  meta: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="mob-movimiento w-full text-left"
    >
      <span className="mob-movimiento-icono" aria-hidden="true">
        {icono}
      </span>
      <span className="min-w-0">
        <span className="mob-movimiento-titulo">{titulo}</span>
        <span className="mob-movimiento-meta">{meta}</span>
      </span>
      <span className="shrink-0">{badge}</span>
    </button>
  );
}

/** Separador "·" entre fragmentos de `meta`, con el `<span>` ya listo. */
export function PuntoSeparador() {
  return <span aria-hidden="true">·</span>;
}

/** Envoltorio de la lista compacta: una columna sin divisores, solo móvil. */
export function ListaCatalogoMovil({ children }: { children: ReactNode }) {
  return <div className="mob-movimientos lg:hidden">{children}</div>;
}
