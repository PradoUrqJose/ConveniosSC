import { redirect } from "next/navigation";

import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { parsearSoles } from "@/lib/dinero";
import { listarEmpresasParaEmpleado } from "@/modules/empleados/query";
import {
  listarVendedoresPropios,
  listarVentas,
  POR_PAGINA_VENTAS,
  sedesParaVenta,
  type DireccionVentas,
  type EstadoVenta,
  type FiltrosVentas,
  type OrdenVentas,
} from "@/modules/ventas/query";
import { VentasClient } from "./ventas-client";
import { medirServidor } from "@/lib/observabilidad";

export type SearchParamsVentas = {
  q?: string;
  desde?: string;
  hasta?: string;
  empresa?: string;
  estado?: string;
  vendedor?: string;
  sede?: string;
  montoMin?: string;
  montoMax?: string;
  revision?: string;
  dir?: string;
  orden?: string;
  cursor?: string;
  // Pila de cursores de las páginas ya visitadas (separados por coma; la
  // primera página se representa con un elemento vacío). Permite volver
  // atrás en una paginación por cursor, que por diseño solo avanza.
  antes?: string;
};

const ORDENES: OrdenVentas[] = [
  "fecha_desc",
  "fecha_asc",
  "monto_desc",
  "monto_asc",
];

function centimosDe(texto: string | undefined): number | undefined {
  if (!texto) return undefined;
  try {
    return parsearSoles(texto);
  } catch {
    return undefined;
  }
}

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

  const sp = await searchParams;
  const esAdmin = sesion.rol === "ADMIN_EMPRESA";

  // Semántica del issue #25: el listado inicia en REGISTRADA (no "todas") para
  // que el resumen ("Operaciones", "Monto bruto", "Descuentos") no mezcle
  // anuladas por defecto. "Todas" y "Anuladas" siguen disponibles como
  // elección explícita del filtro Estado.
  const estado: EstadoVenta | "TODAS" =
    sp.estado === "ANULADA" || sp.estado === "TODAS" ? sp.estado : "REGISTRADA";
  const direccion: DireccionVentas =
    sp.dir === "compradas" ? "compradas" : "vendidas";
  const orden: OrdenVentas = ORDENES.includes(sp.orden as OrdenVentas)
    ? (sp.orden as OrdenVentas)
    : "fecha_desc";

  const filtros: FiltrosVentas = {
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
    empresaId: sp.empresa || undefined,
    estado,
    q: sp.q || undefined,
    vendedorId: esAdmin ? sp.vendedor || undefined : undefined,
    sedeId: esAdmin ? sp.sede || undefined : undefined,
    montoMinCentimos: centimosDe(sp.montoMin),
    montoMaxCentimos: centimosDe(sp.montoMax),
    soloRevision: esAdmin ? sp.revision === "1" : undefined,
    direccion,
    orden,
    cursor: sp.cursor || undefined,
  };

  const [pagina, empresasTodas, vendedores, sedes] = await medirServidor(
    "ventas.pagina",
    () =>
      Promise.all([
        listarVentas(sesion, filtros),
        medirServidor("ventas.catalogo-empresas", () =>
          listarEmpresasParaEmpleado(sesion),
        ),
        esAdmin
          ? medirServidor("ventas.catalogo-vendedores", () =>
              listarVendedoresPropios(sesion),
            )
          : Promise.resolve([]),
        esAdmin
          ? medirServidor("ventas.catalogo-sedes", () => sedesParaVenta(sesion))
          : Promise.resolve([]),
      ]),
  );

  const empresas = empresasTodas.filter((e) => e.id !== sesion.empresaId);

  return (
    <VentasClient
      pagina={pagina}
      sp={sp}
      esAdmin={esAdmin}
      empresas={empresas}
      vendedores={vendedores}
      sedes={sedes}
      puedeCrear={sesion.rol !== "SUPERADMIN"}
      porPagina={POR_PAGINA_VENTAS}
    />
  );
}
