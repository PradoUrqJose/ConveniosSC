import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import {
  contarPendientesVerificacion,
  listarEmpresasParaEmpleado,
  listarEmpleados,
  type EstadoEmpleado,
} from "@/modules/empleados/query";
import { EmpleadosClient } from "./empleados-client";

const ESTADOS_POR_TAB: Record<string, EstadoEmpleado> = {
  pendientes: "PENDIENTE_VERIFICACION",
  activos: "ACTIVO",
  inactivos: "INACTIVO",
  rechazados: "RECHAZADO",
};

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; cursor?: string }>;
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

  const { tab, q, cursor } = await searchParams;
  const tabValido =
    tab === "pendientes" ||
    tab === "activos" ||
    tab === "inactivos" ||
    tab === "rechazados";
  const estado = tabValido ? ESTADOS_POR_TAB[tab!] : undefined;

  const [pagina, empresas, pendientes] = await Promise.all([
    listarEmpleados(sesion, { estado, q, cursor }),
    listarEmpresasParaEmpleado(sesion),
    contarPendientesVerificacion(sesion),
  ]);

  return (
    <EmpleadosClient
      pagina={pagina}
      tab={tabValido ? tab! : "todos"}
      q={q}
      empresas={empresas}
      pendientesTotal={pendientes.total}
      esSuperadmin={sesion.rol === "SUPERADMIN"}
      miEmpresaId={sesion.empresaId ?? null}
    />
  );
}
