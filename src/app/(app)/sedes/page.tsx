import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import {
  listarSedes,
  obtenerEmpresaSedes,
  POR_PAGINA_SEDES,
} from "@/modules/sedes/query";
import {
  normalizarParametrosSedes,
  serializarParametrosSedes,
  urlSedesCanonica,
} from "@/modules/sedes/filtros";
import { SedesClient } from "./sedes-client";

export default async function SedesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  let sinPermiso = false;
  try {
    requireRol(sesion, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  } catch (error) {
    if (error instanceof ErrorAuth) {
      sinPermiso = true;
    } else {
      throw error;
    }
  }

  if (sinPermiso) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="font-semibold">No tienes permiso para ver esta página</p>
        <Link href="/" className="text-primary text-sm">
          Ir al inicio
        </Link>
      </section>
    );
  }

  const parametros = await searchParams;
  if (!urlSedesCanonica(parametros)) {
    const query = serializarParametrosSedes(parametros);
    redirect(query.size ? `/sedes?${query}` : "/sedes");
  }
  const filtros = normalizarParametrosSedes(parametros);
  const [pagina, empresaFiltro] = await Promise.all([
    listarSedes(sesion, filtros),
    obtenerEmpresaSedes(sesion, filtros.empresaId),
  ]);
  const empresaId = sesion.empresaId ?? "";

  return (
    <SedesClient
      pagina={pagina}
      empresaId={empresaId}
      puedeGestionar={sesion.rol === "ADMIN_EMPRESA"}
      esSuperadmin={sesion.rol === "SUPERADMIN"}
      q={filtros.q}
      activo={filtros.activo}
      empresaFiltro={empresaFiltro}
      porPagina={POR_PAGINA_SEDES}
    />
  );
}
