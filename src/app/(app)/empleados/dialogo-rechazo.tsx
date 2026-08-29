"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rechazarEmpleado } from "@/modules/empleados/actions";
import type { FilaEmpleado } from "@/modules/empleados/query";
import type { Resultado } from "@/lib/tipos";

type Estado = Resultado<Record<string, never>>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function DialogoRechazo({
  empleado,
  onCerrar,
}: {
  empleado: FilaEmpleado;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    rechazarEmpleado,
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (!estado.ok) {
      return;
    }
    toast.success("Empleado rechazado");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Rechazar empleado</DialogTitle>
        <DialogDescription>
          <span className="text-foreground font-medium">
            {empleado.nombres} {empleado.apellidos}
          </span>{" "}
          · {empleado.tipoDocumento === "DNI" ? "DNI" : "CE"}{" "}
          {empleado.numeroDocumento}
        </DialogDescription>
      </DialogHeader>

      <div className="bg-warning/10 text-warning border-warning/20 rounded-xl border p-3 text-sm">
        Esto marcará para revisión las ventas registradas a este empleado.
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="empleadoId" value={empleado.id} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo">Motivo del rechazo</Label>
          <Textarea
            id="motivo"
            name="motivo"
            required
            minLength={5}
            maxLength={300}
            disabled={pendiente}
            placeholder="El documento no coincide con el titular…"
            rows={4}
          />
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button type="submit" variant="destructive" disabled={pendiente}>
            {pendiente ? "Rechazando…" : "Rechazar empleado"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
