import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import {
  listarConvenios,
  listarEmpresasParaConvenio,
  listarEmpresasParaFiltroConvenios,
  type FiltroVigenciaConvenio,
} from "@/modules/convenios/query";
import type { EstadoConvenio } from "@/modules/convenios/acciones";
import { ConveniosClient } from "./convenios-client";

export default async function AdminConveniosPage({
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

  const parametros = await searchParams;
  const valor = (nombre: string) =>
    typeof parametros[nombre] === "string" ? parametros[nombre] : undefined;
  const estadoValor = valor("estado");
  const estado = ["BORRADOR", "VIGENTE", "SUSPENDIDO", "TERMINADO"].includes(
    estadoValor ?? "",
  )
    ? (estadoValor as EstadoConvenio)
    : undefined;
  const vigenciaValor = valor("vigencia");
  const vigencia = ["vigente", "vencido", "sin_vencimiento"].includes(
    vigenciaValor ?? "",
  )
    ? (vigenciaValor as FiltroVigenciaConvenio)
    : undefined;
  const empresaId = valor("empresa");
  const cursor = valor("cursor");
  const [pagina, empresas, empresasParaCrear] = await Promise.all([
    listarConvenios(sesion, { empresaId, estado, vigencia, cursor }),
    listarEmpresasParaFiltroConvenios(sesion),
    listarEmpresasParaConvenio(sesion),
  ]);

  return (
    <ConveniosClient
      pagina={pagina}
      empresas={empresas}
      empresaId={empresaId}
      estado={estado}
      vigencia={vigencia}
      empresasParaCrear={empresasParaCrear}
    />
  );
}
