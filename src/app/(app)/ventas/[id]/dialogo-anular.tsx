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
import { anularVenta } from "@/modules/ventas/actions";
import type { Resultado } from "@/lib/tipos";

type Estado = Resultado<Record<string, never>>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function DialogoAnular({
  ventaId,
  onCerrar,
}: {
  ventaId: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    anularVenta,
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (!estado.ok) {
      return;
    }
    toast.success("Venta anulada");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Anular venta</DialogTitle>
        <DialogDescription>
          Esta acción no se puede deshacer. Si fue un error, deberás registrar
          una venta nueva.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="ventaId" value={ventaId} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo">Motivo de la anulación</Label>
          <Textarea
            id="motivo"
            name="motivo"
            required
            minLength={5}
            maxLength={300}
            disabled={pendiente}
            placeholder="El cliente devolvió la compra…"
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
            {pendiente ? "Anulando…" : "Anular venta"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
