import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { listarEmpresas } from "@/modules/empresas/query";
import { EmpresasClient } from "./empresas-client";

export default async function AdminEmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; activo?: string; cursor?: string }>;
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
    requireRol(sesion, ["SUPERADMIN"]);
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

  const { q, activo, cursor } = await searchParams;
  const activoFiltro =
    activo === "true" ? true : activo === "false" ? false : undefined;
  const pagina = await listarEmpresas(sesion, {
    q,
    activo: activoFiltro,
    cursor,
  });

  return <EmpresasClient pagina={pagina} q={q} activo={activoFiltro} />;
}
