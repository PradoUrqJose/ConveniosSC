"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { estaActivo, type DestinoNav } from "@/lib/navegacion";

type Props = {
  destino: DestinoNav;
  className?: string;
  children?: React.ReactNode;
};

/** Enlace de navegación con estado activo calculado desde la ruta actual. */
export function EnlaceNav({ destino, className, children }: Props) {
  const pathname = usePathname();
  const activo = estaActivo(pathname, destino.href);

  return (
    <Link
      href={destino.href}
      aria-current={activo ? "page" : undefined}
      title={destino.descripcion}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 text-sm transition-colors",
        activo
          ? "bg-foreground/10 font-semibold"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
