"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  UserCog,
  UserRoundCheck,
  UserRoundX,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectorAsincrono } from "@/components/selector-asincrono";
import { formatearFechaHoraLima } from "@/lib/fechas";
import type { Pagina } from "@/lib/tipos";
import type { RolUsuario } from "@/lib/auth/sesion";
import { type EmpresaOpcion, type FilaUsuario } from "@/modules/usuarios/query";
import { buscarEmpresasOpciones } from "@/modules/usuarios/actions";
import { serializarParametrosUsuarios } from "@/modules/usuarios/filtros";
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

const CENTINELA_PRIMERA_PAGINA = "-";

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
  rol,
  activo,
  empresaFiltro,
  porPagina,
  esSuperadmin,
  yoUsuarioId,
}: {
  pagina: Pagina<FilaUsuario>;
  q?: string;
  rol?: RolUsuario;
  activo?: boolean;
  empresaFiltro: EmpresaOpcion | null;
  porPagina: number;
  esSuperadmin: boolean;
  yoUsuarioId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [consulta, setConsulta] = useState(q ?? "");
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(
    empresaFiltro?.id ?? "",
  );
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [passwordData, setPasswordData] = useState<{
    username: string;
    passwordTemporal: string;
  } | null>(null);

  const mostrarPassword = (username: string, passwordTemporal: string) => {
    setDialogo(null);
    setPasswordData({ username, passwordTemporal });
  };

  const urlDe = useCallback(
    (cambios: Record<string, string | null>) => {
      const entrada = Object.fromEntries(searchParams.entries());
      delete entrada.cursor;
      delete entrada.antes;
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null) delete entrada[clave];
        else entrada[clave] = valor;
      }
      const parametros = serializarParametrosUsuarios(entrada);
      return parametros.size ? `/usuarios?${parametros}` : "/usuarios";
    },
    [searchParams],
  );

  useEffect(() => {
    if (consulta === (q ?? "")) return;
    const espera = window.setTimeout(() => {
      router.replace(urlDe({ q: consulta || null }), { scroll: false });
    }, 300);
    return () => window.clearTimeout(espera);
  }, [consulta, q, router, urlDe]);

  const buscarEmpresas = useCallback(
    (texto: string) => buscarEmpresasOpciones(texto),
    [],
  );
  const historial = (searchParams.get("antes") ?? "")
    .split(",")
    .filter(Boolean);
  const cursorActual = searchParams.get("cursor");
  const hrefSiguiente = pagina.cursor
    ? urlDe({
        cursor: pagina.cursor,
        antes: [...historial, cursorActual ?? CENTINELA_PRIMERA_PAGINA].join(
          ",",
        ),
      })
    : null;
  const hrefAnterior =
    historial.length > 0
      ? (() => {
          const cursorPrevio = historial[historial.length - 1];
          return urlDe({
            cursor:
              !cursorPrevio || cursorPrevio === CENTINELA_PRIMERA_PAGINA
                ? null
                : cursorPrevio,
            antes: historial.slice(0, -1).join(",") || null,
          });
        })()
      : null;
  const paginaActual = historial.length + 1;
  const desde = pagina.items.length ? (paginaActual - 1) * porPagina + 1 : 0;
  const hasta = desde ? desde + pagina.items.length - 1 : 0;
  const hayFiltros = Boolean(
    q || rol || activo !== undefined || empresaSeleccionada,
  );

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

      <div
        role="search"
        className="control-bar grid gap-2 lg:grid-cols-[minmax(0,1fr)_13rem_16rem_13rem]"
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Buscar por username o nombre"
            className="bg-muted/70 h-11 rounded-xl border-0 pl-9"
          />
        </div>
        <select
          value={rol ?? ""}
          onChange={(evento) =>
            router.replace(urlDe({ rol: evento.target.value || null }), {
              scroll: false,
            })
          }
          aria-label="Filtrar por rol"
          className="border-input bg-background focus:ring-primary/15 h-11 rounded-xl border px-3 text-sm font-medium outline-none focus:ring-4"
        >
          <option value="">Todos los roles</option>
          <option value="SUPERADMIN">Admin. general</option>
          <option value="ADMIN_EMPRESA">Administrador</option>
          <option value="VENDEDOR">Vendedor</option>
        </select>
        <SelectorAsincrono
          id="empresa"
          name="empresa"
          value={empresaSeleccionada}
          etiquetaInicial={empresaFiltro?.nombreComercial}
          buscar={buscarEmpresas}
          onChange={(empresa) => {
            setEmpresaSeleccionada(empresa);
            router.replace(urlDe({ empresa: empresa || null }), {
              scroll: false,
            });
          }}
          placeholder="Filtrar por empresa"
          className="bg-background h-11 rounded-xl"
        />
        <select
          value={
            activo === true ? "activos" : activo === false ? "inactivos" : ""
          }
          onChange={(evento) =>
            router.replace(urlDe({ estado: evento.target.value || null }), {
              scroll: false,
            })
          }
          aria-label="Filtrar por estado"
          className="border-input bg-background focus:ring-primary/15 h-11 rounded-xl border px-3 text-sm font-medium outline-none focus:ring-4"
        >
          <option value="">Todos los estados</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      </div>

      {pagina.items.length === 0 ? (
        <EstadoVacio
          icono={<Users className="size-6" />}
          titulo={
            hayFiltros ? "No encontramos usuarios" : "Aún no hay usuarios"
          }
          descripcion={
            hayFiltros
              ? "Prueba con otra búsqueda o ajusta los filtros."
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
                      <div className="min-w-0">
                        <span className="block leading-5 font-bold break-words">
                          {u.nombres} {u.apellidos}
                        </span>
                        <span
                          className="text-muted-foreground block truncate text-sm"
                          title={`@${u.username}`}
                        >
                          @{u.username}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <RolBadge rol={u.rol} />
                        {u.empresaNombre ? (
                          <span className="text-muted-foreground">
                            <span
                              className="line-clamp-1"
                              title={u.empresaNombre}
                            >
                              {u.empresaNombre}
                            </span>
                          </span>
                        ) : null}
                        {u.debeCambiarPassword ? (
                          <Badge variant="secondary">
                            Cambio de contraseña pendiente
                          </Badge>
                        ) : null}
                        {u.bloqueado ? (
                          <Badge variant="destructive">Bloqueado</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                    {u.activo ? (
                      <Badge variant="success">Activo</Badge>
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

                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogo({ tipo: "editar", usuario: u })}
                  >
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Más acciones para @${u.username}`}
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setDialogo({ tipo: "reset", usuario: u })
                        }
                      >
                        <KeyRound /> Restablecer contraseña
                      </DropdownMenuItem>
                      {u.bloqueado ? (
                        <BotonDesbloquear usuario={u} enMenu />
                      ) : null}
                      {!esUnoMismo ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant={u.activo ? "destructive" : "default"}
                            onClick={() =>
                              setDialogo({ tipo: "desactivar", usuario: u })
                            }
                          >
                            {u.activo ? <UserRoundX /> : <UserRoundCheck />}
                            {u.activo
                              ? "Desactivar usuario"
                              : "Reactivar usuario"}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {hrefAnterior || hrefSiguiente ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-muted-foreground text-sm">
            {desde ? `Usuarios ${desde}–${hasta}` : "Sin usuarios"} · Página{" "}
            {paginaActual}
          </span>
          {hrefAnterior ? (
            <Button variant="outline" onClick={() => router.push(hrefAnterior)}>
              Página anterior
            </Button>
          ) : null}
          {hrefSiguiente ? (
            <Button
              variant="secondary"
              onClick={() => router.push(hrefSiguiente)}
            >
              Siguiente página
            </Button>
          ) : null}
        </div>
      ) : null}

      {dialogo ? (
        <Dialog open onOpenChange={(abierto) => !abierto && setDialogo(null)}>
          {dialogo.tipo === "crear" ? (
            <FormUsuario
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
