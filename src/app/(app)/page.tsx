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
  CifraHero,
  HeroMovil,
  PildoraHero,
  TarjetaDestacadaMovil,
} from "@/components/shell/hero-movil";
import { ListaRecientesMovil } from "@/components/shell/lista-recientes-movil";
import { medirServidor } from "@/lib/observabilidad";
import { saludoPorHora } from "@/lib/saludo";

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
      {/* Hero móvil (rediseño PWA 2026-09): saludo, lo vendido en el mes y
          las dos acciones del vendedor. Reemplaza a la cabecera raíz; el
          avatar sigue siendo la entrada a la cuenta. */}
      <HeroMovil
        saludo={saludoPorHora()}
        nombre={nombre}
        resumen={
          <CifraHero
            etiqueta="Vendido este mes"
            cifra={formatearSoles(resumenMes.sumaBruto)}
            detalle={`${resumenMes.cantidad} ${resumenMes.cantidad === 1 ? "venta" : "ventas"} · ${formatearSoles(resumenMes.sumaDescuento)} en descuentos`}
          />
        }
        acciones={
          <>
            <PildoraHero
              href="/ventas/nueva"
              icono={<Plus className="size-5" aria-hidden="true" />}
            >
              Nueva venta
            </PildoraHero>
            <PildoraHero
              href="/ventas"
              icono={<ReceiptText className="size-5" aria-hidden="true" />}
            >
              Mis ventas
            </PildoraHero>
          </>
        }
      >
        <TarjetaDestacadaMovil
          icono={<Sparkles className="size-4" />}
          titulo="Tu mes en curso"
          accion={
            resumenMes.cantidad
              ? { href: "/ventas", etiqueta: "Ver mis ventas del mes" }
              : {
                  href: "/ventas/nueva",
                  etiqueta: "Registrar mi primera venta",
                }
          }
        >
          {resumenMes.cantidad ? (
            <>
              Los empleados con convenio pagaron{" "}
              <strong>{formatearSoles(resumenMes.sumaFinal)}</strong> en total,
              con <strong>{formatearSoles(resumenMes.sumaDescuento)}</strong> de
              descuento.
            </>
          ) : (
            <>
              Todavía no registras ventas este mes. Empieza identificando al
              empleado <strong>con su documento</strong>.
            </>
          )}
        </TarjetaDestacadaMovil>
      </HeroMovil>
      <HeroPagina
        className="max-lg:hidden"
        kicker={
          <>
            <Sparkles className="size-4" /> Tu espacio de ventas
          </>
        }
        titulo={`Hola, ${nombre}`}
        descripcion="Todo listo para registrar la siguiente venta."
        accion={
          <>
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

      <section className="surface-panel max-lg:hidden">
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

      <ListaRecientesMovil
        titulo="Ventas recientes"
        ventas={recientes}
        hoy={hoy}
        vacio="Aún no tienes ventas este mes. Tu primera operación aparecerá aquí."
      />
    </section>
  );
}
