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
import { Dialog } from "@/components/ui/dialog";
import type { Pagina } from "@/lib/tipos";
import type { FilaEmpresa } from "@/modules/empresas/query";
import { FormEmpresa } from "./form-empresa";
import { CabeceraPagina, EstadoVacio } from "@/components/shell/pagina-ui";

type Dialogo = { modo: "crear" } | { modo: "editar"; empresa: FilaEmpresa };

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
        className="control-bar flex flex-wrap items-center gap-2"
        onSubmit={(evento) => {
          evento.preventDefault();
          actualizarFiltros({ q: consulta });
        }}
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            name="q"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Buscar por nombre o RUC"
            className="bg-muted/70 h-11 rounded-xl border-0 pl-9"
          />
        </div>
        <select
          name="activo"
          value={estadoFiltro}
          onChange={(evento) => {
            const valor = evento.target.value;
            setEstadoFiltro(valor);
            actualizarFiltros({ activo: valor || null });
          }}
          aria-label="Filtrar por estado"
          className="border-input bg-background h-11 rounded-xl border px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </select>
      </form>

      {pagina.items.length === 0 ? (
        <EstadoVacio
          icono={<Building2 className="size-6" />}
          titulo={q ? "No encontramos empresas" : "Aún no hay empresas"}
          descripcion={
            q
              ? "No encontramos empresas que coincidan con la búsqueda."
              : "Crea la primera organización para comenzar a construir la red de convenios."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    <dt className="text-muted-foreground text-xs">Usuarios</dt>
                    <dd className="font-semibold">{empresa.totalUsuarios}</dd>
                  </div>
                  <div className="bg-muted/60 rounded-lg px-2 py-2">
                    <dt className="text-muted-foreground text-xs">Empleados</dt>
                    <dd className="font-semibold">{empresa.totalEmpleados}</dd>
                  </div>
                  <div className="bg-muted/60 rounded-lg px-2 py-2">
                    <dt className="text-muted-foreground text-xs">Convenios</dt>
                    <dd className="font-semibold">{empresa.totalConvenios}</dd>
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
        <Dialog open onOpenChange={(abierto) => !abierto && setDialogo(null)}>
          <FormEmpresa
            empresa={dialogo.modo === "editar" ? dialogo.empresa : null}
            onCerrar={() => setDialogo(null)}
          />
        </Dialog>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {q ? `Búsqueda: ${q}` : ""}
      </div>
    </section>
  );
}
