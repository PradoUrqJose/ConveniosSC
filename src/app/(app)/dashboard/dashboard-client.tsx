"use client";
import Link from "next/link";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgePercent,
  CalendarRange,
  ChartNoAxesCombined,
  LayoutDashboard,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { formatearSoles } from "@/lib/dinero";
import type { Dashboard } from "@/modules/metricas/query";
import { CabeceraPagina, Metrica } from "@/components/shell/pagina-ui";

export function DashboardClient({
  datos,
  desde,
  hasta,
  direccion,
  esAdmin,
}: {
  datos: Dashboard;
  desde: string;
  hasta: string;
  direccion: "vendidas" | "compradas";
  esAdmin: boolean;
}) {
  const url = (c: Record<string, string>) =>
    `/dashboard?${new URLSearchParams({ desde, hasta, ...c })}`;
  const vacio = datos.totales.cantidad === 0;
  return (
    <section className="page-shell animate-in fade-in-0 duration-500">
      {/* Título y filtro de fechas comparten línea desde md. */}
      <div className="flex flex-col gap-3.5 md:flex-row md:items-end md:justify-between md:gap-6">
        <CabeceraPagina
          kicker="Visión general"
          titulo="Dashboard"
          descripcion="Sigue el rendimiento, los descuentos entregados y la adopción de los beneficios."
          icono={<LayoutDashboard className="size-5" />}
          className="hidden min-w-0 md:flex"
        />

        <form className="control-bar grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:gap-3 md:w-fit md:shrink-0 md:grid-cols-[minmax(0,10rem)_minmax(0,10rem)_auto]">
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
      </div>
      {esAdmin && (
        <div className="bg-muted/80 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl p-1.5">
          <Link
            href={url({ dir: "vendidas" })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${direccion === "vendidas" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Vendí
          </Link>
          <Link
            href={url({ dir: "compradas" })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${direccion === "compradas" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Compraron mis empleados
          </Link>
        </div>
      )}
      {vacio ? (
        <EstadoVacio texto="No hay ventas registradas en este periodo." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metrica
              etiqueta="Ventas"
              valor={String(datos.totales.cantidad)}
              detalle="Operaciones registradas"
              icono={<ReceiptText className="size-4.5" />}
            />
            <Metrica
              etiqueta="Bruto"
              valor={
                <span className="money">
                  {formatearSoles(datos.totales.sumaBrutoCentimos)}
                </span>
              }
              detalle="Monto antes del beneficio"
              icono={<WalletCards className="size-4.5" />}
              tono="success"
            />
            <Metrica
              etiqueta="Descuento"
              valor={
                <span className="money">
                  {formatearSoles(datos.totales.sumaDescuentoCentimos)}
                </span>
              }
              detalle="Beneficios entregados"
              icono={<BadgePercent className="size-4.5" />}
              tono="warning"
            />
            <Metrica
              etiqueta="Ticket promedio"
              valor={
                <span className="money">
                  {formatearSoles(datos.totales.ticketPromedioCentimos)}
                </span>
              }
              detalle="Promedio por operación"
              icono={<ChartNoAxesCombined className="size-4.5" />}
              tono="neutral"
            />
          </div>
          {datos.anuladas.cantidad > 0 && (
            <p className="text-muted-foreground text-sm">
              {datos.anuladas.cantidad} venta
              {datos.anuladas.cantidad === 1 ? "" : "s"} anulada
              {datos.anuladas.cantidad === 1 ? "" : "s"} (
              {formatearSoles(datos.anuladas.sumaBrutoCentimos)}) — excluidas de
              los totales.
            </p>
          )}
          <Bloque titulo="Ventas por periodo">
            {datos.serie.length ? (
              <div
                className="h-52 sm:h-64"
                aria-label="Gráfico de ventas por periodo"
              >
                {/*
                  En el render del servidor no hay layout que medir y
                  ResponsiveContainer avisa de un tamaño -1×-1. `initialDimension`
                  le da un tamaño de partida hasta que el cliente mide de verdad.
                */}
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  initialDimension={{ width: 600, height: 208 }}
                >
                  <BarChart data={datos.serie}>
                    <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v) => `S/${Math.round(Number(v) / 100)}`}
                    />
                    <Tooltip formatter={(v) => formatearSoles(Number(v))} />
                    <Bar
                      dataKey="brutoCentimos"
                      name="Monto bruto"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EstadoVacio texto="Sin ventas para graficar." />
            )}
          </Bloque>
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            <Lista
              titulo="Por convenio"
              filas={datos.porConvenio.map((x) => ({
                clave: x.empresaNombre,
                etiqueta: x.empresaNombre,
                valor: formatearSoles(x.brutoCentimos),
                peso: x.brutoCentimos,
              }))}
            />
            <Lista
              titulo="Por sede"
              filas={datos.porSede.map((x) => ({
                clave: x.nombre,
                etiqueta: x.nombre,
                valor: `${x.cantidad}`,
                sufijo: x.cantidad === 1 ? "venta" : "ventas",
                peso: x.cantidad,
              }))}
            />
            <Lista
              titulo="Top vendedores"
              filas={datos.topVendedores.map((x) => ({
                clave: x.nombre,
                etiqueta: x.nombre,
                detalle: `${x.cantidad} venta${x.cantidad === 1 ? "" : "s"}`,
                valor: formatearSoles(x.brutoCentimos),
                peso: x.brutoCentimos,
              }))}
            />
            <Lista
              titulo="Top empleados beneficiarios"
              filas={datos.topEmpleados.map((x) => ({
                clave: `${x.tipoDocumento}:${x.numeroDocumento}`,
                etiqueta: x.nombre,
                detalle: `${x.tipoDocumento === "DNI" ? "DNI" : "CE"} ${x.numeroDocumento} · ${x.cantidad} venta${x.cantidad === 1 ? "" : "s"}`,
                valor: formatearSoles(x.brutoCentimos),
                peso: x.brutoCentimos,
              }))}
            />
          </div>
          <Bloque titulo="Adopción">
            <div className="flex items-end gap-4">
              <p className="text-4xl leading-none font-bold tracking-tight">
                {datos.adopcion.tasa}
                <span className="text-muted-foreground text-2xl">%</span>
              </p>
              <p className="text-muted-foreground pb-0.5 text-sm leading-5">
                {datos.adopcion.empleadosQueCompraron} de{" "}
                {datos.adopcion.empleadosActivos} empleados activos usaron el
                beneficio.
              </p>
            </div>
            <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, datos.adopcion.tasa))}%`,
                }}
              />
            </div>
          </Bloque>
        </>
      )}
    </section>
  );
}
function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-panel p-4 sm:p-6">
      <h2 className="mb-3.5 text-[0.9rem] font-bold tracking-tight sm:mb-5 sm:text-base">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
function EstadoVacio({ texto }: { texto: string }) {
  return (
    <div className="text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm sm:p-8">
      {texto}
    </div>
  );
}

type FilaLista = {
  clave: string;
  etiqueta: string;
  detalle?: string;
  valor: string;
  sufijo?: string;
  peso: number;
};

/**
 * Ranking legible: posición, nombre (con detalle secundario), importe alineado
 * a la derecha y una barra de proporción respecto al primero de la lista.
 */
function Lista({ titulo, filas }: { titulo: string; filas: FilaLista[] }) {
  const maximo = filas.reduce((max, fila) => Math.max(max, fila.peso), 0);

  return (
    <Bloque titulo={titulo}>
      {filas.length ? (
        <ol className="flex flex-col gap-2.5">
          {filas.map((fila, indice) => (
            <li key={fila.clave} className="flex items-center gap-3">
              <span className="bg-muted text-muted-foreground grid size-6 shrink-0 place-items-center rounded-lg text-[0.7rem] font-bold tabular-nums">
                {indice + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">
                    {fila.etiqueta}
                  </span>
                  <span className="money shrink-0 text-sm font-semibold">
                    {fila.valor}
                    {fila.sufijo ? (
                      <span className="text-muted-foreground ml-1 font-sans text-xs font-normal">
                        {fila.sufijo}
                      </span>
                    ) : null}
                  </span>
                </div>
                {fila.detalle ? (
                  <p className="text-muted-foreground truncate text-xs">
                    {fila.detalle}
                  </p>
                ) : null}
                <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
                  <div
                    className="bg-primary/70 h-full rounded-full"
                    style={{
                      width: `${maximo > 0 ? Math.max(3, (fila.peso / maximo) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EstadoVacio texto="Sin datos en este periodo." />
      )}
    </Bloque>
  );
}
