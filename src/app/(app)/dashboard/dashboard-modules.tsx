import {
  BadgePercent,
  ChartNoAxesCombined,
  LayoutDashboard,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import { formatearSoles } from "@/lib/dinero";
import type { Dashboard } from "@/modules/metricas/query";
import { CabeceraPagina, Metrica } from "@/components/shell/pagina-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardChartIsland } from "./dashboard-chart-island";

export function DashboardBanner() {
  return (
    <CabeceraPagina
      kicker="Visión general"
      titulo="Dashboard"
      descripcion="Sigue el rendimiento, los descuentos entregados y la adopción de los beneficios."
      icono={<LayoutDashboard className="size-5" />}
      className="hidden min-w-0 md:flex"
    />
  );
}

export async function DashboardMetricas({
  datos,
}: {
  datos: Promise<Dashboard>;
}) {
  const dashboard = await datos;
  if (dashboard.totales.cantidad === 0)
    return <EstadoVacio texto="No hay ventas registradas en este periodo." />;
  return (
    <>
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
      {dashboard.serie.length ? (
        <DashboardChartIsland serie={dashboard.serie} />
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
  if (!dashboard.totales.cantidad) return null;
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
export function EsqueletoBloque() {
  return <Skeleton className="h-52 rounded-[1.25rem] sm:h-64" />;
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
