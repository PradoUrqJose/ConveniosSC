"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Pencil, Plus, Search, UserCog, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatearFechaHoraLima } from "@/lib/fechas";
import type { Pagina } from "@/lib/tipos";
import type {
  EmpresaOpcion,
  EmpleadoOpcion,
  FilaUsuario,
  SedeOpcion,
} from "@/modules/usuarios/query";
import { FormUsuario } from "./form-usuario";
import { DialogoResetear } from "./dialogo-resetear";
import { DialogoDesactivar } from "./dialogo-desactivar";
import { DialogoPassword } from "./dialogo-password";
import { BotonDesbloquear } from "./boton-desbloquear";
import { CabeceraPagina, EstadoVacio } from "@/components/shell/pagina-ui";

type Dialogo =
  | { tipo: "crear" }
  | { tipo: "editar"; usuario: FilaUsuario }
  | { tipo: "reset"; usuario: FilaUsuario }
  | { tipo: "desactivar"; usuario: FilaUsuario };

const COLOR_ROL: Record<FilaUsuario["rol"], string> = {
  SUPERADMIN: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  ADMIN_EMPRESA: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  VENDEDOR: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const NOMBRE_ROL: Record<FilaUsuario["rol"], string> = {
  SUPERADMIN: "Admin. general",
  ADMIN_EMPRESA: "Administrador",
  VENDEDOR: "Vendedor",
};

function RolBadge({ rol }: { rol: FilaUsuario["rol"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ROL[rol]}`}
    >
      {NOMBRE_ROL[rol]}
    </span>
  );
}

export function UsuariosClient({
  pagina,
  q,
  empresas,
  empleados,
  sedes,
  esSuperadmin,
  yoUsuarioId,
}: {
  pagina: Pagina<FilaUsuario>;
  q?: string;
  empresas: EmpresaOpcion[];
  empleados: EmpleadoOpcion[];
  sedes: SedeOpcion[];
  esSuperadmin: boolean;
  yoUsuarioId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [passwordData, setPasswordData] = useState<{
    username: string;
    passwordTemporal: string;
  } | null>(null);

  const mostrarPassword = (username: string, passwordTemporal: string) => {
    setDialogo(null);
    setPasswordData({ username, passwordTemporal });
  };

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Accesos y permisos"
        titulo="Usuarios"
        descripcion={
          typeof pagina.total === "number" ? (
            <>
              {pagina.total} usuario{pagina.total === 1 ? "" : "s"} en total
            </>
          ) : (
            "Gestiona las cuentas y roles que pueden ingresar al sistema."
          )
        }
        icono={<UserCog className="size-5" />}
        acciones={
          <Button onClick={() => setDialogo({ tipo: "crear" })}>
            <Plus className="size-4" />
            Crear usuario
          </Button>
        }
      />

      <form
        role="search"
        action="/usuarios"
        className="control-bar flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por username o nombre"
            className="bg-muted/70 h-11 rounded-xl border-0 pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {pagina.items.length === 0 ? (
        <EstadoVacio
          icono={<Users className="size-6" />}
          titulo={q ? "No encontramos usuarios" : "Aún no hay usuarios"}
          descripcion={
            q
              ? "No encontramos usuarios que coincidan con la búsqueda."
              : "Crea una cuenta y asígnale el acceso adecuado para comenzar."
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pagina.items.map((u) => {
            const esUnoMismo = u.id === yoUsuarioId;
            return (
              <Card
                key={u.id}
                className="bg-card/90 rounded-[1.35rem] p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="from-primary/15 text-primary grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br to-cyan-400/15 text-xs font-extrabold">
                      {`${u.nombres[0] ?? ""}${u.apellidos[0] ?? ""}`.toUpperCase()}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold">
                          {u.nombres} {u.apellidos}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          @{u.username}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <RolBadge rol={u.rol} />
                        {u.empresaNombre ? (
                          <span className="text-muted-foreground">
                            {u.empresaNombre}
                          </span>
                        ) : null}
                        {u.debeCambiarPassword ? (
                          <Badge variant="secondary">cambiar password</Badge>
                        ) : null}
                        {u.bloqueado ? (
                          <Badge variant="destructive">Bloqueado</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                    {u.activo ? (
                      <Badge>Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </div>
                </div>

                <div className="text-muted-foreground mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/60 rounded-xl px-3 py-2.5">
                    <span className="block">Último acceso</span>
                    <strong className="text-foreground mt-0.5 block truncate font-semibold">
                      {u.ultimoAccesoAt
                        ? formatearFechaHoraLima(u.ultimoAccesoAt)
                        : "Nunca ingresó"}
                    </strong>
                  </div>
                  <div className="bg-muted/60 rounded-xl px-3 py-2.5">
                    <span className="block">Actividad</span>
                    <strong className="text-foreground mt-0.5 block font-semibold">
                      {u.ventas30d} ventas · 30 días
                    </strong>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogo({ tipo: "editar", usuario: u })}
                  >
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogo({ tipo: "reset", usuario: u })}
                  >
                    <KeyRound className="size-3.5" /> Restablecer
                  </Button>
                  {u.bloqueado ? <BotonDesbloquear usuario={u} /> : null}
                  {!esUnoMismo ? (
                    <Button
                      variant={u.activo ? "ghost" : "secondary"}
                      size="sm"
                      onClick={() =>
                        setDialogo({ tipo: "desactivar", usuario: u })
                      }
                    >
                      {u.activo ? "Desactivar" : "Reactivar"}
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {pagina.cursor ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("cursor", pagina.cursor!);
              router.push(`/usuarios?${params.toString()}`);
            }}
          >
            Cargar más
          </Button>
        </div>
      ) : null}

      {dialogo ? (
        <Dialog open onOpenChange={(abierto) => !abierto && setDialogo(null)}>
          {dialogo.tipo === "crear" ? (
            <FormUsuario
              empresas={empresas}
              empleados={empleados}
              sedes={sedes}
              esSuperadmin={esSuperadmin}
              esUnoMismo={false}
              onCerrar={() => setDialogo(null)}
              onCreado={(username, passwordTemporal) =>
                mostrarPassword(username, passwordTemporal)
              }
            />
          ) : dialogo.tipo === "editar" ? (
            <FormUsuario
              usuario={dialogo.usuario}
              empresas={empresas}
              empleados={empleados}
              sedes={sedes}
              esSuperadmin={esSuperadmin}
              esUnoMismo={dialogo.usuario.id === yoUsuarioId}
              onCerrar={() => setDialogo(null)}
              onCreado={() => undefined}
            />
          ) : dialogo.tipo === "reset" ? (
            <DialogoResetear
              usuario={dialogo.usuario}
              onReset={(passwordTemporal) =>
                mostrarPassword(dialogo.usuario.username, passwordTemporal)
              }
            />
          ) : (
            <DialogoDesactivar
              usuario={dialogo.usuario}
              onCerrar={() => setDialogo(null)}
            />
          )}
        </Dialog>
      ) : null}

      {passwordData ? (
        <DialogoPassword
          username={passwordData.username}
          passwordTemporal={passwordData.passwordTemporal}
          onCerrar={() => {
            setPasswordData(null);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
