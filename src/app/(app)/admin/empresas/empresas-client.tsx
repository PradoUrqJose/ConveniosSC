"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Capa,
  CapaContenido,
  CapaCuerpo,
  CapaEncabezado,
  CapaPie,
  CapaTitulo,
} from "@/components/ui/capa";
import { FiltrosMovil } from "@/components/ui/filtros-movil";
import type { GrupoFiltro } from "@/lib/capas-movil";
import { FilaCatalogoMovil } from "@/components/shell/catalogo-movil";
import type { Pagina } from "@/lib/tipos";
import type { FilaEmpresa } from "@/modules/empresas/query";
import { FormEmpresa } from "./form-empresa";
import {
  CabeceraPagina,
  CampoDetalle,
  EstadoSinResultados,
} from "@/components/shell/pagina-ui";

type Dialogo =
  | { modo: "crear" }
  | { modo: "editar"; empresa: FilaEmpresa }
  | { modo: "detalle"; empresa: FilaEmpresa };

const GRUPOS_FILTRO: GrupoFiltro[] = [
  {
    id: "activo",
    etiqueta: "Estado",
    opciones: [
      { valor: "", etiqueta: "Todos los estados" },
      { valor: "true", etiqueta: "Activas" },
      { valor: "false", etiqueta: "Inactivas" },
    ],
  },
];

