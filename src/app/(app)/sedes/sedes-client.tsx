"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, MapPin, Plus, Search, Store } from "lucide-react";

import type { EmpresaSedeOpcion, FilaSede } from "@/modules/sedes/query";
import type { Pagina } from "@/lib/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { SelectorLocal } from "@/components/selector-local";
import { FormSede } from "./form-sede";
import {
  CabeceraPagina,
  EstadoVacio,
  Metrica,
} from "@/components/shell/pagina-ui";

export function SedesClient({
  pagina,
  empresaId,
  puedeGestionar,
  esSuperadmin,
  q,
  activo,
  empresaFiltro,
  empresas,
  porPagina,
}: {
  pagina: Pagina<FilaSede>;
  empresaId: string;
  puedeGestionar: boolean;
  esSuperadmin: boolean;
  q?: string;
  activo?: boolean;
  empresaFiltro: EmpresaSedeOpcion | null;
  empresas: EmpresaSedeOpcion[];
  porPagina: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogo, setDialogo] = useState<
    { modo: "crear" } | { modo: "editar"; sede: FilaSede } | null
  >(null);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(
    empresaFiltro?.id ?? "",
  );
  const [consulta, setConsulta] = useState(q ?? "");

  const actualizarFiltros = useCallback(
    (cambios: Record<string, string | null>) => {
      const parametros = new URLSearchParams(searchParams.toString());
      parametros.delete("cursor");
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor) parametros.set(clave, valor);
        else parametros.delete(clave);
      }
      const query = parametros.toString();
      router.replace(query ? `/sedes?${query}` : "/sedes", { scroll: false });
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

  const sedes = pagina.items;
  const activas = sedes.filter((sede) => sede.activo).length;
  const totalVentas = sedes.reduce(
    (total, sede) => total + sede.totalVentas30d,
    0,
  );
  const hayFiltros = Boolean(q || activo !== undefined || empresaSeleccionada);

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Organización"
        titulo="Sedes"
        descripcion={
          typeof pagina.total === "number" ? (
            <>
              {pagina.total} sede{pagina.total === 1 ? "" : "s"}
              {puedeGestionar ? " en tu empresa." : " en el universo filtrado."}
            </>
          ) : (
            "Explora el siguiente grupo de sedes del universo filtrado."
          )
        }
        icono={<Store className="size-5" />}
        acciones={
          puedeGestionar ? (
            <Button onClick={() => setDialogo({ modo: "crear" })}>
              <Plus className="size-4" />
              Nueva sede
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Metrica
          etiqueta="Sedes activas"
          valor={activas}
          detalle={`${sedes.length - activas} inactivas en esta página`}
          icono={<Store className="size-4.5" />}
          tono="success"
        />
        <Metrica
          etiqueta="Ventas en 30 días"
          valor={totalVentas}
          detalle="En las sedes de esta página"
          icono={<Activity className="size-4.5" />}
        />
      </div>

      <div
        role="search"
        className={`control-bar grid gap-2 ${
          esSuperadmin
            ? "lg:grid-cols-[minmax(0,1fr)_23rem_23rem]"
            : "lg:grid-cols-[minmax(0,1fr)_23rem]"
        }`}
      >
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            aria-label="Buscar por sede o dirección"
            placeholder="Buscar por sede o dirección"
            className="bg-muted/70 h-11 rounded-xl border-0 pl-9"
          />
        </div>
        {esSuperadmin ? (
          <SelectorLocal
            id="empresa"
            name="empresa"
            value={empresaSeleccionada}
            etiquetaInicial={empresaFiltro?.nombreComercial}
            opciones={empresas.map((empresa) => ({
              id: empresa.id,
              etiqueta: empresa.nombreComercial,
            }))}
            onChange={(empresa) => {
              setEmpresaSeleccionada(empresa);
              actualizarFiltros({ empresa });
            }}
            placeholder="Filtrar por empresa"
            className="bg-background h-11 rounded-xl"
          />
        ) : null}
        <select
          value={
            activo === true ? "activas" : activo === false ? "inactivas" : ""
          }
          onChange={(evento) =>
            actualizarFiltros({ estado: evento.target.value })
          }
          aria-label="Filtrar por estado"
          className="border-input bg-background focus:ring-primary/15 h-11 rounded-xl border px-3 text-sm font-medium outline-none focus:ring-4"
        >
          <option value="">Todos los estados</option>
          <option value="activas">Activas</option>
          <option value="inactivas">Inactivas</option>
        </select>
      </div>

      {sedes.length === 0 ? (
        <EstadoVacio
          icono={<Store className="size-6" />}
          titulo={hayFiltros ? "No encontramos sedes" : "Aún no hay sedes"}
          descripcion={
            hayFiltros
              ? "Prueba con otra búsqueda o ajusta los filtros."
              : "Crea la primera sede para organizar al equipo y registrar ventas."
          }
          accion={
            puedeGestionar && !hayFiltros ? (
              <Button
                variant="secondary"
                onClick={() => setDialogo({ modo: "crear" })}
              >
                Crear la primera sede
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sedes.map((sede) => (
            <Card
              key={sede.id}
              className="bg-card/90 h-full rounded-[1.35rem] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <CardContent className="flex h-full min-h-64 flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-xl">
                        <Store className="size-4" />
                      </span>
                      <h2 className="line-clamp-2 font-semibold">
                        {sede.nombre}
                      </h2>
                    </div>
                    {esSuperadmin ? (
                      <p
                        className="text-muted-foreground mt-2 truncate text-sm"
                        title={sede.empresaNombre}
                      >
                        {sede.empresaNombre}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground mt-3 flex min-h-10 items-start gap-1.5 text-sm leading-5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      <span className="line-clamp-2">
                        {sede.direccion ?? "Sin dirección registrada"}
                      </span>
                    </p>
                  </div>
                  <Badge variant={sede.activo ? "success" : "secondary"}>
                    {sede.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </div>

                <div className="bg-muted/65 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    Ventas en 30 días
                  </span>
                  <strong>{sede.totalVentas30d}</strong>
                </div>

                {puedeGestionar ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-auto self-start"
                    onClick={() => setDialogo({ modo: "editar", sede })}
                  >
                    Editar
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagina.cursor ? (
        <div className="flex items-center justify-center gap-3">
          <span className="text-muted-foreground text-sm">
            {porPagina} por página
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              const parametros = new URLSearchParams(searchParams.toString());
              parametros.set("cursor", pagina.cursor!);
              router.push(`/sedes?${parametros}`);
            }}
          >
            Siguiente página
          </Button>
        </div>
      ) : null}

      {dialogo ? (
        <Dialog open onOpenChange={(abierto) => !abierto && setDialogo(null)}>
          <FormSede
            sede={dialogo.modo === "editar" ? dialogo.sede : null}
            empresaId={empresaId}
            esUltimaActiva={
              activas === 1 && dialogo.modo === "editar" && dialogo.sede.activo
            }
            onCerrar={() => setDialogo(null)}
          />
        </Dialog>
      ) : null}
    </section>
  );
}
