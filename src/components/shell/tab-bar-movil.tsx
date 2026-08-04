"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  estaActivo,
  navegacionPorRol,
  type DestinoNav,
  type Navegacion,
} from "@/lib/navegacion";
import type { RolUsuario } from "@/lib/auth/sesion";
import { IconoDestino } from "@/components/shell/iconos";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function Pestaña({
  destino,
  pendientesEmpleados,
}: {
  destino: DestinoNav;
  pendientesEmpleados: number;
}) {
  const pathname = usePathname();
  const activo = estaActivo(pathname, destino.href);
  const mostrarBadge = destino.href === "/empleados" && pendientesEmpleados > 0;

  return (
    <Link
      href={destino.href}
      prefetch
      aria-current={activo ? "page" : undefined}
      className="relative flex flex-1 flex-col items-center justify-center gap-0.5 pb-[env(safe-area-inset-bottom)] text-[0.7rem]"
    >
      <span
        className={cn(
          "relative flex h-8 items-center justify-center",
          activo && "text-primary",
        )}
      >
        {destino.destacado ? (
          <span className="bg-primary text-primary-foreground flex size-12 -translate-y-3 items-center justify-center rounded-full shadow-lg">
            <IconoDestino destino={destino} className="size-6" />
          </span>
        ) : (
          <IconoDestino
            destino={destino}
            className={cn("size-5", !activo && "text-muted-foreground")}
          />
        )}
        {mostrarBadge ? (
          <span className="bg-primary text-primary-foreground absolute top-0 right-1/2 translate-x-3 rounded-full px-1 text-[0.6rem] font-semibold">
            {pendientesEmpleados}
          </span>
        ) : null}
      </span>
      <span className={cn(activo && "font-semibold")}>{destino.etiqueta}</span>
    </Link>
  );
}

function masActivo(nav: Navegacion, pathname: string): boolean {
  return nav.mas.some((d) => estaActivo(pathname, d.href));
}

export function TabBarMovil({
  rol,
  pendientesEmpleados,
}: {
  rol: RolUsuario;
  pendientesEmpleados: number;
}) {
  const nav = navegacionPorRol(rol);
  const [masAbierto, setMasAbierto] = useState(false);
  const pathname = usePathname();

  return (
    <nav
      className="border-border bg-background fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {nav.tabs.map((destino) => (
        <Pestaña
          key={destino.href}
          destino={destino}
          pendientesEmpleados={pendientesEmpleados}
        />
      ))}

      <Sheet open={masAbierto} onOpenChange={setMasAbierto}>
        <SheetTrigger
          aria-label="Más opciones"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem]",
            masAbierto || masActivo(nav, pathname)
              ? "text-foreground"
              : "text-muted-foreground",
          )}
        >
          <Ellipsis className="size-5" aria-hidden="true" />
          Más
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Más opciones</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 pb-6">
            {nav.mas.map((destino) => (
              <SheetClose
                key={destino.href}
                render={<Link href={destino.href} prefetch />}
              >
                <span className="hover:bg-accent flex items-center gap-3 rounded-md px-2 py-2 text-sm">
                  <IconoDestino
                    destino={destino}
                    className={cn(
                      "size-4",
                      estaActivo(pathname, destino.href)
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="font-medium">{destino.etiqueta}</span>
                </span>
              </SheetClose>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