export function EmpresasClient({
  pagina,
  q,
  activo,
}: {
  pagina: Pagina<FilaEmpresa>;
  q?: string;
  activo?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [consulta, setConsulta] = useState(q ?? "");
  const [estadoFiltro, setEstadoFiltro] = useState(
    activo === undefined ? "" : String(activo),
  );

  const actualizarFiltros = useCallback(
    (cambios: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("cursor");
      params.delete("antes");
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null || !valor) params.delete(clave);
        else params.set(clave, valor);
      }
      const query = params.toString();
      router.replace(query ? `/admin/empresas?${query}` : "/admin/empresas", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (consulta === (q ?? "")) return;
    const espera = window.setTimeout(
      () => actualizarFiltros({ q: consulta }),
      300,
    );
    return () => window.clearTimeout(espera);
  }, [actualizarFiltros, consulta, q]);

  const total = pagina.total;
  const historial = (searchParams.get("antes") ?? "")
    .split(",")
    .filter(Boolean);
  const cursorActual = searchParams.get("cursor");
  const paginaActual = historial.length + 1;
  const totalPaginas = Math.max(
    1,
    Math.ceil((pagina.total ?? pagina.items.length) / 20),
  );
  const desde = pagina.items.length ? (paginaActual - 1) * 20 + 1 : 0;
  const hasta = desde + pagina.items.length - 1;

  const urlDePaginacion = (cambios: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) params.delete(clave);
      else params.set(clave, valor);
    }
    const query = params.toString();
    return query ? `/admin/empresas?${query}` : "/admin/empresas";
  };

  const hrefSiguiente = pagina.cursor
    ? urlDePaginacion({
        cursor: pagina.cursor,
        antes: [...historial, cursorActual ?? "-"].join(","),
      })
    : null;
  const hrefAnterior = historial.length
    ? urlDePaginacion({
        cursor:
          historial[historial.length - 1] === "-"
            ? null
            : historial[historial.length - 1]!,
        antes: historial.slice(0, -1).join(",") || null,
      })
    : null;

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Ecosistema"
        titulo="Empresas"
        descripcion={
          typeof total === "number" ? (
            <>
              {total} empresa{total === 1 ? "" : "s"} en total
            </>
          ) : (
            "Administra las organizaciones que forman parte de la red."
          )
        }
        icono={<Building2 className="size-5" />}
        acciones={
          <Button onClick={() => setDialogo({ modo: "crear" })}>
            <Plus className="size-4" />
            Crear empresa
          </Button>
        }
      />

      <form
        role="search"
        className="control-bar flex items-center gap-2"
        onSubmit={(evento) => {
          evento.preventDefault();
          actualizarFiltros({ q: consulta });
        }}
      >
        {/* El buscador y el único select competían por el mismo ancho y a
            320-390px el buscador terminaba recortado (issue #68). El select
            baja al sheet de filtros en móvil; en escritorio sigue visible
            tal cual estaba. */}
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            name="q"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Buscar por nombre o RUC"
            className="bg-muted/70 h-11 w-full rounded-xl border-0 pl-9"
          />
        </div>
        <FiltrosMovil
          grupos={GRUPOS_FILTRO}
          valores={{ activo: estadoFiltro }}
          alAplicar={(valores) => {
            const valor = valores.activo ?? "";
            setEstadoFiltro(valor);
            actualizarFiltros({ activo: valor || null });
          }}
        />
        <select
          name="activo"
          value={estadoFiltro}
          onChange={(evento) => {
            const valor = evento.target.value;
            setEstadoFiltro(valor);
            actualizarFiltros({ activo: valor || null });
          }}
          aria-label="Filtrar por estado"
          className="border-input bg-background hidden h-11 rounded-xl border px-3 text-sm lg:block"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </select>
      </form>

      {pagina.items.length === 0 ? (
        <EstadoSinResultados
          icono={<Building2 className="size-6" />}
          hayFiltros={Boolean(q) || activo !== undefined}
          inicial={{
            titulo: "Aún no hay empresas",
            descripcion:
              "Crea la primera organización para comenzar a construir la red de convenios.",
          }}
          filtrado={{
            titulo: "No encontramos empresas",
            descripcion:
              "Ninguna empresa coincide con la búsqueda o el estado elegido.",
          }}
        />
      ) : (
        <>
          {/* Móvil (issue #68): mismo patrón de fila compacta de Sedes y
              Empleados — identidad, RUC, resumen y estado en 64px, toda la
              fila abre el detalle; "Editar" se muda al pie de ese sheet. */}
          <div className="divide-y lg:hidden">
            {pagina.items.map((empresa) => (
              <FilaCatalogoMovil
                key={empresa.id}
                icono={<Building2 className="size-4.5" />}
                titulo={empresa.nombreComercial}
                ariaLabel={`Ver detalle de ${empresa.nombreComercial}, ${empresa.activo ? "activa" : "inactiva"}`}
                onClick={() => setDialogo({ modo: "detalle", empresa })}
                badge={
                  <Badge variant={empresa.activo ? "success" : "secondary"}>
                    {empresa.activo ? "Activa" : "Inactiva"}
                  </Badge>
                }
                meta={
                  <>
                    RUC {empresa.ruc}
                    <span>·</span>
                    {empresa.totalUsuarios} usuarios
                    <span>·</span>
                    {empresa.totalEmpleados} empleados
                  </>
                }
              />
            ))}
          </div>
          <div className="hidden grid-cols-1 gap-4 md:grid-cols-2 lg:grid xl:grid-cols-3">
            {pagina.items.map((empresa) => (
              <Card
                key={empresa.id}
                className="bg-card/90 h-full rounded-[1.35rem] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-xl">
                          <Building2 className="size-4" />
                        </span>
                        <h2
                          className="truncate font-bold"
                          title={empresa.nombreComercial}
                        >
                          {empresa.nombreComercial}
                        </h2>
                      </div>
                      <p
                        className="text-muted-foreground mt-2 truncate text-sm"
                        title={empresa.razonSocial}
                      >
                        {empresa.razonSocial}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        RUC <span className="font-mono">{empresa.ruc}</span>
                      </p>
                    </div>
                    <Badge variant={empresa.activo ? "success" : "secondary"}>
                      {empresa.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>

                  <dl className="mt-1 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-muted/60 rounded-lg px-2 py-2">
                      <dt className="text-muted-foreground text-xs">
                        Usuarios
                      </dt>
                      <dd className="font-semibold">{empresa.totalUsuarios}</dd>
                    </div>
                    <div className="bg-muted/60 rounded-lg px-2 py-2">
                      <dt className="text-muted-foreground text-xs">
                        Empleados
                      </dt>
                      <dd className="font-semibold">
                        {empresa.totalEmpleados}
                      </dd>
                    </div>
                    <div className="bg-muted/60 rounded-lg px-2 py-2">
                      <dt className="text-muted-foreground text-xs">
                        Convenios
                      </dt>
                      <dd className="font-semibold">
                        {empresa.totalConvenios}
                      </dd>
                    </div>
                  </dl>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-auto self-start"
                    onClick={() => setDialogo({ modo: "editar", empresa })}
                  >
                    Editar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {pagina.items.length > 0 ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs">
          <span className="text-muted-foreground">
            Mostrando <strong className="text-foreground">{desde}</strong> a{" "}
            <strong className="text-foreground">{hasta}</strong> de{" "}
            <strong className="text-foreground">{pagina.total ?? "…"}</strong>{" "}
            empresas
          </span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden sm:inline">
              Página <strong className="text-foreground">{paginaActual}</strong>{" "}
              de <strong className="text-foreground">{totalPaginas}</strong>
            </span>
            <div className="flex gap-1">
              {hrefAnterior ? (
                <Link
                  href={hrefAnterior}
                  aria-label="Página anterior"
                  className="border-input hover:bg-muted grid size-8 place-items-center rounded-md border"
                >
                  <ChevronLeft className="size-4" />
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
              )}
              {hrefSiguiente ? (
                <Link
                  href={hrefSiguiente}
                  aria-label="Página siguiente"
                  className="border-input hover:bg-muted grid size-8 place-items-center rounded-md border"
                >
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </footer>
      ) : null}

      {dialogo ? (
        <Capa
          abierto
          alCerrar={() => setDialogo(null)}
          variante={dialogo.modo === "detalle" ? "detail" : "form"}
        >
          {dialogo.modo === "detalle" ? (
            <DetalleEmpresa
              empresa={dialogo.empresa}
              onEditar={() =>
                setDialogo({ modo: "editar", empresa: dialogo.empresa })
              }
            />
          ) : (
            <FormEmpresa
              empresa={dialogo.modo === "editar" ? dialogo.empresa : null}
              onCerrar={() => setDialogo(null)}
            />
          )}
        </Capa>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {q ? `Búsqueda: ${q}` : ""}
      </div>
    </section>
  );
}

function DetalleEmpresa({
  empresa,
  onEditar,
}: {
  empresa: FilaEmpresa;
  onEditar: () => void;
}) {
  return (
    <CapaContenido variante="detail" className="sm:max-w-md">
      <CapaEncabezado icono={<Building2 />} eyebrow="Ficha de la empresa">
        <CapaTitulo>{empresa.nombreComercial}</CapaTitulo>
      </CapaEncabezado>
      <CapaCuerpo>
        <dl className="divide-border/70 bg-muted/15 overflow-hidden rounded-[var(--radius-control)] border text-sm">
          <CampoDetalle etiqueta="Estado">
            <Badge variant={empresa.activo ? "success" : "secondary"}>
              {empresa.activo ? "Activa" : "Inactiva"}
            </Badge>
          </CampoDetalle>
          <CampoDetalle etiqueta="Razón social">
            {empresa.razonSocial}
          </CampoDetalle>
          <CampoDetalle etiqueta="RUC">{empresa.ruc}</CampoDetalle>
          <CampoDetalle etiqueta="Usuarios">
            {empresa.totalUsuarios}
          </CampoDetalle>
          <CampoDetalle etiqueta="Empleados">
            {empresa.totalEmpleados}
          </CampoDetalle>
          <CampoDetalle etiqueta="Convenios">
            {empresa.totalConvenios}
          </CampoDetalle>
        </dl>
      </CapaCuerpo>
      <CapaPie>
        <Button onClick={onEditar} className="w-full">
          Editar empresa
        </Button>
      </CapaPie>
    </CapaContenido>
  );
}
