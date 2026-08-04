import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { db } from "@/db";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import {
  cargarPerfilNav,
  contarPendientesVerificacion,
} from "@/lib/auth/perfil";
import { navegacionPorRol } from "@/lib/navegacion";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { TabBarMovil } from "@/components/shell/tab-bar-movil";
import { BannerOffline } from "@/components/shell/banner-offline";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
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

  const pathname = (await headers()).get("x-convenios-pathname");

  if (sesion.debeCambiarPassword && pathname !== "/perfil/password") {
    redirect("/perfil/password");
  }

  if (sesion.debeCambiarPassword) {
    return (
      <div className="flex min-h-dvh flex-col">
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    );
  }

  const [perfil, pendientesEmpleados] = await Promise.all([
    cargarPerfilNav(db, sesion.usuarioId),
    sesion.rol === "ADMIN_EMPRESA" && sesion.empresaId
      ? contarPendientesVerificacion(db, sesion.empresaId)
      : Promise.resolve(0),
  ]);
  const nav = navegacionPorRol(sesion.rol);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        nav={nav}
        perfil={perfil}
        pendientesEmpleados={pendientesEmpleados}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header perfil={perfil} rol={sesion.rol} />
        <BannerOffline />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 lg:pb-8">
          {children}
        </main>
      </div>
      <TabBarMovil rol={sesion.rol} pendientesEmpleados={pendientesEmpleados} />
    </div>
  );
}
