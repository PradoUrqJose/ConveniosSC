import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgePercent,
  CalendarDays,
  Plus,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { formatearSoles } from "@/lib/dinero";
import { formatearFechaUI, hoyLima } from "@/lib/fechas";
import { resumirVentas, ultimasVentas } from "@/modules/ventas/query";
import { HeroPagina, Metrica } from "@/components/shell/pagina-ui";
import {
  AccionCuentaMovil,
  CabeceraMovil,
  ContextoMovil,
} from "@/components/shell/cabecera-movil";
import { medirServidor } from "@/lib/observabilidad";

export default async function InicioPage() {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (error) {
    if (error instanceof ErrorAuth) {
      redirect("/login");
    }
    throw error;
  }

  if (sesion.rol !== "VENDEDOR") {
    redirect("/dashboard");
  }

  const hoy = hoyLima();
  const filtrosMes = {
    desde: `${hoy.slice(0, 7)}-01`,
    hasta: hoy,
    estado: "REGISTRADA",
    orden: "fecha_desc",
  } as const;
  const [resumenMes, recientes] = await medirServidor("inicio.pagina", () =>
    Promise.all([
      medirServidor("inicio.resumen", () => resumirVentas(sesion, filtrosMes)),
      medirServidor("inicio.recientes", () =>
        ultimasVentas(sesion, filtrosMes, 5),
      ),
    ]),
  );
  const nombre = sesion.nombres;

  return (
    <section className="page-shell">
      {/* Cabecera raíz móvil (issue #52): el h1 de la pantalla es el saludo
          del hero, así que acá solo van contexto y cuenta — el acceso a
          tema, contraseña, instalación y cierre de sesión que antes vivía
          en el header global. */}
      <CabeceraMovil
        className="lg:hidden"
        contexto={<ContextoMovil />}
        acciones={<AccionCuentaMovil />}
      />
      <HeroPagina
        kicker={
          <>
            <Sparkles className="size-4" /> Tu espacio de ventas
          </>
        }
        titulo={`Hola, ${nombre}`}
        descripcion="Todo listo para registrar la siguiente venta."
        accion={
          <>
            {/* En móvil se hace visible dentro del primer viewport; la barra
                inferior sigue siendo un segundo acceso, no el único CTA. */}
            <Link
              href="/ventas/nueva"
              className="group flex min-h-12 items-center justify-between gap-4 rounded-xl bg-white px-4 text-sm font-bold text-blue-950 shadow-lg shadow-blue-950/20 transition active:translate-y-px lg:hidden"
            >
              <span className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-cyan-100 text-blue-800">
                  <Plus className="size-4" />
                </span>
                Nueva venta
              </span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ventas/nueva"
              className="group hidden min-h-16 items-center justify-between gap-5 rounded-2xl bg-white px-5 font-bold text-blue-950 shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0 md:min-w-60 lg:flex"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-cyan-100 text-blue-800">
                  <Plus className="size-5" />
                </span>
                Nueva venta
              </span>
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </>
        }
      />

      <div className="hidden grid-cols-2 gap-3 lg:grid lg:grid-cols-4">
        <Metrica
          etiqueta="Ventas este mes"
          valor={resumenMes.cantidad}
          detalle="Operaciones registradas"
          icono={<ReceiptText className="size-4.5" />}
        />
        <Metrica
          etiqueta="Monto vendido"
          valor={
            <span className="money">
              {formatearSoles(resumenMes.sumaBruto)}
            </span>
          }
          detalle="Monto bruto acumulado"
          icono={<WalletCards className="size-4.5" />}
          tono="success"
        />
        <Metrica
          etiqueta="Descuentos"
          valor={
            <span className="money">
              {formatearSoles(resumenMes.sumaDescuento)}
            </span>
          }
          detalle="Beneficio entregado"
          icono={<BadgePercent className="size-4.5" />}
          tono="warning"
        />
        <Metrica
          etiqueta="Monto final"
          valor={
            <span className="money">
              {formatearSoles(resumenMes.sumaFinal)}
            </span>
          }
          detalle="Total después de descuentos"
          icono={<ShoppingBag className="size-4.5" />}
          tono="neutral"
        />
      </div>

      <section
        className="space-y-3 lg:hidden"
        aria-label="Resumen de ventas del mes"
      >
        <article className="bg-primary text-primary-foreground shadow-primary/20 relative overflow-hidden rounded-[1.25rem] p-4 shadow-lg">
          <ReceiptText
            className="absolute -right-2 -bottom-3 size-24 opacity-15"
            aria-hidden="true"
          />
          <p className="text-primary-foreground/70 text-xs font-bold tracking-[0.08em] uppercase">
            Ventas este mes
          </p>
          <p className="mt-1 text-4xl leading-none font-bold tracking-tight tabular-nums">
            {resumenMes.cantidad}
          </p>
          <p className="text-primary-foreground/80 mt-2 text-sm">
            Operaciones registradas
          </p>
        </article>
        <div className="grid grid-cols-2 gap-2.5">
          <article className="bg-card ring-foreground/7 rounded-xl p-3 ring-1">
            <p className="text-muted-foreground text-xs font-semibold">
              Monto vendido
            </p>
            <p className="money mt-1 truncate text-base font-bold">
              {formatearSoles(resumenMes.sumaBruto)}
            </p>
          </article>
          <article className="bg-card ring-foreground/7 rounded-xl p-3 ring-1">
            <p className="text-muted-foreground text-xs font-semibold">
              Descuentos
            </p>
            <p className="money mt-1 truncate text-base font-bold">
              {formatearSoles(resumenMes.sumaDescuento)}
            </p>
          </article>
        </div>
      </section>

      <section className="surface-panel">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 className="text-[0.9rem] font-bold tracking-tight sm:text-base">
              Ventas recientes
            </h2>
            <p className="text-muted-foreground mt-0.5 hidden text-xs sm:block">
              Tus últimos movimientos del mes
            </p>
          </div>
          <Link
            href="/ventas"
            className="text-primary flex items-center gap-1 text-sm font-bold"
          >
            Ver todas <ArrowRight className="size-4" />
          </Link>
        </header>

        {recientes.length ? (
          <div className="divide-y">
            {recientes.map((venta) => (
              <Link
                key={venta.id}
                href={`/ventas/${venta.id}`}
                className="hover:bg-accent/45 group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 transition-colors sm:px-6 sm:py-4"
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
                  <ArrowRight className="text-muted-foreground mt-1 ml-auto size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <span className="bg-muted text-muted-foreground mx-auto grid size-12 place-items-center rounded-2xl">
              <ReceiptText className="size-5" />
            </span>
            <p className="mt-3 text-sm font-bold">
              Aún no tienes ventas este mes
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Tu primera operación aparecerá aquí.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
