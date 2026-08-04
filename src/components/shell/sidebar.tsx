"use client";

import { LogOut } from "lucide-react";

import { EnlaceNav } from "@/components/shell/enlace-nav";
import { IconoDestino } from "@/components/shell/iconos";
import type { Navegacion } from "@/lib/navegacion";
import type { PerfilNav } from "@/lib/auth/perfil";
import { cerrarSesion } from "@/modules/auth/actions";

export function Sidebar({
  nav,
  perfil,
  pendientesEmpleados,
}: {
  nav: Navegacion;
  perfil: PerfilNav;
  pendientesEmpleados: number;
}) {
  const destinoEmpleados = nav.lateral.find((d) => d.href === "/empleados");

  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <span className="text-lg font-semibold tracking-tight">Convenios</span>
        {perfil.empresaNombre ? (
          <span className="text-muted-foreground truncate text-sm">
            · {perfil.empresaNombre}
          </span>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.lateral.map((destino) => (
          <EnlaceNav key={destino.href} destino={destino} className="h-9">
            <IconoDestino destino={destino} className="size-4" />
            <span className="truncate">{destino.etiqueta}</span>
            {destinoEmpleados &&
            destino.href === "/empleados" &&
            pendientesEmpleados > 0 ? (
              <span className="bg-primary text-primary-foreground ml-auto rounded-full px-1.5 py-0.5 text-xs font-semibold">
                {pendientesEmpleados}
              </span>
            ) : null}
          </EnlaceNav>
        ))}

        {nav.mas.length > 0 ? (
          <>
            <div className="text-muted-foreground pt-4 pb-2 pl-3 text-xs font-medium tracking-wide uppercase">
              Más
            </div>
            {nav.mas.map((destino) => (
              <EnlaceNav key={destino.href} destino={destino} className="h-9">
                <IconoDestino destino={destino} className="size-4" />
                <span className="truncate">{destino.etiqueta}</span>
              </EnlaceNav>
            ))}
          </>
        ) : null}
      </nav>

      <div className="border-t p-3">
        <div className="text-muted-foreground mb-2 px-2 text-sm">
          {perfil.nombres} {perfil.apellidos}
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm transition-colors"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
