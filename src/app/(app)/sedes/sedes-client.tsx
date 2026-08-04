"use client";

import { useState } from "react";
import { Building2, Plus, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import type { FilaSede } from "@/modules/sedes/query";
import { FormSede } from "./form-sede";

export function SedesClient({
  sedes,
  empresaId,
}: {
  sedes: FilaSede[];
  empresaId: string;
}) {
  const [dialogo, setDialogo] = useState<
    { modo: "crear" } | { modo: "editar"; sede: FilaSede } | null
  >(null);

  const activas = sedes.filter((s) => s.activo).length;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sedes</h1>
          <p className="text-muted-foreground text-sm">
            {sedes.length} sede{sedes.length === 1 ? "" : "s"} en tu empresa
          </p>
        </div>
        <Button onClick={() => setDialogo({ modo: "crear" })}>
          <Plus className="size-4" />
          Nueva sede
        </Button>
      </div>

      {sedes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Store className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            Aún no hay sedes registradas. Crea la primera para poder registrar
            ventas.
          </p>
          <Button
            variant="secondary"
            onClick={() => setDialogo({ modo: "crear" })}
          >
            Crear la primera sede
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sedes.map((sede) => (
            <Card key={sede.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Store className="text-muted-foreground size-4" />
                      <h2 className="font-semibold">{sede.nombre}</h2>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {sede.direccion ?? "Sin dirección registrada"}
                    </p>
                  </div>
                  <Badge variant={sede.activo ? "default" : "secondary"}>
                    {sede.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </div>

                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Building2 className="size-4" />
                  {sede.totalVentas30d} venta
                  {sede.totalVentas30d === 1 ? "" : "s"} en los últimos 30 días
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setDialogo({ modo: "editar", sede })}
                >
                  Editar
                </Button>
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
