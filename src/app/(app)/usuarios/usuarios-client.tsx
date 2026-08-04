"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Users } from "lucide-react";

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

type Dialogo =
  | { tipo: "crear" }
  | { tipo: "editar"; usuario: FilaUsuario }
  | { tipo: "reset"; usuario: FilaUsuario }
  | { tipo: "desactivar"; usuario: FilaUsuario };

const COLOR_ROL: Record<FilaUsuario["rol"], string> = {
  SUPERADMIN: "bg-fuchsia-100 text-fuchsia-800",
  ADMIN_EMPRESA: "bg-sky-100 text-sky-800",
  VENDEDOR: "bg-emerald-100 text-emerald-800",
};

function RolBadge({ rol }: { rol: FilaUsuario["rol"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ROL[rol]}`}
    >
      {rol}
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
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          {typeof pagina.total === "number" ? (
            <p className="text-muted-foreground text-sm">
              {pagina.total} usuario{pagina.total === 1 ? "" : "s"} en total
            </p>
          ) : null}
        </div>
        <Button onClick={() => setDialogo({ tipo: "crear" })}>
          <Plus className="size-4" />
          Crear usuario
        </Button>
      </div>

      <form
        role="search"
        action="/usuarios"
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por username o nombre"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {pagina.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Users className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            {q
              ? "No encontramos usuarios que coincidan con la búsqueda."
              : "Aún no hay usuarios. Crea el primero."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pagina.items.map((u) => {
            const esUnoMismo = u.id === yoUsuarioId;
            return (
              <Card key={u.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
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
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-sm">
                    {u.activo ? (
                      <Badge>Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                    <span className="text-muted-foreground">
                      {u.ultimoAccesoAt
                        ? formatearFechaHoraLima(u.ultimoAccesoAt)
                        : "Nunca ingresó"}
                    </span>
                    <span className="text-muted-foreground">
                      {u.ventas30d} ventas (30d)
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogo({ tipo: "editar", usuario: u })}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogo({ tipo: "reset", usuario: u })}
                  >
                    Restablecer contraseña
                  </Button>
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
