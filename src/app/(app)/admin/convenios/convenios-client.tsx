"use client";

import { useState } from "react";
import { ArrowRight, Handshake, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatearFechaUI } from "@/lib/fechas";
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
  convenios,
  empresas,
}: {
  convenios: FilaConvenio[];
  empresas: EmpresaParaConvenio[];
}) {
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Convenios</h1>
          <p className="text-muted-foreground text-sm">
            {convenios.length} convenio{convenios.length === 1 ? "" : "s"} entre
            empresas
          </p>
        </div>
        <Button onClick={() => setDialogo({ tipo: "crear" })}>
          <Plus className="size-4" />
          Crear convenio
        </Button>
      </div>

      {convenios.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Handshake className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            Aún no hay convenios. Crea el primero entre dos empresas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {convenios.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-semibold">
                      {c.empresaA.nombre}
                      <ArrowRight className="text-muted-foreground size-4" />
                      {c.empresaB.nombre}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {etiquetaVigencia(c)}
                    </p>
                  </div>
                  <EtiquetaEstado estado={c.estado} />
                </div>

                <div className="flex flex-col gap-2 text-sm">
                  <div className="bg-muted/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                    <span className="min-w-0 truncate">
                      {c.empresaA.nombre} → empleados de {c.empresaB.nombre}
                    </span>
                    <strong>
                      {c.terminoAotorga
                        ? `${bpsAPorcentaje(c.terminoAotorga.bps)}%`
                        : "—"}
                    </strong>
                  </div>
                  <div className="bg-muted/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                    <span className="min-w-0 truncate">
                      {c.empresaB.nombre} → empleados de {c.empresaA.nombre}
                    </span>
                    <strong>
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
