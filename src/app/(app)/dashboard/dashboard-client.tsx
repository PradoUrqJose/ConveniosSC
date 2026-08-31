"use client";

import { CalendarRange } from "lucide-react";

import { SalesDirectionTabs } from "@/components/shell/sales-direction-tabs";
import { useNavegacionDashboard } from "./dashboard-transition";

/** La única parte interactiva del encabezado; los módulos de datos son RSC. */
export function DashboardControls({
  desde,
  hasta,
  direccion,
  esAdmin,
}: {
  desde: string;
  hasta: string;
  direccion: "vendidas" | "compradas";
  esAdmin: boolean;
}) {
  const { navegar } = useNavegacionDashboard();
  const url = (dir: "vendidas" | "compradas") =>
    `/dashboard?${new URLSearchParams({ desde, hasta, dir })}`;
  return (
    <div className="w-full space-y-3 lg:justify-self-end">
      {esAdmin ? (
        <SalesDirectionTabs
          ariaLabel="Dirección de ventas del dashboard"
          direccion={direccion}
          sobreHero
          className="w-full rounded-2xl p-1.5 backdrop-blur-sm [&>button]:flex-1 [&>button]:py-2.5"
          opciones={[
            { id: "vendidas", label: "Vendí", href: url("vendidas") },
            {
              id: "compradas",
              label: "Compraron mis empleados",
              href: url("compradas"),
            },
          ]}
          onNavegar={navegar}
        />
      ) : null}
      <form className="flex items-stretch gap-1.5 rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur-sm ring-inset">
        <input type="hidden" name="dir" value={direccion} />
        <label className="flex min-w-0 flex-1 cursor-pointer flex-col rounded-xl px-3 py-1.5 transition focus-within:bg-white/10 hover:bg-white/10">
          <span className="flex items-center gap-1.5 text-xs font-medium text-white/60">
            <CalendarRange className="size-3.5 shrink-0" /> Desde
          </span>
          <input
            name="desde"
            type="date"
            defaultValue={desde}
            max={hasta}
            style={{ colorScheme: "dark" }}
            className="w-full min-w-0 cursor-pointer bg-transparent text-sm font-semibold text-white outline-none"
          />
        </label>
        <span aria-hidden="true" className="my-2 w-px shrink-0 bg-white/20" />
        <label className="flex min-w-0 flex-1 cursor-pointer flex-col rounded-xl px-3 py-1.5 transition focus-within:bg-white/10 hover:bg-white/10">
          <span className="flex items-center gap-1.5 text-xs font-medium text-white/60">
            <CalendarRange className="size-3.5 shrink-0" /> Hasta
          </span>
          <input
            name="hasta"
            type="date"
            defaultValue={hasta}
            min={desde}
            style={{ colorScheme: "dark" }}
            className="w-full min-w-0 cursor-pointer bg-transparent text-sm font-semibold text-white outline-none"
          />
        </label>
        <button className="shrink-0 rounded-xl bg-white px-4 text-sm font-semibold text-blue-950 shadow-sm transition hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none motion-reduce:transition-none">
          Aplicar
        </button>
      </form>
    </div>
  );
}
