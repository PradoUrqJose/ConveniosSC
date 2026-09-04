import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { UserCog } from "lucide-react";

import { db } from "@/db";
import { AccionCambiarPassword } from "@/components/auth/accion-cambiar-password";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CabeceraPagina } from "@/components/shell/pagina-ui";
import { AccionesCuentaMovil } from "@/components/shell/acciones-cuenta-movil";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { cargarPerfilCompleto } from "@/lib/auth/perfil";
import { formatearFechaHoraLima } from "@/lib/fechas";
import { nombreRol } from "@/lib/navegacion";

function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-muted/60 rounded-xl px-3 py-2.5">
      <span className="text-muted-foreground block text-xs">{etiqueta}</span>
      <strong className="text-foreground mt-0.5 block font-semibold break-words">
        {children}
      </strong>
    </div>
  );
}

export default async function PerfilPage() {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (error) {
    if (error instanceof ErrorAuth) {
      redirect("/login");
    }
    throw error;
  }

  const perfil = await cargarPerfilCompleto(db, sesion.usuarioId);
  if (!perfil) {
    redirect("/login");
  }

  const iniciales = `${perfil.nombres.at(0) ?? ""}${perfil.apellidos.at(0) ?? ""}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Pantalla secundaria en móvil (issue #52): se llega desde el avatar
          de las cabeceras raíz, así que lleva back. El context pill se apaga:
          la empresa ya está más abajo, como dato de la cuenta. */}
      <CabeceraPagina
        kicker="Tu cuenta"
        titulo="Perfil"
        icono={<UserCog className="size-5" />}
        descripcion="Datos de tu cuenta y acceso. Para cambiar tu nombre o tu sede, pide a un administrador que los actualice."
        atras={{ href: "/", etiqueta: "Volver" }}
        contextoMovil={false}
      />

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <span className="bg-primary/10 text-primary ring-primary/10 grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-bold uppercase ring-1">
            {iniciales || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">
              {perfil.nombres} {perfil.apellidos}
            </p>
            <p className="text-muted-foreground text-sm">@{perfil.username}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{nombreRol(sesion.rol)}</Badge>
              {perfil.debeCambiarPassword ? (
                <Badge variant="destructive">Debes cambiar tu contraseña</Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
          {perfil.empresaNombre ? (
            <Dato etiqueta="Empresa">
              {perfil.empresaNombre}
              {perfil.empresaRazonSocial &&
              perfil.empresaRazonSocial !== perfil.empresaNombre ? (
                <span className="text-muted-foreground block text-xs font-normal">
                  {perfil.empresaRazonSocial}
                </span>
              ) : null}
            </Dato>
          ) : (
            <Dato etiqueta="Alcance">Todo el sistema</Dato>
          )}
          <Dato etiqueta="Sede por defecto">
            {perfil.sedeNombre ?? "Sin sede asignada"}
          </Dato>
          <Dato etiqueta="Último acceso">
            {perfil.ultimoAccesoAt
              ? formatearFechaHoraLima(perfil.ultimoAccesoAt)
              : "Este es tu primer ingreso"}
          </Dato>
          <Dato etiqueta="Cuenta creada">
            {perfil.createdAt
              ? formatearFechaHoraLima(perfil.createdAt)
              : "No disponible"}
          </Dato>
          {perfil.email ? <Dato etiqueta="Correo">{perfil.email}</Dato> : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t pt-5 lg:flex-row lg:flex-wrap">
          <div className="flex flex-wrap gap-2">
            <AccionCambiarPassword />
          </div>
          {/* Tema, instalación y cierre de sesión vivían en el menú del
              header móvil, que ya no existe (issue #52). */}
          <AccionesCuentaMovil />
        </div>
      </Card>
    </div>
  );
}
