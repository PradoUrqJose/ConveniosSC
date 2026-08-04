import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import {
  listarEmpleadosOpciones,
  listarEmpresasOpciones,
  listarSedesOpciones,
  listarUsuarios,
} from "@/modules/usuarios/query";
import { UsuariosClient } from "./usuarios-client";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
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

  const { q, cursor } = await searchParams;
  const esSuperadmin = sesion.rol === "SUPERADMIN";

  const [pagina, empresas, empleados, sedes] = await Promise.all([
    listarUsuarios(sesion, { q, cursor }),
    esSuperadmin ? listarEmpresasOpciones(sesion) : Promise.resolve([]),
    listarEmpleadosOpciones(sesion),
    listarSedesOpciones(sesion),
  ]);

  return (
    <UsuariosClient
      pagina={pagina}
      q={q}
      empresas={empresas}
      empleados={empleados}
      sedes={sedes}
      esSuperadmin={esSuperadmin}
      yoUsuarioId={sesion.usuarioId}
    />
  );
}
