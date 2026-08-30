import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import {
  listarConvenios,
  listarEmpresasParaConvenio,
} from "@/modules/convenios/query";
import { ConveniosClient } from "./convenios-client";

export default async function AdminConveniosPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
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

  const { cursor } = await searchParams;
  const [pagina, empresas] = await Promise.all([
    listarConvenios(sesion, { cursor }),
    listarEmpresasParaConvenio(sesion),
  ]);

  return <ConveniosClient pagina={pagina} empresas={empresas} />;
}
