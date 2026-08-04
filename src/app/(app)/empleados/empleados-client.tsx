"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Plus, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatearSoles } from "@/lib/dinero";
import { fechaRelativa } from "@/lib/fechas";
import type { Pagina, Resultado } from "@/lib/tipos";
import { verificarEmpleado } from "@/modules/empleados/actions";
import type { FilaEmpleado, EmpresaOpcion } from "@/modules/empleados/query";
import { FormEmpleado } from "./form-empleado";
import { DialogoRechazo } from "./dialogo-rechazo";

const TABS = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "activos", label: "Activos" },
  { id: "inactivos", label: "Inactivos" },
  { id: "rechazados", label: "Rechazados" },
] as const;

type Dialogo =
  | { tipo: "crear" }
  | { tipo: "detalle"; empleado: FilaEmpleado }
  | { tipo: "editar"; empleado: FilaEmpleado }
  | { tipo: "rechazar"; empleado: FilaEmpleado }
  | null;

const VARIANTE_ESTADO: Record<
  FilaEmpleado["estado"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVO: "default",
  PENDIENTE_VERIFICACION: "secondary",
  RECHAZADO: "destructive",
  INACTIVO: "outline",
};

const TEXTO_ESTADO: Record<FilaEmpleado["estado"], string> = {
  ACTIVO: "Activo",
  PENDIENTE_VERIFICACION: "Pendiente",
  RECHAZADO: "Rechazado",
  INACTIVO: "Inactivo",
};

export function EmpleadosClient({
  pagina,
  tab,
  q,
  empresas,
  pendientesTotal,
  esSuperadmin,
  miEmpresaId,
}: {
  pagina: Pagina<FilaEmpleado>;
  tab: string;
  q?: string;
  empresas: EmpresaOpcion[];
  pendientesTotal: number;
  esSuperadmin: boolean;
  miEmpresaId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(q ?? "");
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("cursor");
      if (texto) {
        params.set("q", texto);
      } else {
        params.delete("q");
      }
      const target = `${pathname}?${params.toString()}`;
      if (target !== `${pathname}?${searchParams.toString()}`) {
        router.replace(target);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const urlDe = (cambios: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) {
        params.delete(clave);
      } else {
        params.set(clave, valor);
      }
    }
    return `${pathname}?${params.toString()}`;
  };

  const conCursor = urlDe({
    tab,
    q: q ?? null,
    cursor: pagina.cursor,
  });

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
          <p className="text-muted-foreground text-sm">
            {pagina.total ?? pagina.items.length} empleado
            {(pagina.total ?? pagina.items.length) === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={() => setDialogo({ tipo: "crear" })}>
          <Plus className="size-4" />
          Nuevo empleado
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={urlDe({ tab: t.id === "todos" ? null : t.id })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.id === "pendientes" && pendientesTotal > 0 ? (
                <span className="ml-1.5">({pendientesTotal})</span>
              ) : null}
            </Link>
          ))}
        </div>

        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="DNI o nombre"
            className="pl-9"
            inputMode="numeric"
          />
        </div>
      </div>

      {pagina.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Users className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            {q || tab !== "todos"
              ? "Ningún empleado coincide con los filtros."
              : "Aún no hay empleados registrados."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pagina.items.map((empleado) => (
            <button
              key={empleado.id}
              type="button"
              onClick={() => setDialogo({ tipo: "detalle", empleado })}
              className="bg-card hover:bg-accent/50 flex items-center gap-3 rounded-xl border p-4 text-left transition-colors"
            >
              <div className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                {empleado.nombres[0]}
                {empleado.apellidos[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {empleado.nombres.toUpperCase()}{" "}
                  {empleado.apellidos.toUpperCase()}
                </p>
                <p className="text-muted-foreground truncate text-sm">
                  {empleado.dni}
                  {empleado.telefono ? ` · 📞 ${empleado.telefono}` : ""}
                  {esSuperadmin ? ` · ${empleado.empresaNombre}` : ""}
                </p>
                <p className="text-muted-foreground text-xs">
                  {empleado.comprasUltimos30d} compra
                  {empleado.comprasUltimos30d === 1 ? "" : "s"} ·{" "}
                  {formatearSoles(empleado.montoUltimos30d)} (30 días)
                </p>
              </div>
              <Badge
                variant={VARIANTE_ESTADO[empleado.estado]}
                className="shrink-0"
              >
                {TEXTO_ESTADO[empleado.estado]}
              </Badge>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </button>
          ))}

          {pagina.cursor ? (
            <Link
              href={conCursor}
              className="mx-auto rounded-full border px-4 py-2 text-sm font-medium"
            >
              Cargar más
            </Link>
          ) : null}
        </div>
      )}

      {dialogo?.tipo === "crear" ? (
        <Dialog open onOpenChange={(a) => !a && setDialogo(null)}>
          <FormEmpleado
            empresas={empresas}
            miEmpresaId={miEmpresaId}
            onCerrar={() => setDialogo(null)}
          />
        </Dialog>
      ) : null}

      {dialogo?.tipo === "detalle" ? (
        <Dialog open onOpenChange={(a) => !a && setDialogo(null)}>
          <DetalleEmpleado
            empleado={dialogo.empleado}
            puedeGestionar={
              esSuperadmin || miEmpresaId === dialogo.empleado.empresaId
            }
            onEditar={() =>
              setDialogo({ tipo: "editar", empleado: dialogo.empleado })
            }
            onRechazar={() =>
              setDialogo({ tipo: "rechazar", empleado: dialogo.empleado })
            }
            onCerrar={() => setDialogo(null)}
          />
        </Dialog>
      ) : null}

      {dialogo?.tipo === "editar" ? (
        <Dialog open onOpenChange={(a) => !a && setDialogo(null)}>
          <FormEmpleado
            empleado={dialogo.empleado}
            empresas={empresas}
            miEmpresaId={miEmpresaId}
            onCerrar={() => setDialogo(null)}
          />
        </Dialog>
      ) : null}

      {dialogo?.tipo === "rechazar" ? (
        <Dialog open onOpenChange={(a) => !a && setDialogo(null)}>
          <DialogoRechazo
            empleado={dialogo.empleado}
            onCerrar={() => setDialogo(null)}
          />
        </Dialog>
      ) : null}
    </section>
  );
}

