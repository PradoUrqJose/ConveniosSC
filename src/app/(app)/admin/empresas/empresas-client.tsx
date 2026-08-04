"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Plus, Search } from "lucide-react";

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
}: {
  pagina: Pagina<FilaEmpresa>;
  q?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  const total = pagina.total;

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
        action="/admin/empresas"
        className="control-bar flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre o RUC"
            className="bg-muted/70 h-11 rounded-xl border-0 pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
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
              className="bg-card/90 rounded-[1.35rem] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-xl">
                        <Building2 className="size-4" />
                      </span>
                      <h2 className="font-bold">{empresa.nombreComercial}</h2>
                    </div>
                    <p className="text-muted-foreground truncate text-sm">
                      {empresa.razonSocial} · RUC {empresa.ruc}
                    </p>
                  </div>
                  <Badge variant={empresa.activo ? "default" : "secondary"}>
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
                  className="self-start"
                  onClick={() => setDialogo({ modo: "editar", empresa })}
                >
                  Editar
                </Button>
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
              router.push(`/admin/empresas?${params.toString()}`);
            }}
          >
            Cargar más
          </Button>
        </div>
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
