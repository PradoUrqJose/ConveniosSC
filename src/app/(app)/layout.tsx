import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";

import { db } from "@/db";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import {
  contarPendientesVerificacion,
  perfilNavDesdeSesion,
} from "@/lib/auth/perfil";
import { navegacionPorRol } from "@/lib/navegacion";
import { Sidebar } from "@/components/shell/sidebar";
import { CabeceraPuntoVenta } from "@/components/shell/cabecera-punto-venta";
import { ProveedorCuentaMovil } from "@/components/shell/contexto-cuenta-movil";
import { TabBarMovil } from "@/components/shell/tab-bar-movil";
import { BannerOffline } from "@/components/shell/banner-offline";
import { BadgePendientes } from "@/components/shell/badge-pendientes";
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
        {/* Sin cabecera de ruta: es una pantalla de bloqueo. El safe area
            superior se paga acá para que el formulario no quede bajo el
            notch (issue #52). */}
        <main className="flex flex-1 flex-col pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:p-0">
          {children}
        </main>
      </div>
    );
  }

  const perfil = perfilNavDesdeSesion(sesion);
  const pendientesEmpleados =
    sesion.rol === "ADMIN_EMPRESA" && sesion.empresaId
      ? medirServidor("layout.badge-pendientes", () =>
          contarPendientesVerificacion(db, sesion.empresaId!),
        )
      : Promise.resolve(0);
  const nav = navegacionPorRol(sesion.rol);
  const esPuntoVenta = pathname === "/ventas/nueva";

  return (
    <ProveedorCuentaMovil perfil={perfil} rol={sesion.rol}>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <Sidebar
          nav={nav}
          perfil={perfil}
          pendientesEmpleados={
            <Suspense fallback={null}>
              <BadgePendientes
                pendientes={pendientesEmpleados}
                variante="sidebar"
              />
            </Suspense>
          }
        />
        {/* Sin chrome superior fijo en móvil (issue #52): el header global
          desapareció y cada ruta trae su cabecera dentro del contenido.
          El inset lateral vive acá para cubrir el landscape con notch sin
          pelearse con el padding responsive del <main>. */}
        <div className="flex min-w-0 flex-1 flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:pr-0 lg:pl-0">
          <BannerOffline />
          <main
            className={
              esPuntoVenta
                ? "mob-espacio-inferior-cta mx-auto w-full max-w-xl flex-1 px-4 lg:max-w-[1500px] lg:px-9 lg:pt-[30px] lg:pb-[52px]"
                : "mob-espacio-inferior mx-auto w-full max-w-[1600px] flex-1 px-4 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12 xl:px-10"
            }
          >
            {esPuntoVenta ? <CabeceraPuntoVenta /> : null}
            {children}
          </main>
        </div>
        {!esPuntoVenta ? (
          <TabBarMovil
            rol={sesion.rol}
            pendientesEmpleados={
              <Suspense fallback={null}>
                <BadgePendientes
                  pendientes={pendientesEmpleados}
                  variante="movil"
                />
              </Suspense>
            }
          />
        ) : null}
      </div>
    </ProveedorCuentaMovil>
  );
}
