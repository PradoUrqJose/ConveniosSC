import type { ReactNode } from "react";

/**
 * Fila compacta de catálogo administrativo — issue #68 (PWA-UI-06).
 *
 * Patrón único para Sedes, Empresas, Convenios y Usuarios en móvil
 * (<1024px), donde antes cada pantalla repetía su propia tarjeta alta con
 * botones de 28px («Sedes usa tarjetas con mucho vacío... Usuarios coloca
 * cuatro filtros antes de tarjetas muy altas»). Es el mismo recorte que
 * `FilaEmpleadoMovil` del issue #67: identidad + estado en la primera
 * línea, meta truncada en la segunda, 56–64px de alto y toda la fila como
 * único `<button>` nativo de 44px+ que abre el sheet de detalle — no hay
 * botones propios dentro de la fila que compitan por el toque.
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
      className="hover:bg-primary/[0.025] flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left"
    >
      <span className="from-primary/15 text-primary grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br to-cyan-400/15">
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">{titulo}</span>
          {badge ? <span className="ml-auto shrink-0">{badge}</span> : null}
        </span>
        <span className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-xs">
          {meta}
        </span>
      </span>
    </button>
  );
}

/** Separador "·" entre fragmentos de `meta`, con el `<span>` ya listo. */
export function PuntoSeparador() {
  return <span aria-hidden="true">·</span>;
}

/** Envoltorio de la lista compacta: una columna con divisores, solo móvil. */
export function ListaCatalogoMovil({ children }: { children: ReactNode }) {
  return <div className="divide-y lg:hidden">{children}</div>;
}
