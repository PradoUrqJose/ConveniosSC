"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Plus,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { formatearFechaUI } from "@/lib/fechas";
import type { Pagina } from "@/lib/tipos";
import type {
  EmpresaParaConvenio,
  FiltroVigenciaConvenio,
  FilaConvenio,
} from "@/modules/convenios/query";
import { FormConvenio } from "./form-convenio";
import { FormEditarConvenio } from "./form-editar";
import {
  DialogoCambiarTermino,
  bpsAPorcentaje,
} from "./dialogo-cambiar-termino";
import {
  CabeceraPagina,
  CampoDetalle,
  EstadoVacio,
} from "@/components/shell/pagina-ui";

type Dialogo =
  | { tipo: "crear" }
  | { tipo: "editar"; convenio: FilaConvenio }
  | { tipo: "termino"; convenio: FilaConvenio }
  | { tipo: "detalle"; convenio: FilaConvenio };

function etiquetaVigencia(c: FilaConvenio): string {
  const desde = formatearFechaUI(c.vigenciaDesde);
  return c.vigenciaHasta
    ? `Desde ${desde} · Vence ${formatearFechaUI(c.vigenciaHasta)}`
    : `Desde ${desde} · Sin vencimiento`;
}

function EtiquetaEstado({ estado }: { estado: FilaConvenio["estado"] }) {
  const etiquetas: Record<FilaConvenio["estado"], string> = {
    BORRADOR: "Borrador",
    VIGENTE: "Vigente",
    SUSPENDIDO: "Suspendido",
    TERMINADO: "Terminado",
  };
  return (
    <Badge variant={estado === "VIGENTE" ? "success" : "secondary"}>
      {etiquetas[estado]}
    </Badge>
  );
}

function Termino({ termino }: { termino: FilaConvenio["terminoAotorga"] }) {
  return termino ? (
    <strong className="text-primary flex shrink-0 items-center gap-1">
      <BadgePercent className="size-3.5" />
      {bpsAPorcentaje(termino.bps)}%
    </strong>
  ) : (
    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
      <TriangleAlert className="size-3.5" aria-hidden />
      Sin descuento vigente
    </span>
  );
}

