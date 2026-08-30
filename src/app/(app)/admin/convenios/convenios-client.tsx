"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BadgePercent, Handshake, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatearFechaUI } from "@/lib/fechas";
import type { Pagina } from "@/lib/tipos";
import type {
  FilaConvenio,
  EmpresaParaConvenio,
} from "@/modules/convenios/query";
import { FormConvenio } from "./form-convenio";
import { FormEditarConvenio } from "./form-editar";
import {
  DialogoCambiarTermino,
  bpsAPorcentaje,
} from "./dialogo-cambiar-termino";
import { CabeceraPagina, EstadoVacio } from "@/components/shell/pagina-ui";

type Dialogo =
  | { tipo: "crear" }
  | { tipo: "editar"; convenio: FilaConvenio }
  | { tipo: "termino"; convenio: FilaConvenio };

function etiquetaVigencia(c: FilaConvenio): string {
  const desde = formatearFechaUI(c.vigenciaDesde);
  return c.vigenciaHasta
    ? `Desde ${desde} · Vence ${formatearFechaUI(c.vigenciaHasta)}`
    : `Desde ${desde} · Sin vencimiento`;
}

function EtiquetaEstado({ estado }: { estado: FilaConvenio["estado"] }) {
  if (estado === "VIGENTE") {
    return <Badge>Vigente</Badge>;
  }
  return <Badge variant="secondary">{estado}</Badge>;
}

export function ConveniosClient({
  pagina,
  empresas,
}: {
  pagina: Pagina<FilaConvenio>;
  empresas: EmpresaParaConvenio[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const convenios = pagina.items;

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Red de beneficios"
        titulo="Convenios"
        descripcion={
          <>
            {convenios.length} convenio{convenios.length === 1 ? "" : "s"} en
            esta página.
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

      {convenios.length === 0 ? (
        <EstadoVacio
          icono={<Handshake className="size-6" />}
          titulo="Aún no hay convenios"
          descripcion="Conecta dos empresas y define los beneficios que ofrecerán a sus equipos."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {convenios.map((c) => (
            <Card
              key={c.id}
              className="bg-card/90 rounded-[1.4rem] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-bold">
                      <span className="truncate">{c.empresaA.nombre}</span>
                      <span className="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded-full">
                        <ArrowRight className="size-3.5" />
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
                    <strong className="text-primary flex shrink-0 items-center gap-1">
                      <BadgePercent className="size-3.5" />
                      {c.terminoAotorga
                        ? `${bpsAPorcentaje(c.terminoAotorga.bps)}%`
                        : "—"}
                    </strong>
                  </div>
                  <div className="bg-muted/65 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3">
                    <span className="min-w-0 truncate">
                      {c.empresaB.nombre} → empleados de {c.empresaA.nombre}
                    </span>
                    <strong className="text-primary flex shrink-0 items-center gap-1">
                      <BadgePercent className="size-3.5" />
                      {c.terminoBotorga
                        ? `${bpsAPorcentaje(c.terminoBotorga.bps)}%`
                        : "—"}
                    </strong>
                  </div>
                </div>

                <p className="text-muted-foreground text-sm">
                  {c.ventas30d} venta{c.ventas30d === 1 ? "" : "s"} en los
                  últimos 30 días
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogo({ tipo: "editar", convenio: c })}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setDialogo({ tipo: "termino", convenio: c })}
                  >
                    Cambiar descuentos
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagina.cursor ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("cursor", pagina.cursor!);
              router.push(`/admin/convenios?${params.toString()}`);
            }}
          >
            Cargar más
          </Button>
        </div>
      ) : null}

      {dialogo ? (
        <Dialog open onOpenChange={(abierto) => !abierto && setDialogo(null)}>
          {dialogo.tipo === "crear" ? (
            <FormConvenio
              empresas={empresas}
              onCerrar={() => setDialogo(null)}
            />
          ) : dialogo.tipo === "editar" ? (
            <FormEditarConvenio
              convenio={dialogo.convenio}
              onCerrar={() => setDialogo(null)}
            />
          ) : (
            <DialogoCambiarTermino
              convenio={dialogo.convenio}
              onCerrar={() => setDialogo(null)}
            />
          )}
        </Dialog>
      ) : null}
    </section>
  );
}
