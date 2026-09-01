import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import {
  listarUsuarios,
  listarEmpresasOpciones,
  obtenerEmpresaUsuario,
  POR_PAGINA_USUARIOS,
} from "@/modules/usuarios/query";
import {
  normalizarParametrosUsuarios,
  serializarParametrosUsuarios,
  urlUsuariosCanonica,
} from "@/modules/usuarios/filtros";
import { UsuariosClient } from "./usuarios-client";

export default async function UsuariosPage({
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
  if (!urlUsuariosCanonica(parametros)) {
    const query = serializarParametrosUsuarios(parametros);
    redirect(query.size ? `/usuarios?${query}` : "/usuarios");
  }
  const filtros = normalizarParametrosUsuarios(parametros);
  const [pagina, empresaFiltro, empresas] = await Promise.all([
    listarUsuarios(sesion, filtros),
    obtenerEmpresaUsuario(sesion, filtros.empresaId),
    listarEmpresasOpciones(sesion),
  ]);

  return (
    <UsuariosClient
      pagina={pagina}
      q={filtros.q}
      rol={filtros.rol}
      activo={filtros.activo}
      empresaFiltro={empresaFiltro}
      porPagina={POR_PAGINA_USUARIOS}
      esSuperadmin={true}
      yoUsuarioId={sesion.usuarioId}
      empresasParaCrear={empresas}
    />
  );
}