export function ConveniosClient({
  pagina,
  empresas,
  empresaId,
  estado,
  vigencia,
  empresasParaCrear,
}: {
  pagina: Pagina<FilaConvenio>;
  empresas: EmpresaParaConvenio[];
  empresaId?: string;
  estado?: FilaConvenio["estado"];
  vigencia?: FiltroVigenciaConvenio;
  empresasParaCrear: EmpresaParaConvenio[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const convenios = pagina.items;
  const historial = (searchParams.get("antes") ?? "")
    .split(",")
    .filter(Boolean);
  const paginaActual = historial.length + 1;
  const totalPaginas = Math.max(1, Math.ceil((pagina.total ?? 0) / 20));
  const cursorActual = searchParams.get("cursor");
  const desde = convenios.length ? (paginaActual - 1) * 20 + 1 : 0;
  const hasta = desde ? desde + convenios.length - 1 : 0;

  const urlDe = (cambios: Record<string, string | null>, paginar = false) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!paginar) {
      params.delete("cursor");
      params.delete("antes");
    }
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") params.delete(clave);
      else params.set(clave, valor);
    }
    const query = params.toString();
    return query ? `/admin/convenios?${query}` : "/admin/convenios";
  };
  const hrefSiguiente = pagina.cursor
    ? urlDe(
        {
          cursor: pagina.cursor,
          antes: [...historial, cursorActual ?? "-"].join(","),
        },
        true,
      )
    : null;
  const hrefAnterior = historial.length
    ? urlDe(
        {
          cursor:
            historial[historial.length - 1] === "-"
              ? null
              : historial[historial.length - 1]!,
          antes: historial.slice(0, -1).join(",") || null,
        },
        true,
      )
    : null;

  const gruposFiltro: GrupoFiltro[] = [
    {
      id: "empresa",
      etiqueta: "Empresa",
      opciones: [
        { valor: "", etiqueta: "Todas las empresas" },
        ...empresas.map((empresa) => ({
          valor: empresa.id,
          etiqueta: empresa.nombreComercial,
        })),
      ],
    },
    {
      id: "vigencia",
      etiqueta: "Vigencia",
      opciones: [
        { valor: "", etiqueta: "Todas las vigencias" },
        { valor: "vigente", etiqueta: "Vigentes hoy" },
        { valor: "vencido", etiqueta: "Vencidos" },
        { valor: "sin_vencimiento", etiqueta: "Sin vencimiento" },
      ],
    },
    {
      id: "estado",
      etiqueta: "Estado",
      opciones: [
        { valor: "", etiqueta: "Todos los estados" },
        { valor: "BORRADOR", etiqueta: "Borrador" },
        { valor: "VIGENTE", etiqueta: "Vigente" },
        { valor: "SUSPENDIDO", etiqueta: "Suspendido" },
        { valor: "TERMINADO", etiqueta: "Terminado" },
      ],
    },
  ];

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Red de beneficios"
        titulo="Convenios"
        descripcion={
          <>
            {pagina.total ?? 0} convenio{pagina.total === 1 ? "" : "s"} en
            total.
          </>
        }
        icono={<Handshake className="size-5" />}
        acciones={
          <Button onClick={() => setDialogo({ tipo: "crear" })}>
            <Plus className="size-4" />
            Crear convenio
          </Button>
        }
      />

      {/* Móvil (issue #68): las tres ruedas nativas encadenadas —el mismo
          problema de Usuarios— bajan al sheet único de filtros. Escritorio
          conserva los tres selects tal cual estaban. */}
      <div className="control-bar flex items-center gap-2">
        <FiltrosMovil
          grupos={gruposFiltro}
          valores={{
            empresa: empresaId ?? "",
            vigencia: vigencia ?? "",
            estado: estado ?? "",
          }}
          alAplicar={(valores) =>
            router.replace(
              urlDe({
                empresa: valores.empresa || null,
                vigencia: valores.vigencia || null,
                estado: valores.estado || null,
              }),
            )
          }
        />
        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          <select
            value={empresaId ?? ""}
            onChange={(event) =>
              router.replace(urlDe({ empresa: event.target.value }))
            }
            aria-label="Filtrar por empresa"
            className="border-input bg-background h-11 min-w-48 rounded-xl border px-3 text-sm"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nombreComercial}
              </option>
            ))}
          </select>
          <select
            value={vigencia ?? ""}
            onChange={(event) =>
              router.replace(urlDe({ vigencia: event.target.value }))
            }
            aria-label="Filtrar por vigencia"
            className="border-input bg-background h-11 rounded-xl border px-3 text-sm"
          >
            <option value="">Todas las vigencias</option>
            <option value="vigente">Vigentes hoy</option>
            <option value="vencido">Vencidos</option>
            <option value="sin_vencimiento">Sin vencimiento</option>
          </select>
          <select
            value={estado ?? ""}
            onChange={(event) =>
              router.replace(urlDe({ estado: event.target.value }))
            }
            aria-label="Filtrar por estado"
            className="border-input bg-background h-11 rounded-xl border px-3 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="VIGENTE">Vigente</option>
            <option value="SUSPENDIDO">Suspendido</option>
            <option value="TERMINADO">Terminado</option>
          </select>
        </div>
      </div>

      {convenios.length === 0 ? (
        <EstadoVacio
          icono={<Handshake className="size-6" />}
          titulo="Aún no hay convenios"
          descripcion="Conecta dos empresas y define los beneficios que ofrecerán a sus equipos."
        />
      ) : (
        <>
          {/* Móvil (issue #68): fila compacta —empresas, estado y
              actividad— que abre el detalle; ahí van, sin truncar, las dos
              direcciones del descuento (el "elide direcciones" del issue),
              porque una empresa larga cortada a mitad de frase no dice
              quién otorga y quién recibe. */}
          <div className="divide-y lg:hidden">
            {convenios.map((c) => (
              <FilaCatalogoMovil
                key={c.id}
                icono={<Handshake className="size-4.5" />}
                titulo={`${c.empresaA.nombre} ⇄ ${c.empresaB.nombre}`}
                ariaLabel={`Ver detalle del convenio entre ${c.empresaA.nombre} y ${c.empresaB.nombre}`}
                onClick={() => setDialogo({ tipo: "detalle", convenio: c })}
                badge={<EtiquetaEstado estado={c.estado} />}
                meta={
                  <>
                    <span className="truncate">{etiquetaVigencia(c)}</span>
                    <span>·</span>
                    {c.ventas30d} venta{c.ventas30d === 1 ? "" : "s"}
                  </>
                }
              />
            ))}
          </div>
          <div className="hidden grid-cols-1 gap-4 lg:grid xl:grid-cols-2">
            {convenios.map((c) => (
              <Card
                key={c.id}
                className="bg-card/90 h-full rounded-[1.4rem] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <CardContent className="flex h-full flex-col gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 font-bold">
                        <span className="truncate">{c.empresaA.nombre}</span>
                        <span
                          className="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded-full"
                          aria-label="Convenio bidireccional"
                        >
                          <ArrowLeftRight className="size-3.5" />
                        </span>
                        <span className="truncate">{c.empresaB.nombre}</span>
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {etiquetaVigencia(c)}
                      </p>
                    </div>
                    <EtiquetaEstado estado={c.estado} />
                  </div>

                  <div className="flex flex-col gap-2 text-sm">
                    <div className="bg-muted/65 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
                      <span className="min-w-0 truncate">
                        {c.empresaA.nombre} → empleados de {c.empresaB.nombre}
                      </span>
                      <Termino termino={c.terminoAotorga} />
                    </div>
                    <div className="bg-muted/65 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
                      <span className="min-w-0 truncate">
                        {c.empresaB.nombre} → empleados de {c.empresaA.nombre}
                      </span>
                      <Termino termino={c.terminoBotorga} />
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm">
                    {c.ventas30d} venta{c.ventas30d === 1 ? "" : "s"} en los
                    últimos 30 días
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDialogo({ tipo: "editar", convenio: c })
                      }
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        setDialogo({ tipo: "termino", convenio: c })
                      }
                    >
                      Cambiar descuentos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {convenios.length > 0 ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs">
          <span className="text-muted-foreground">
            Mostrando <strong className="text-foreground">{desde}</strong> a{" "}
            <strong className="text-foreground">{hasta}</strong> de{" "}
            <strong className="text-foreground">{pagina.total ?? 0}</strong>{" "}
            convenios
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
          variante={dialogo.tipo === "detalle" ? "detail" : "form"}
        >
          {dialogo.tipo === "crear" ? (
            <FormConvenio
              empresas={empresasParaCrear}
              onCerrar={() => setDialogo(null)}
            />
          ) : dialogo.tipo === "editar" ? (
            <FormEditarConvenio
              convenio={dialogo.convenio}
              onCerrar={() => setDialogo(null)}
            />
          ) : dialogo.tipo === "termino" ? (
            <DialogoCambiarTermino
              convenio={dialogo.convenio}
              onCerrar={() => setDialogo(null)}
            />
          ) : (
            <DetalleConvenio
              convenio={dialogo.convenio}
              onEditar={() =>
                setDialogo({ tipo: "editar", convenio: dialogo.convenio })
              }
              onCambiarDescuentos={() =>
                setDialogo({ tipo: "termino", convenio: dialogo.convenio })
              }
            />
          )}
        </Capa>
      ) : null}
    </section>
  );
}

