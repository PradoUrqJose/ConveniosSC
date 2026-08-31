import {
  ArrowRight,
  BadgePercent,
  CalendarDays,
  ChartNoAxesCombined,
  LayoutDashboard,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatearSoles } from "@/lib/dinero";
import { formatearFechaUI } from "@/lib/fechas";
import type { Dashboard } from "@/modules/metricas/query";
import type { VentaReciente } from "@/modules/ventas/query";
import { Metrica } from "@/components/shell/pagina-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardChartIsland } from "./dashboard-chart-island";

export function DashboardBanner({
  nombre,
  empresa,
  direccion,
  controles,
}: {
  nombre: string;
  empresa: string;
  direccion: "vendidas" | "compradas";
  controles: ReactNode;
}) {
  return (
    <section className="from-primary via-primary elevation-floating relative isolate overflow-hidden rounded-[1.25rem] bg-linear-to-br to-blue-950 px-4 py-4 text-white sm:rounded-[1.75rem] sm:px-7 sm:py-8 lg:px-9">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px] opacity-20"
      />
      <div className="absolute -top-20 -right-16 size-64 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-8 xl:grid-cols-[minmax(0,1fr)_28.75rem] xl:gap-14">
        <div className="min-w-0">
          <div className="hidden items-center gap-2 text-cyan-100/80 sm:flex">
            <LayoutDashboard className="size-4 shrink-0" />
            <span className="truncate text-xs font-bold tracking-[0.14em] uppercase">
              Dirección · {empresa}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-[-0.045em] sm:mt-3 sm:text-4xl">
            Hola, {nombre}
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-5 text-blue-100/80 sm:mt-2 sm:text-base sm:leading-6">
            {direccion === "vendidas"
              ? "Supervisa las ventas, beneficios y participación de tu organización."
              : "Observa cómo tus empleados aprovechan los beneficios disponibles."}
          </p>
        </div>
        {controles}
      </div>
    </section>
  );
}

export async function DashboardMetricas({
  datos,
}: {
  datos: Promise<Dashboard>;
}) {
  const dashboard = await datos;
  return (
    <>
      {dashboard.totales.cantidad ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metrica
            etiqueta="Ventas"
            valor={String(dashboard.totales.cantidad)}
            detalle="Operaciones registradas"
            icono={<ReceiptText className="size-4.5" />}
          />
          <Metrica
            etiqueta="Bruto"
            valor={
              <span className="money">
                {formatearSoles(dashboard.totales.sumaBrutoCentimos)}
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
                {formatearSoles(dashboard.totales.sumaDescuentoCentimos)}
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
                {formatearSoles(dashboard.totales.ticketPromedioCentimos)}
              </span>
            }
            detalle="Promedio por operación"
            icono={<ChartNoAxesCombined className="size-4.5" />}
            tono="neutral"
          />
        </div>
      ) : (
        <EstadoVacio texto="No hay ventas registradas en este periodo." />
      )}
      {dashboard.anuladas.cantidad > 0 ? (
        <p className="text-muted-foreground text-sm">
          {dashboard.anuladas.cantidad} venta
          {dashboard.anuladas.cantidad === 1 ? "" : "s"} anulada
          {dashboard.anuladas.cantidad === 1 ? "" : "s"} (
          {formatearSoles(dashboard.anuladas.sumaBrutoCentimos)}) — excluidas de
          los totales.
        </p>
      ) : null}
    </>
  );
}

export async function DashboardGrafico({
  datos,
}: {
  datos: Promise<Dashboard>;
}) {
  const dashboard = await datos;
  return (
    <Bloque titulo="Ventas por periodo">
      {dashboard.totales.cantidad ? (
        <>
          <DashboardChartIsland
            serie={dashboard.serie}
            granularidad={dashboard.granularidad}
          />
          <p className="text-muted-foreground mt-4 text-sm">
            {dashboard.totales.cantidad} operaciones registradas; ticket
            promedio de{" "}
            {formatearSoles(dashboard.totales.ticketPromedioCentimos)}.
          </p>
        </>
      ) : (
        <EstadoVacio texto="Sin ventas para graficar." />
      )}
    </Bloque>
  );
}

export async function DashboardRankings({
  datos,
}: {
  datos: Promise<Dashboard>;
}) {
  const dashboard = await datos;
  if (!dashboard.totales.cantidad)
    return (
      <EstadoVacio texto="Los desgloses aparecerán cuando existan ventas en el periodo." />
    );
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {dashboard.direccion === "vendidas" ? (
          <>
            <Lista
              titulo="Empresas compradoras"
              filas={filasEmpresas(dashboard.empresasCompradoras)}
            />
            <Lista
              titulo="Por sede propia"
              filas={dashboard.porSede.map((x) => ({
                clave: x.sedeId,
                etiqueta: x.nombre,
                valor: `${x.cantidad}`,
                sufijo: x.cantidad === 1 ? "venta" : "ventas",
                peso: x.cantidad,
              }))}
            />
            <Lista
              titulo="Top vendedores propios"
              filas={dashboard.topVendedores.map((x) => ({
                clave: x.usuarioId,
                etiqueta: x.nombre,
                detalle: `${x.cantidad} venta${x.cantidad === 1 ? "" : "s"}`,
                valor: formatearSoles(x.brutoCentimos),
                peso: x.brutoCentimos,
              }))}
            />
            <Lista
              titulo="Beneficiarios únicos"
              filas={filasEmpleados(dashboard.beneficiarios)}
            />
          </>
        ) : (
          <>
            <Lista
              titulo="Empresas vendedoras"
              filas={filasEmpresas(dashboard.empresasVendedoras)}
            />
            <Lista
              titulo="Empleados propios beneficiados"
              filas={filasEmpleados(dashboard.topEmpleados)}
            />
          </>
        )}
      </div>
      {dashboard.direccion === "compradas" ? (
        <Adopcion datos={dashboard.adopcion} />
      ) : null}
    </>
  );
}

