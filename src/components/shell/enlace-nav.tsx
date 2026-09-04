"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { estaActivo, type DestinoNav } from "@/lib/navegacion";

type Props = {
  destino: DestinoNav;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Respuesta local al clic cuando el prefetch todavía no terminó. El espacio
 * está siempre reservado para que el indicador no desplace el texto del menú.
 */
function IndicadorNavegacion() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      data-pending={pending ? "true" : "false"}
      className="ml-auto size-2 shrink-0 rounded-full bg-cyan-200 opacity-0 transition-opacity data-[pending=true]:animate-pulse data-[pending=true]:opacity-100 motion-reduce:animate-none"
    />
  );
}

/** Enlace de navegación con estado activo calculado desde la ruta actual. */
export function EnlaceNav({ destino, className, children }: Props) {
  const pathname = usePathname();
  const activo = estaActivo(pathname, destino.href);

  return (
    <Link
      href={destino.href}
      prefetch
      aria-current={activo ? "page" : undefined}
      title={destino.descripcion}
      className={cn(
        "group/nav relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3.5 text-sm font-semibold transition-all duration-200",
        activo
          ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.1),0_10px_24px_rgba(0,0,0,.14)]"
          : "text-slate-400 hover:bg-white/7 hover:text-white",
        className,
      )}
    >
      {activo ? (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-cyan-300" />
      ) : null}
      {children}
      <IndicadorNavegacion />
    </Link>
  );
}
