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
import {
  Capa,
  CapaContenido,
  CapaCuerpo,
  CapaEncabezado,
  CapaPie,
  CapaTitulo,
} from "@/components/ui/capa";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FiltrosMovil } from "@/components/ui/filtros-movil";
import type { GrupoFiltro } from "@/lib/capas-movil";
import { FilaCatalogoMovil } from "@/components/shell/catalogo-movil";
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
import {
  CabeceraPagina,
  CampoDetalle,
  EstadoSinResultados,
} from "@/components/shell/pagina-ui";

type Dialogo =
  | { tipo: "crear" }
  | { tipo: "editar"; usuario: FilaUsuario }
  | { tipo: "reset"; usuario: FilaUsuario }
  | { tipo: "desactivar"; usuario: FilaUsuario }
  | { tipo: "detalle"; usuario: FilaUsuario };

const ROLES_FILTRO: GrupoFiltro = {
  id: "rol",
  etiqueta: "Rol",
  opciones: [
    { valor: "", etiqueta: "Todos los roles" },
    { valor: "SUPERADMIN", etiqueta: "Admin. general" },
    { valor: "ADMIN_EMPRESA", etiqueta: "Administrador" },
    { valor: "VENDEDOR", etiqueta: "Vendedor" },
  ],
};

const ESTADO_FILTRO: GrupoFiltro = {
  id: "estado",
  etiqueta: "Estado",
  opciones: [
    { valor: "", etiqueta: "Todos los estados" },
    { valor: "activos", etiqueta: "Activos" },
    { valor: "inactivos", etiqueta: "Inactivos" },
  ],
};

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
  empresasParaCrear,
}: {
  pagina: Pagina<FilaUsuario>;
  q?: string;
  rol?: RolUsuario;
  activo?: boolean;
  empresaFiltro: EmpresaOpcion | null;
  porPagina: number;
  esSuperadmin: boolean;
  yoUsuarioId: string;
  empresasParaCrear: EmpresaOpcion[];
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

      {/* Móvil (issue #68): de cuatro filtros siempre visibles a dos —
          buscador y empresa siguen siendo campos de búsqueda propios— más
          un sheet para rol/estado. Escritorio conserva la grilla de cuatro
          controles tal cual estaba. */}
      <div role="search" className="control-bar flex flex-col gap-2 lg:hidden">
        <div className="flex min-w-0 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              placeholder="Buscar por username o nombre"
              className="bg-muted/70 h-11 w-full rounded-xl border-0 pl-9"
            />
          </div>
          <FiltrosMovil
            grupos={[ROLES_FILTRO, ESTADO_FILTRO]}
            valores={{
              rol: rol ?? "",
              estado:
                activo === true
                  ? "activos"
                  : activo === false
                    ? "inactivos"
                    : "",
            }}
            alAplicar={(valores) =>
              router.replace(
                urlDe({
                  rol: valores.rol || null,
                  estado: valores.estado || null,
                }),
                { scroll: false },
              )
            }
          />
        </div>
        <SelectorAsincrono
          id="empresa-movil"
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
      </div>

      <div
        role="search"
        className="control-bar hidden gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_13rem_16rem_13rem]"
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
        <EstadoSinResultados
          icono={<Users className="size-6" />}
          hayFiltros={hayFiltros}
          inicial={{
            titulo: "Aún no hay usuarios",
            descripcion:
              "Crea una cuenta y asígnale el acceso adecuado para comenzar.",
          }}
          filtrado={{
            titulo: "No encontramos usuarios",
            descripcion: "Prueba con otra búsqueda o ajusta los filtros.",
          }}
        />
      ) : (
        <>
          {/* Móvil (issue #68): fila compacta —identidad, rol, empresa,
              estado y actividad— que abre el detalle. Ahí se consolidan
              Editar/Restablecer/Bloquear/Desactivar en un solo pie: el "···"
              de 28px de escritorio no tiene equivalente táctil aquí porque
              ya no compite con nada más en la fila. */}
          <div className="divide-y lg:hidden">
            {pagina.items.map((u) => (
              <FilaCatalogoMovil
                key={u.id}
                icono={
                  <span className="text-xs font-extrabold">
                    {`${u.nombres[0] ?? ""}${u.apellidos[0] ?? ""}`.toUpperCase()}
                  </span>
                }
                titulo={`${u.nombres} ${u.apellidos}`}
                ariaLabel={`Ver detalle de @${u.username}, ${u.activo ? "activo" : "inactivo"}`}
                onClick={() => setDialogo({ tipo: "detalle", usuario: u })}
                badge={
                  u.bloqueado ? (
                    <Badge variant="destructive">Bloqueado</Badge>
                  ) : u.activo ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="secondary">Inactivo</Badge>
                  )
                }
                meta={
                  <>
                    @{u.username}
                    <span>·</span>
                    {NOMBRE_ROL[u.rol]}
                    {u.empresaNombre ? (
                      <>
                        <span>·</span>
                        <span className="truncate">{u.empresaNombre}</span>
                      </>
                    ) : null}
                  </>
                }
              />
            ))}
          </div>
          <div className="hidden gap-4 lg:grid xl:grid-cols-2">
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
        </>
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

      {/* "desactivar" queda fuera de la capa: `DialogoDesactivar` monta su
          propio `ConfirmarDestructivo` (alertdialog en escritorio, sheet
          destructivo en móvil), y envolverlo en una segunda capa apilaba
          dos modales para la misma confirmación — el mismo ajuste que
          Empleados hizo para "rechazar" (issue #67). */}
      {dialogo && dialogo.tipo !== "desactivar" ? (
        <Capa
          abierto
          alCerrar={() => setDialogo(null)}
          variante={dialogo.tipo === "detalle" ? "detail" : "form"}
        >
          {dialogo.tipo === "crear" ? (
            <FormUsuario
              esSuperadmin={esSuperadmin}
              esUnoMismo={false}
              onCerrar={() => setDialogo(null)}
              onCreado={(username, passwordTemporal) =>
                mostrarPassword(username, passwordTemporal)
              }
              empresas={empresasParaCrear}
            />
          ) : dialogo.tipo === "editar" ? (
            <FormUsuario
              usuario={dialogo.usuario}
              esSuperadmin={esSuperadmin}
              esUnoMismo={dialogo.usuario.id === yoUsuarioId}
              onCerrar={() => setDialogo(null)}
              onCreado={() => undefined}
              empresas={empresasParaCrear}
            />
          ) : dialogo.tipo === "reset" ? (
            <DialogoResetear
              usuario={dialogo.usuario}
              onReset={(passwordTemporal) =>
                mostrarPassword(dialogo.usuario.username, passwordTemporal)
              }
            />
          ) : (
            <DetalleUsuario
              usuario={dialogo.usuario}
              esUnoMismo={dialogo.usuario.id === yoUsuarioId}
              onEditar={() =>
                setDialogo({ tipo: "editar", usuario: dialogo.usuario })
              }
              onRestablecer={() =>
                setDialogo({ tipo: "reset", usuario: dialogo.usuario })
              }
              onDesactivar={() =>
                setDialogo({ tipo: "desactivar", usuario: dialogo.usuario })
              }
            />
          )}
        </Capa>
      ) : null}

      {dialogo?.tipo === "desactivar" ? (
        <DialogoDesactivar
          usuario={dialogo.usuario}
          onCerrar={() => setDialogo(null)}
        />
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

function DetalleUsuario({
  usuario: u,
  esUnoMismo,
  onEditar,
  onRestablecer,
  onDesactivar,
}: {
  usuario: FilaUsuario;
  esUnoMismo: boolean;
  onEditar: () => void;
  onRestablecer: () => void;
  onDesactivar: () => void;
}) {
  return (
    <CapaContenido variante="detail" className="sm:max-w-md">
      <CapaEncabezado icono={<UserCog />} eyebrow="Ficha del usuario">
        <CapaTitulo>
          {u.nombres} {u.apellidos}
        </CapaTitulo>
      </CapaEncabezado>
      <CapaCuerpo>
        <dl className="divide-border/70 bg-muted/15 overflow-hidden rounded-[var(--radius-control)] border text-sm">
          <CampoDetalle etiqueta="Usuario">@{u.username}</CampoDetalle>
          <CampoDetalle etiqueta="Rol">
            <RolBadge rol={u.rol} />
          </CampoDetalle>
          {u.empresaNombre ? (
            <CampoDetalle etiqueta="Empresa">{u.empresaNombre}</CampoDetalle>
          ) : null}
          <CampoDetalle etiqueta="Estado">
            {u.bloqueado ? (
              <Badge variant="destructive">Bloqueado</Badge>
            ) : u.activo ? (
              <Badge variant="success">Activo</Badge>
            ) : (
              <Badge variant="secondary">Inactivo</Badge>
            )}
          </CampoDetalle>
          {u.debeCambiarPassword ? (
            <CampoDetalle etiqueta="Contraseña">
              <Badge variant="secondary">Cambio pendiente</Badge>
            </CampoDetalle>
          ) : null}
          <CampoDetalle etiqueta="Último acceso">
            {u.ultimoAccesoAt
              ? formatearFechaHoraLima(u.ultimoAccesoAt)
              : "Nunca ingresó"}
          </CampoDetalle>
          <CampoDetalle etiqueta="Actividad">
            {u.ventas30d} ventas · 30 días
          </CampoDetalle>
        </dl>
      </CapaCuerpo>
      {/* Consolida lo que en escritorio vive en el menú "···" de 28px: en
          móvil no compite con nada más en la fila, así que cada acción es
          su propio botón de 44px+ en vez de un ítem de menú. */}
      <CapaPie className="flex-wrap">
        <Button variant="outline" onClick={onEditar} className="flex-1">
          <Pencil className="size-3.5" /> Editar
        </Button>
        <Button variant="outline" onClick={onRestablecer} className="flex-1">
          <KeyRound className="size-3.5" /> Restablecer contraseña
        </Button>
        {u.bloqueado ? <BotonDesbloquear usuario={u} /> : null}
        {!esUnoMismo ? (
          <Button
            variant={u.activo ? "destructive" : "default"}
            onClick={onDesactivar}
            className="flex-1"
          >
            {u.activo ? (
              <UserRoundX className="size-3.5" />
            ) : (
              <UserRoundCheck className="size-3.5" />
            )}
            {u.activo ? "Desactivar" : "Reactivar"}
          </Button>
        ) : null}
      </CapaPie>
    </CapaContenido>
  );
}