export function EsqueletoMetricas() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-[1.25rem] sm:h-28" />
      ))}
    </div>
  );
}
export function EsqueletoBloque({ filas }: { filas?: number }) {
  return (
    <div className="surface-panel p-4 sm:p-6">
      <Skeleton className="mb-5 h-5 w-48" />
      {filas ? (
        <div className="space-y-3">
          {Array.from({ length: filas }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Skeleton className="h-64 rounded-xl lg:h-72" />
      )}
    </div>
  );
}
export function EsqueletoRankings() {
  return (
    <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-48 rounded-[1.25rem]" />
      ))}
    </div>
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
type Fila = {
  clave: string;
  etiqueta: string;
  detalle?: string;
  valor: string;
  sufijo?: string;
  peso: number;
};
function Lista({ titulo, filas }: { titulo: string; filas: Fila[] }) {
  const maximo = filas.reduce((max, fila) => Math.max(max, fila.peso), 0);
  return (
    <Bloque titulo={titulo}>
      {filas.length ? (
        <ol className="flex flex-col gap-2.5">
          {filas.map((fila, indice) => (
            <li key={fila.clave} className="flex items-center gap-3">
              <span className="bg-muted text-muted-foreground grid size-6 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums">
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
                    className="bg-primary h-full rounded-full"
                    style={{
                      width: `${maximo ? (fila.peso / maximo) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EstadoVacio texto="Sin datos para este periodo." />
      )}
    </Bloque>
  );
}
function filasEmpresas(
  empresas: Array<{
    empresaId: string;
    empresaNombre: string;
    brutoCentimos: number;
  }>,
): Fila[] {
  return empresas.map((x) => ({
    clave: x.empresaId,
    etiqueta: x.empresaNombre,
    valor: formatearSoles(x.brutoCentimos),
    peso: x.brutoCentimos,
  }));
}
function filasEmpleados(
  empleados: Array<{
    empleadoId: string;
    nombre: string;
    tipoDocumento: string;
    numeroDocumento: string;
    cantidad: number;
    brutoCentimos: number;
  }>,
): Fila[] {
  return empleados.map((x) => ({
    clave: x.empleadoId,
    etiqueta: x.nombre,
    detalle: `${x.tipoDocumento === "DNI" ? "DNI" : "CE"} ${x.numeroDocumento} · ${x.cantidad} venta${x.cantidad === 1 ? "" : "s"}`,
    valor: formatearSoles(x.brutoCentimos),
    peso: x.brutoCentimos,
  }));
}
function Adopcion({
  datos,
}: {
  datos: {
    empleadosQueCompraron: number;
    empleadosActivos: number;
    tasa: number;
  };
}) {
  return (
    <Bloque titulo="Adopción de empleados propios">
      <div className="flex items-end gap-4">
        <p className="text-4xl leading-none font-bold tracking-tight">
          {datos.tasa}
          <span className="text-muted-foreground text-2xl">%</span>
        </p>
        <p className="text-muted-foreground pb-0.5 text-sm leading-5">
          {datos.empleadosQueCompraron} de {datos.empleadosActivos} empleados
          activos usaron el beneficio.
        </p>
      </div>
      <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, datos.tasa))}%` }}
        />
      </div>
    </Bloque>
  );
}

export async function DashboardRecientes({
  ventas,
}: {
  ventas: Promise<VentaReciente[]>;
}) {
  const recientes = await ventas;
  return (
    <Bloque titulo="Operaciones recientes">
      {recientes.length ? (
        <div className="divide-y">
          {recientes.map((venta) => (
            <Link
              key={venta.id}
              href={`/ventas/${venta.id}`}
              className="hover:bg-accent/45 group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-3 transition-colors sm:px-3"
            >
              <span className="bg-primary/8 text-primary grid size-10 place-items-center rounded-xl">
                <ReceiptText className="size-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">
                  {venta.empleado.nombres} {venta.empleado.apellidos}
                </span>
                <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate text-xs">
                  <CalendarDays className="size-3" />
                  {formatearFechaUI(venta.fechaVenta)} · {venta.sede.nombre}
                </span>
              </span>
              <span className="money text-right text-sm font-bold">
                {formatearSoles(venta.montoFinalCentimos)}
                <ArrowRight className="text-muted-foreground mt-1 ml-auto size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EstadoVacio texto="No hay operaciones recientes para este periodo." />
      )}
    </Bloque>
  );
}
