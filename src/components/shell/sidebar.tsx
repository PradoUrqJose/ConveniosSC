"use client";

import Link from "next/link";
import { LogOut, Settings2 } from "lucide-react";
import type { ReactNode } from "react";

import { EnlaceNav } from "@/components/shell/enlace-nav";
import { IconoDestino } from "@/components/shell/iconos";
import type { Navegacion } from "@/lib/navegacion";
import type { PerfilNav } from "@/lib/auth/perfil";
import { cerrarSesion } from "@/modules/auth/actions";
import { Marca } from "@/components/shell/marca";

export function Sidebar({
  nav,
  perfil,
  pendientesEmpleados,
}: {
  nav: Navegacion;
  perfil: PerfilNav;
  pendientesEmpleados: ReactNode;
}) {
  const rutasOperacion = new Set([
    "/",
    "/dashboard",
    "/ventas",
    "/ventas/nueva",
  ]);
  const destinosPrincipales = nav.lateral.filter((destino) =>
    rutasOperacion.has(destino.href),
  );
  const destinosGestion = nav.lateral.filter(
    (destino) => !rutasOperacion.has(destino.href),
  );
  const destinosMas = nav.mas.filter(
    (destino) =>
      destino.href !== "/perfil" &&
      !nav.lateral.some(
        (destinoLateral) => destinoLateral.href === destino.href,
      ),
  );
  const destinosSecundarios = [...destinosGestion, ...destinosMas];

  return (
    <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-dvh w-[276px] shrink-0 flex-col overflow-hidden lg:flex">
      <div className="pointer-events-none absolute -top-24 -left-20 size-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex min-h-[88px] items-center px-6">
        <Marca sobreOscuro />
      </div>

      {perfil.empresaNombre ? (
        <div className="relative mx-4 mb-4 rounded-xl border border-white/8 bg-white/5 px-3.5 py-3">
          <p className="text-[10px] font-bold tracking-[0.13em] text-slate-500 uppercase">
            Espacio de trabajo
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-200">
            {perfil.empresaNombre}
          </p>
        </div>
      ) : (
        <div className="relative mx-4 mb-4 rounded-xl border border-cyan-300/10 bg-cyan-300/5 px-3.5 py-3">
          <p className="text-[10px] font-bold tracking-[0.13em] text-cyan-200/60 uppercase">
            Control global
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-200">
            Todas las empresas
          </p>
        </div>
      )}

      <nav className="relative flex-1 space-y-1 overflow-y-auto px-4 py-2">
        <div className="px-3 pb-2 text-[10px] font-bold tracking-[0.16em] text-slate-600 uppercase">
          Principal
        </div>
        {destinosPrincipales.map((destino) => (
          <EnlaceNav key={destino.href} destino={destino}>
            <IconoDestino destino={destino} className="size-[19px]" />
            <span className="truncate">{destino.etiqueta}</span>
          </EnlaceNav>
        ))}

        {destinosSecundarios.length > 0 ? (
          <>
            <div className="pt-6 pb-2 pl-3 text-[10px] font-bold tracking-[0.16em] text-slate-600 uppercase">
              Gestión
            </div>
            {destinosSecundarios.map((destino) => (
              <EnlaceNav
                key={destino.href}
                destino={destino}
                className="min-h-11"
              >
                <IconoDestino destino={destino} className="size-[18px]" />
                <span className="truncate">{destino.etiqueta}</span>
                {destino.href === "/empleados" ? pendientesEmpleados : null}
              </EnlaceNav>
            ))}
          </>
        ) : null}
      </nav>

      <div className="relative m-4 mt-2 rounded-2xl border border-white/8 bg-white/5 p-3">
        <Link
          href="/perfil/password"
          className="group flex items-center gap-3 rounded-xl px-1 py-1"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-slate-600 to-slate-800 text-xs font-extrabold text-white ring-1 ring-white/10">
            {`${perfil.nombres[0] ?? ""}${perfil.apellidos[0] ?? ""}`.toUpperCase() ||
              "U"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-100">
              {perfil.nombres} {perfil.apellidos}
            </p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500 group-hover:text-slate-300">
              <Settings2 className="size-3" /> Configurar cuenta
            </p>
          </div>
        </Link>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="mt-2 flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-slate-500 transition-colors hover:bg-red-400/10 hover:text-red-300"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
