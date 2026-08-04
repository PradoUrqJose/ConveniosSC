import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { listarSedes } from "@/modules/sedes/query";
import { SedesClient } from "./sedes-client";

export default async function SedesPage() {
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
    requireRol(sesion, ["ADMIN_EMPRESA"]);
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

  const sedes = await listarSedes(sesion, {});
  const empresaId = sesion.empresaId ?? "";

  return <SedesClient sedes={sedes} empresaId={empresaId} />;
}
