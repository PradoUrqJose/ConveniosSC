"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  estaActivo,
  navegacionPorRol,
  type DestinoNav,
} from "@/lib/navegacion";
import type { RolUsuario } from "@/lib/auth/sesion";
import { IconoDestino } from "@/components/shell/iconos";

function Pestaña({
  destino,
  pendientesEmpleados,
}: {
  destino: DestinoNav;
  pendientesEmpleados: ReactNode;
}) {
  const pathname = usePathname();
  const activo = estaActivo(pathname, destino.href);
  const mostrarBadge = destino.href === "/empleados";

  if (destino.destacado) {
    return (
      <Link
        href={destino.href}
        prefetch
        aria-label={destino.etiqueta}
        aria-current={activo ? "page" : undefined}
        className="flex min-w-0 flex-1 items-start justify-center"
      >
        <span className="from-primary to-primary/85 text-primary-foreground shadow-primary/35 ring-background flex size-[3.1rem] -translate-y-4 items-center justify-center rounded-[1.1rem] bg-linear-to-br shadow-lg ring-4 transition-transform active:scale-95">
          <IconoDestino destino={destino} className="size-6" />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={destino.href}
      prefetch
      aria-current={activo ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.63rem] font-semibold transition-colors",
        activo ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className="relative flex h-6 items-center justify-center">
        <IconoDestino destino={destino} className="size-[1.3rem]" />
        {mostrarBadge ? pendientesEmpleados : null}
      </span>
      <span className="w-full truncate px-0.5 text-center">
        {destino.etiqueta}
      </span>
    </Link>
  );
}

export function TabBarMovil({
  rol,
  pendientesEmpleados,
}: {
  rol: RolUsuario;
  pendientesEmpleados: ReactNode;
}) {
  const nav = navegacionPorRol(rol);

  return (
    <nav
      aria-label="Navegación principal"
      className="border-border/70 bg-background/92 fixed inset-x-0 bottom-0 z-40 border-t shadow-[0_-10px_35px_rgba(15,23,42,.08)] backdrop-blur-2xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-[3.6rem] items-stretch">
        {nav.tabs.map((destino) => (
          <Pestaña
            key={destino.href}
            destino={destino}
            pendientesEmpleados={pendientesEmpleados}
          />
        ))}
      </div>
    </nav>
  );
}