function DetalleConvenio({
  convenio: c,
  onEditar,
  onCambiarDescuentos,
}: {
  convenio: FilaConvenio;
  onEditar: () => void;
  onCambiarDescuentos: () => void;
}) {
  return (
    <CapaContenido variante="detail" className="sm:max-w-md">
      <CapaEncabezado icono={<Handshake />} eyebrow="Ficha del convenio">
        <CapaTitulo>
          {c.empresaA.nombre} ⇄ {c.empresaB.nombre}
        </CapaTitulo>
      </CapaEncabezado>
      <CapaCuerpo className="flex flex-col gap-4">
        <dl className="divide-border/70 bg-muted/15 overflow-hidden rounded-[var(--radius-control)] border text-sm">
          <CampoDetalle etiqueta="Estado">
            <EtiquetaEstado estado={c.estado} />
          </CampoDetalle>
          <CampoDetalle etiqueta="Vigencia">{etiquetaVigencia(c)}</CampoDetalle>
          <CampoDetalle etiqueta="Ventas (30 días)">{c.ventas30d}</CampoDetalle>
        </dl>
        {/* Sin `truncate`: el issue #68 pide dejar de elidir a mitad de
            frase cuál empresa otorga y cuál recibe el descuento. */}
        <div className="flex flex-col gap-2 text-sm">
          <div className="bg-muted/65 flex flex-col gap-1 rounded-xl px-3.5 py-3">
            <span className="break-words">
              {c.empresaA.nombre} → empleados de {c.empresaB.nombre}
            </span>
            <Termino termino={c.terminoAotorga} />
          </div>
          <div className="bg-muted/65 flex flex-col gap-1 rounded-xl px-3.5 py-3">
            <span className="break-words">
              {c.empresaB.nombre} → empleados de {c.empresaA.nombre}
            </span>
            <Termino termino={c.terminoBotorga} />
          </div>
        </div>
      </CapaCuerpo>
      <CapaPie>
        <Button variant="outline" onClick={onEditar} className="flex-1">
          Editar
        </Button>
        <Button onClick={onCambiarDescuentos} className="flex-1">
          Cambiar descuentos
        </Button>
      </CapaPie>
    </CapaContenido>
  );
}