function DetalleEmpleado({
  empleado,
  puedeGestionar,
  onEditar,
  onRechazar,
  onCerrar,
}: {
  empleado: FilaEmpleado;
  puedeGestionar: boolean;
  onEditar: () => void;
  onRechazar: () => void;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [estadoVerificacion, formActionVerificar, pendiente] = useActionState(
    verificarEmpleado,
    { ok: false, codigo: "VALIDACION", mensaje: "" } as Resultado<
      Record<string, never>
    >,
  );

  useEffect(() => {
    if (!estadoVerificacion.ok) {
      return;
    }
    toast.success("Empleado verificado");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoVerificacion, router]);

  const esPendiente = empleado.estado === "PENDIENTE_VERIFICACION";

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {empleado.nombres.toUpperCase()} {empleado.apellidos.toUpperCase()}
        </DialogTitle>
        <DialogDescription>
          DNI {empleado.dni} · {empleado.empresaNombre}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {empleado.fotoDniBlobPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={empleado.fotoDniBlobPath}
            alt="Foto del DNI"
            className="mx-auto max-h-56 rounded-xl border object-cover"
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Sin foto del DNI registrada.
          </p>
        )}

        <dl className="text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">Estado</dt>
            <dd>
              <Badge variant={VARIANTE_ESTADO[empleado.estado]}>
                {TEXTO_ESTADO[empleado.estado]}
              </Badge>
            </dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd>{empleado.telefono ?? "—"}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">Compras (30 días)</dt>
            <dd>
              {empleado.comprasUltimos30d} ·{" "}
              {formatearSoles(empleado.montoUltimos30d)}
            </dd>
          </div>
          {empleado.creadoPorNombre ? (
            <div className="flex justify-between py-1">
              <dt className="text-muted-foreground">Creado por</dt>
              <dd>
                {empleado.creadoPorNombre} · {fechaRelativa(empleado.createdAt)}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {puedeGestionar ? (
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {esPendiente ? (
            <form action={formActionVerificar} className="flex flex-col gap-2">
              <input type="hidden" name="empleadoId" value={empleado.id} />
              <Button type="submit" disabled={pendiente} className="w-full">
                {pendiente ? "Verificando…" : "Verificar empleado"}
              </Button>
            </form>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onEditar}
            >
              Editar datos
            </Button>
            {esPendiente ? (
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={onRechazar}
              >
                Rechazar
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}
