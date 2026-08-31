import { redirect } from "next/navigation";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { hoyLima, sumarDias } from "@/lib/fechas";
import { obtenerDashboard } from "@/modules/metricas/query";
import { ultimasVentas } from "@/modules/ventas/query";
import { db } from "@/db";
import { medirConsultasServidor, medirServidor } from "@/lib/observabilidad";
import { Suspense } from "react";
import { DashboardControls } from "./dashboard-client";
import {
  DashboardDataRegion,
  DashboardTransition,
} from "./dashboard-transition";
import {
  DashboardBanner,
  DashboardGrafico,
  DashboardMetricas,
  DashboardRecientes,
  DashboardRankings,
  EsqueletoBloque,
  EsqueletoMetricas,
  EsqueletoRankings,
} from "./dashboard-modules";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; dir?: string }>;
}) {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (e) {
    if (e instanceof ErrorAuth) redirect("/login");
    throw e;
  }
  if (sesion.rol === "VENDEDOR") redirect("/");
  const sp = await searchParams;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta ?? "")
    ? sp.hasta!
    : hoyLima();
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(sp.desde ?? "")
    ? sp.desde!
    : sumarDias(hasta, -29);
  const direccion = sp.dir === "compradas" ? "compradas" : "vendidas";
  // Se comparte la misma promesa entre fronteras: las cinco sentencias siguen
  // ejecutándose una sola vez por navegación y PERF_BASELINE informa su total.
  const datos = medirServidor("dashboard.pagina", () =>
    medirConsultasServidor("dashboard.consultas", db, (ejecutor) =>
      obtenerDashboard(sesion, { desde, hasta, direccion }, ejecutor),
    ),
  );
  return (
    <section className="page-shell animate-in fade-in-0 duration-500 motion-reduce:animate-none">
      <DashboardTransition>
        <DashboardBanner
          nombre={sesion.nombres}
          empresa={sesion.empresaNombre ?? "Todas las empresas"}
          direccion={direccion}
          controles={
            <DashboardControls
              desde={desde}
              hasta={hasta}
              direccion={direccion}
              esAdmin={sesion.rol === "ADMIN_EMPRESA"}
            />
          }
        />
        <DashboardDataRegion>
          <div className="flex flex-col gap-3.5 sm:gap-5">
            <Suspense fallback={<EsqueletoMetricas />}>
              <DashboardMetricas datos={datos} />
            </Suspense>
            <Suspense fallback={<EsqueletoBloque />}>
              <DashboardGrafico datos={datos} />
            </Suspense>
            <Suspense fallback={<EsqueletoRankings />}>
              <DashboardRankings datos={datos} />
            </Suspense>
            <Suspense fallback={<EsqueletoBloque filas={5} />}>
              <DashboardRecientes
                ventas={ultimasVentas(
                  sesion,
                  {
                    desde,
                    hasta,
                    direccion,
                    estado: "REGISTRADA",
                    orden: "fecha_desc",
                  },
                  5,
                )}
              />
            </Suspense>
          </div>
        </DashboardDataRegion>
      </DashboardTransition>
    </section>
  );
}
