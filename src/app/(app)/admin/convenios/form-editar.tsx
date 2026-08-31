"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Handshake } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogForm,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDialogFormError } from "@/components/ui/use-dialog-form-error";
import { formatearFechaUI } from "@/lib/fechas";
import type { Resultado } from "@/lib/tipos";
import { actualizarConvenio } from "@/modules/convenios/actions";
import type { FilaConvenio } from "@/modules/convenios/query";

const ESTADOS = ["BORRADOR", "VIGENTE", "SUSPENDIDO", "TERMINADO"] as const;

type Estado = Resultado<Record<string, never>>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function FormEditarConvenio({
  convenio,
  onCerrar,
}: {
  convenio: FilaConvenio;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      return actualizarConvenio(estadoAnterior, formData);
    },
    ESTADO_INICIAL,
  );

  const [vigenciaHasta, setVigenciaHasta] = useState(
    convenio.vigenciaHasta ?? "",
  );
  const [notas, setNotas] = useState(convenio.notas ?? "");
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!estado.ok) {
      return;
    }
    toast.success("Convenio actualizado");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;
  useDialogFormError(estado, formulario, "error-form-editar-convenio");

  return (
    <DialogContent pending={pendiente} className="sm:max-w-md">
      <DialogHeader
        icon={<Handshake />}
        tone="warning"
        eyebrow="Gestión de convenios"
      >
        <DialogTitle>Editar convenio</DialogTitle>
        <DialogDescription>
          {convenio.empresaA.nombre} ⇄ {convenio.empresaB.nombre}
        </DialogDescription>
      </DialogHeader>

      <DialogForm
        ref={formulario}
        action={formAction}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="convenioId" value={convenio.id} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="estado">Estado</Label>
          <select
            id="estado"
            name="estado"
            className="border-input bg-background text-foreground h-8 w-full rounded-md border px-2 text-sm"
            defaultValue={convenio.estado}
            disabled={pendiente}
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vigenciaHasta">
            Vigencia hasta (vacío = sin vencimiento)
          </Label>
          <Input
            id="vigenciaHasta"
            name="vigenciaHasta"
            type="date"
            disabled={pendiente}
            value={vigenciaHasta}
            onChange={(e) => setVigenciaHasta(e.target.value)}
          />
          <span className="text-muted-foreground text-xs">
            Vigencia desde {formatearFechaUI(convenio.vigenciaDesde)}. Terminar
            un convenio no afecta las ventas ya registradas.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notas">Notas</Label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            maxLength={1000}
            disabled={pendiente}
            className="border-input bg-background text-foreground rounded-md border px-2 py-1.5 text-sm"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        {error ? (
          <p
            id="error-form-editar-convenio"
            role="alert"
            className="text-destructive text-sm"
          >
            {error}
          </p>
        ) : null}

        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogForm>
    </DialogContent>
  );
}
