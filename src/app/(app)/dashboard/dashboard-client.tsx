"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";

import { SalesDirectionTabs } from "@/components/shell/sales-direction-tabs";

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const url = (dir: "vendidas" | "compradas") =>
    `/dashboard?${new URLSearchParams({ desde, hasta, dir })}`;

  return (
    <>
      <form className="control-bar grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:gap-3 md:w-fit md:shrink-0 md:grid-cols-[minmax(0,10rem)_minmax(0,10rem)_auto]">
        <input type="hidden" name="dir" value={direccion} />
        <label className="flex min-w-0 flex-col">
          <span className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase sm:mb-1.5 sm:text-[11px]">
            <CalendarRange className="size-3.5 shrink-0" /> Desde
          </span>
          <input
            name="desde"
            type="date"
            defaultValue={desde}
            className="border-input bg-background focus:ring-ring/30 h-10 w-full min-w-0 appearance-none rounded-xl border px-2.5 text-sm outline-none focus:ring-3 sm:px-3"
          />
        </label>
        <label className="flex min-w-0 flex-col">
          <span className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase sm:mb-1.5 sm:text-[11px]">
            <CalendarRange className="size-3.5 shrink-0" /> Hasta
          </span>
          <input
            name="hasta"
            type="date"
            defaultValue={hasta}
            className="border-input bg-background focus:ring-ring/30 h-10 w-full min-w-0 appearance-none rounded-xl border px-2.5 text-sm outline-none focus:ring-3 sm:px-3"
          />
        </label>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 col-span-2 mt-auto h-10 rounded-xl px-5 text-sm font-bold shadow-sm transition md:col-span-1">
          Actualizar
        </button>
      </form>
      {esAdmin ? (
        <SalesDirectionTabs
          ariaLabel="Dirección de ventas del dashboard"
          direccion={direccion}
          opciones={[
            { id: "vendidas", label: "Vendí", href: url("vendidas") },
            {
              id: "compradas",
              label: "Compraron mis empleados",
              href: url("compradas"),
            },
          ]}
          onNavegar={(href) => startTransition(() => router.push(href))}
        />
      ) : null}
    </>
  );
}
