import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { listarUsuarios } from "@/modules/usuarios/query";
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

  const { q, cursor } = await searchParams;
  const pagina = await listarUsuarios(sesion, { q, cursor });

  return (
    <UsuariosClient
      pagina={pagina}
      q={q}
      esSuperadmin={true}
      yoUsuarioId={sesion.usuarioId}
    />
  );
}
