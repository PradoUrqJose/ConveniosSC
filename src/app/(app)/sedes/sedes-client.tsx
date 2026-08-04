"use client";

import { useState } from "react";
import { Activity, MapPin, Plus, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import type { FilaSede } from "@/modules/sedes/query";
import { FormSede } from "./form-sede";
import {
  CabeceraPagina,
  EstadoVacio,
  Metrica,
} from "@/components/shell/pagina-ui";

export function SedesClient({
  sedes,
  empresaId,
  puedeGestionar,
}: {
  sedes: FilaSede[];
  empresaId: string;
  puedeGestionar: boolean;
}) {
  const [dialogo, setDialogo] = useState<
    { modo: "crear" } | { modo: "editar"; sede: FilaSede } | null
  >(null);

  const activas = sedes.filter((s) => s.activo).length;

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Organización"
        titulo="Sedes"
        descripcion={
          <>
            {sedes.length} sede{sedes.length === 1 ? "" : "s"}
            {puedeGestionar ? " en tu empresa." : " en todas las empresas."}
          </>
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
          detalle={`${sedes.length - activas} inactivas`}
          icono={<Store className="size-4.5" />}
          tono="success"
        />
        <Metrica
          etiqueta="Ventas en 30 días"
          valor={sedes.reduce((total, sede) => total + sede.totalVentas30d, 0)}
          detalle="En todas las sedes visibles"
          icono={<Activity className="size-4.5" />}
        />
      </div>

      {sedes.length === 0 ? (
        <EstadoVacio
          icono={<Store className="size-6" />}
          titulo="Aún no hay sedes"
          descripcion="Crea la primera sede para organizar al equipo y registrar ventas."
          accion={
            puedeGestionar ? (
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
              className="bg-card/90 rounded-[1.35rem] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-xl">
                        <Store className="size-4" />
                      </span>
                      <h2 className="font-semibold">{sede.nombre}</h2>
                    </div>
                    <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-sm leading-5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      {sede.direccion ?? "Sin dirección registrada"}
                    </p>
                  </div>
                  <Badge variant={sede.activo ? "default" : "secondary"}>
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
                    className="self-start"
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
