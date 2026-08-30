import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { db } from "@/db";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import {
  contarPendientesVerificacion,
  perfilNavDesdeSesion,
} from "@/lib/auth/perfil";
import { navegacionPorRol } from "@/lib/navegacion";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { CabeceraPuntoVenta } from "@/components/shell/cabecera-punto-venta";
import { TabBarMovil } from "@/components/shell/tab-bar-movil";
import { BannerOffline } from "@/components/shell/banner-offline";
import { medirServidor } from "@/lib/observabilidad";

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

  const perfil = perfilNavDesdeSesion(sesion);
  const pendientesEmpleados =
    sesion.rol === "ADMIN_EMPRESA" && sesion.empresaId
      ? await medirServidor("layout.badge-pendientes", () =>
          contarPendientesVerificacion(db, sesion.empresaId!),
        )
      : 0;
  const nav = navegacionPorRol(sesion.rol);
  const esPuntoVenta = pathname === "/ventas/nueva";

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        nav={nav}
        perfil={perfil}
        pendientesEmpleados={pendientesEmpleados}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {esPuntoVenta ? (
          <>
            <div className="lg:hidden">
              <CabeceraPuntoVenta />
            </div>
            <Header
              perfil={perfil}
              rol={sesion.rol}
              className="hidden lg:flex"
              tituloSecundario="Nueva venta"
            />
          </>
        ) : (
          <Header perfil={perfil} rol={sesion.rol} />
        )}
        <BannerOffline />
        <main
          className={
            esPuntoVenta
              ? "mx-auto w-full max-w-xl flex-1 px-4 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:max-w-[1500px] lg:px-9 lg:pt-[30px] lg:pb-[52px]"
              : "mx-auto w-full max-w-[1600px] flex-1 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-12 xl:px-10"
          }
        >
          {children}
        </main>
      </div>
      {!esPuntoVenta ? (
        <TabBarMovil
          rol={sesion.rol}
          pendientesEmpleados={pendientesEmpleados}
        />
      ) : null}
    </div>
  );
}
