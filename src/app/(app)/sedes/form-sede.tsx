"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { actualizarSede, crearSede } from "@/modules/sedes/actions";
import type { FilaSede } from "@/modules/sedes/query";
import type { Resultado } from "@/lib/tipos";

type Estado = Resultado<{ sedeId?: string }>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function FormSede({
  sede,
  empresaId,
  esUltimaActiva,
  onCerrar,
}: {
  sede?: FilaSede | null;
  empresaId: string;
  esUltimaActiva: boolean;
  onCerrar: () => void;
}) {
  const esEdicion = Boolean(sede);
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      const res = esEdicion
        ? await actualizarSede(
            estadoAnterior as Resultado<Record<string, never>>,
            formData,
          )
        : await crearSede(
            estadoAnterior as Resultado<{ sedeId: string }>,
            formData,
          );
      return res as Estado;
    },
    ESTADO_INICIAL,
  );
  const [activo, setActivo] = useState(sede?.activo ?? true);

  useEffect(() => {
    if (!estado.ok || !estado.data) {
      return;
    }
    toast.success(esEdicion ? "Sede actualizada" : "Sede creada");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{esEdicion ? "Editar sede" : "Nueva sede"}</DialogTitle>
        <DialogDescription>
          {esEdicion
            ? "Actualiza los datos de la sede."
            : "Agrega una sede a tu empresa."}
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        {esEdicion ? (
          <input type="hidden" name="sedeId" value={sede!.id} />
        ) : (
          <input type="hidden" name="empresaId" value={empresaId} />
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            name="nombre"
            required
            disabled={pendiente}
            defaultValue={sede?.nombre ?? ""}
            placeholder="Principal"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="direccion">Dirección (opcional)</Label>
          <Input
            id="direccion"
            name="direccion"
            disabled={pendiente}
            defaultValue={sede?.direccion ?? ""}
            placeholder="Av. Ejemplo 123"
          />
        </div>

        {esEdicion ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <Label htmlFor="activo">Sede activa</Label>
              <span className="text-muted-foreground text-sm">
                {esUltimaActiva
                  ? "No puedes desactivar la única sede activa de la empresa."
                  : "No se puede desactivar una sede con ventas del mes en curso."}
              </span>
            </div>
            <Switch
              id="activo"
              checked={activo}
              onCheckedChange={(v) => setActivo(v)}
              disabled={pendiente || esUltimaActiva}
            />
            <input type="hidden" name="activo" value={activo ? "on" : ""} />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button type="submit" disabled={pendiente}>
            {pendiente
              ? "Guardando…"
              : esEdicion
                ? "Guardar cambios"
                : "Crear sede"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
