import { redirect } from "next/navigation";

import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { parsearSoles } from "@/lib/dinero";
import {
  listarContrapartesVentas,
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

  // Vendedor y sede propios (04/issue #28) solo tienen sentido en "vendidas":
  // en "compradas" ambas columnas describen a la empresa contraparte, no a la
  // mía, así que ni se muestran ni se dejan aplicar como filtro server-side.
  const soportaVendedorSede = esAdmin && direccion === "vendidas";

  // Catálogos primero: se usan tanto para pintar los selects como para
  // validar en servidor que el id recibido en la URL pertenece al universo
  // autorizado antes de armar los filtros de `listarVentas` (issue #28:
  // manipular IDs no debe filtrar fuera del alcance permitido).
  const [empresas, vendedores, sedes] = await medirServidor(
    "ventas.catalogos",
    () =>
      Promise.all([
        medirServidor("ventas.catalogo-empresas", () =>
          listarContrapartesVentas(sesion, direccion),
        ),
        soportaVendedorSede
          ? medirServidor("ventas.catalogo-vendedores", () =>
              listarVendedoresPropios(sesion),
            )
          : Promise.resolve([]),
        soportaVendedorSede
          ? medirServidor("ventas.catalogo-sedes", () => sedesParaVenta(sesion))
          : Promise.resolve([]),
      ]),
  );

  const empresaId =
    sp.empresa && empresas.some((e) => e.id === sp.empresa)
      ? sp.empresa
      : undefined;
  const vendedorId =
    soportaVendedorSede &&
    sp.vendedor &&
    vendedores.some((v) => v.id === sp.vendedor)
      ? sp.vendedor
      : undefined;
  const sedeId =
    soportaVendedorSede && sp.sede && sedes.some((s) => s.id === sp.sede)
      ? sp.sede
      : undefined;

  const filtros: FiltrosVentas = {
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
    empresaId,
    estado,
    q: sp.q || undefined,
    vendedorId,
    sedeId,
    montoMinCentimos: centimosDe(sp.montoMin),
    montoMaxCentimos: centimosDe(sp.montoMax),
    soloRevision: esAdmin ? sp.revision === "1" : undefined,
    direccion,
    orden,
    cursor: sp.cursor || undefined,
  };

  const pagina = await medirServidor("ventas.pagina", () =>
    listarVentas(sesion, filtros),
  );

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
