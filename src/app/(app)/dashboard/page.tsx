import { redirect } from "next/navigation";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { hoyLima, sumarDias } from "@/lib/fechas";
import { obtenerDashboard } from "@/modules/metricas/query";
import { DashboardClient } from "./dashboard-client";

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
  const datos = await obtenerDashboard(sesion, { desde, hasta, direccion });
  return (
    <DashboardClient
      datos={datos}
      desde={desde}
      hasta={hasta}
      direccion={direccion}
      esAdmin={sesion.rol === "ADMIN_EMPRESA"}
    />
  );
}
