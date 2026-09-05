"use client";

import { CalendarRange, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { SalesDirectionTabs } from "@/components/shell/sales-direction-tabs";
import {
  MobileSheet,
  MobileSheetAcciones,
  MobileSheetBoton,
  MobileSheetCuerpo,
  MobileSheetPagina,
} from "@/components/ui/mobile-sheet";
import { serializarParametrosDashboard } from "@/modules/metricas/filtros";
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
    `/dashboard?${serializarParametrosDashboard({ desde, hasta, dir })}`;
  return (
    <div className="hidden w-full space-y-3 lg:block lg:justify-self-end">
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

/** Filtros aislados del hero para móvil: se editan en un borrador y solo
 * navegan al confirmar, por lo que URL, atrás y adelante siguen siendo la
 * fuente de verdad. El escritorio conserva el formulario histórico arriba. */
export function DashboardFiltrosMovil({
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
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState({ desde, hasta, direccion });
  const resumen = `${desde} a ${hasta}${esAdmin ? ` · ${direccion === "vendidas" ? "Ventas realizadas" : "Compras de empleados"}` : ""}`;

  function abrir() {
    setBorrador({ desde, hasta, direccion });
    setAbierto(true);
  }

  function aplicar() {
    navegar(
      `/dashboard?${serializarParametrosDashboard({
        desde: borrador.desde,
        hasta: borrador.hasta,
        dir: borrador.direccion,
      })}`,
    );
    setAbierto(false);
  }

  return (
    <aside className="surface-panel flex items-center justify-between gap-3 px-3.5 py-3 lg:hidden">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-bold tracking-[0.08em] uppercase">
          Periodo activo
        </p>
        <p
          className="truncate text-sm font-semibold"
          aria-label={`Filtros activos: ${resumen}`}
        >
          {resumen}
        </p>
      </div>
      <button
        type="button"
        onClick={abrir}
        aria-label="Modificar filtros del dashboard"
        className="border-input hover:bg-muted grid size-11 shrink-0 place-items-center rounded-xl border transition-colors"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
      </button>
      <MobileSheet
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        altura="casi-completa"
        agarradera
      >
        <MobileSheetPagina
          id="raiz"
          titulo="Filtros del dashboard"
          descripcion="Se aplican al confirmar."
        >
          <MobileSheetCuerpo className="space-y-5">
            {esAdmin ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Dirección</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["vendidas", "Ventas realizadas"],
                      ["compradas", "Compras de empleados"],
                    ] as const
                  ).map(([valor, etiqueta]) => (
                    <label
                      key={valor}
                      className="border-input flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium"
                    >
                      <input
                        type="radio"
                        name="direccion-dashboard"
                        value={valor}
                        checked={borrador.direccion === valor}
                        onChange={() =>
                          setBorrador((actual) => ({
                            ...actual,
                            direccion: valor,
                          }))
                        }
                      />
                      {etiqueta}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <label className="block space-y-1.5 text-sm font-semibold">
              Desde
              <input
                type="date"
                value={borrador.desde}
                max={borrador.hasta}
                onChange={(event) =>
                  setBorrador((actual) => ({
                    ...actual,
                    desde: event.target.value,
                  }))
                }
                className="border-input block min-h-11 w-full rounded-xl border bg-transparent px-3 text-base font-normal"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold">
              Hasta
              <input
                type="date"
                value={borrador.hasta}
                min={borrador.desde}
                onChange={(event) =>
                  setBorrador((actual) => ({
                    ...actual,
                    hasta: event.target.value,
                  }))
                }
                className="border-input block min-h-11 w-full rounded-xl border bg-transparent px-3 text-base font-normal"
              />
            </label>
          </MobileSheetCuerpo>
          <MobileSheetAcciones>
            <MobileSheetBoton variante="primario" onClick={aplicar}>
              Aplicar filtros
            </MobileSheetBoton>
          </MobileSheetAcciones>
        </MobileSheetPagina>
      </MobileSheet>
    </aside>
  );
}
