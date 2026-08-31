import { redirect } from "next/navigation";

import { db } from "@/db";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { listarVentas, POR_PAGINA_VENTAS } from "@/modules/ventas/query";
import { VentasClient } from "./ventas-client";
import {
  filtrosDesdeParametros,
  normalizarParametrosVentas,
  type SearchParamsVentas,
} from "@/modules/ventas/filtros";
import { medirConsultasServidor } from "@/lib/observabilidad";

export type { SearchParamsVentas } from "@/modules/ventas/filtros";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsVentas>;
}) {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (error) {
    if (error instanceof ErrorAuth) {
      redirect("/login");
    }
    throw error;
  }

  const sp = normalizarParametrosVentas(await searchParams);
  const esAdmin = sesion.rol === "ADMIN_EMPRESA";
  const filtros = filtrosDesdeParametros(sp, esAdmin);
  const pagina = await medirConsultasServidor("ventas.pagina", db, (ejecutor) =>
    listarVentas(sesion, filtros, ejecutor),
  );

  return (
    <VentasClient
      pagina={pagina}
      sp={sp}
      esAdmin={esAdmin}
      puedeCrear={sesion.rol !== "SUPERADMIN"}
      porPagina={POR_PAGINA_VENTAS}
    />
  );
}
