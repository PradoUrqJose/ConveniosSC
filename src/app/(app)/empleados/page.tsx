import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import {
  listarEmpresasParaEmpleado,
  listarEmpleados,
  resumirEmpleados,
} from "@/modules/empleados/query";
import { EmpleadosClient } from "./empleados-client";
import {
  normalizarParametrosEmpleados,
  serializarParametrosEmpleados,
  urlEmpleadosCanonica,
} from "@/modules/empleados/filtros";

export default async function EmpleadosPage({
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

  const sp = await searchParams;
  if (!urlEmpleadosCanonica(sp)) {
    const query = serializarParametrosEmpleados(sp);
    redirect(query.size ? `/empleados?${query}` : "/empleados");
  }
  const { tab, estado, q, cursor } = normalizarParametrosEmpleados(sp);

  const [pagina, empresas, resumen] = await Promise.all([
    listarEmpleados(sesion, { estado, q, cursor }),
    listarEmpresasParaEmpleado(sesion),
    resumirEmpleados(sesion),
  ]);

  return (
    <EmpleadosClient
      pagina={pagina}
      tab={tab}
      q={q}
      empresas={empresas}
      resumen={resumen}
      esSuperadmin={sesion.rol === "SUPERADMIN"}
      miEmpresaId={sesion.empresaId ?? null}
    />
  );
}
