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
import { formatearSoles } from "@/lib/dinero";
import type { Dashboard } from "@/modules/metricas/query";

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
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {desde} — {hasta}
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="desde"
            type="date"
            defaultValue={desde}
            className="border-input bg-background rounded-md border px-2 text-sm"
          />
          <input
            name="hasta"
            type="date"
            defaultValue={hasta}
            className="border-input bg-background rounded-md border px-2 text-sm"
          />
          <button className="border-input rounded-md border px-3 text-sm">
            Aplicar
          </button>
        </form>
      </div>
      {esAdmin && (
        <div className="flex gap-2">
          <Link
            href={url({ dir: "vendidas" })}
            className={`rounded-full px-3 py-1.5 text-sm ${direccion === "vendidas" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Vendí
          </Link>
          <Link
            href={url({ dir: "compradas" })}
            className={`rounded-full px-3 py-1.5 text-sm ${direccion === "compradas" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
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
            <Stat etiqueta="Ventas" valor={String(datos.totales.cantidad)} />
            <Stat
              etiqueta="Bruto"
              valor={formatearSoles(datos.totales.sumaBrutoCentimos)}
            />
            <Stat
              etiqueta="Descuento"
              valor={formatearSoles(datos.totales.sumaDescuentoCentimos)}
            />
            <Stat
              etiqueta="Ticket promedio"
              valor={formatearSoles(datos.totales.ticketPromedioCentimos)}
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
              <div className="h-64" aria-label="Gráfico de ventas por periodo">
                <ResponsiveContainer width="100%" height="100%">
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
          <div className="grid gap-4 lg:grid-cols-2">
            <Lista
              titulo="Por convenio"
              filas={datos.porConvenio.map((x) => [
                x.empresaNombre,
                formatearSoles(x.brutoCentimos),
              ])}
            />
            <Lista
              titulo="Por sede"
              filas={datos.porSede.map((x) => [x.nombre, String(x.cantidad)])}
            />
            <Lista
              titulo="Top vendedores"
              filas={datos.topVendedores.map((x) => [
                x.nombre,
                `${x.cantidad} · ${formatearSoles(x.brutoCentimos)}`,
              ])}
            />
            <Lista
              titulo="Top empleados beneficiarios"
              filas={datos.topEmpleados.map((x) => [
                `${x.nombre} · ${x.dni}`,
                `${x.cantidad} · ${formatearSoles(x.brutoCentimos)}`,
              ])}
            />
          </div>
          <Bloque titulo="Adopción">
            <p className="text-3xl font-semibold">{datos.adopcion.tasa}%</p>
            <p className="text-muted-foreground text-sm">
              {datos.adopcion.empleadosQueCompraron} de{" "}
              {datos.adopcion.empleadosActivos} empleados activos usaron el
              beneficio.
            </p>
          </Bloque>
        </>
      )}
    </section>
  );
}
function Stat({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold">{valor}</p>
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
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 font-medium">{titulo}</h2>
      {children}
    </section>
  );
}
function EstadoVacio({ texto }: { texto: string }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
      {texto}
    </div>
  );
}
function Lista({ titulo, filas }: { titulo: string; filas: string[][] }) {
  return (
    <Bloque titulo={titulo}>
      {filas.length ? (
        <ul className="divide-y">
          {filas.map(([a, b]) => (
            <li key={a} className="flex justify-between gap-3 py-2 text-sm">
              <span>{a}</span>
              <span className="text-muted-foreground text-right">{b}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio texto="Sin datos en este periodo." />
      )}
    </Bloque>
  );
}
