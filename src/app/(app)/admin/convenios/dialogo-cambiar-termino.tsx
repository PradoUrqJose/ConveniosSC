"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Percent } from "lucide-react";

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
import { formatearFechaUI, hoyLima } from "@/lib/fechas";
import type { Resultado } from "@/lib/tipos";
import { cambiarTermino } from "@/modules/convenios/actions";
import type { FilaConvenio } from "@/modules/convenios/query";

type Estado = Resultado<{ terminoId?: string }>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

/** bps → porcentaje sin ceros a la derecha (1500 → "15", 1250 → "12.5"). */
export function bpsAPorcentaje(bps: number): string {
  const n = bps / 100;
  if (Number.isInteger(n)) {
    return String(n);
  }
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

type Direccion = {
  otorganteId: string;
  otorganteNombre: string;
  beneficiariaNombre: string;
  bps: number | null;
  desde: string | null;
};

export function DialogoCambiarTermino({
  convenio,
  onCerrar,
}: {
  convenio: FilaConvenio;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const direcciones: Direccion[] = [
    {
      otorganteId: convenio.empresaA.id,
      otorganteNombre: convenio.empresaA.nombre,
      beneficiariaNombre: convenio.empresaB.nombre,
      bps: convenio.terminoAotorga?.bps ?? null,
      desde: convenio.terminoAotorga?.desde ?? null,
    },
    {
      otorganteId: convenio.empresaB.id,
      otorganteNombre: convenio.empresaB.nombre,
      beneficiariaNombre: convenio.empresaA.nombre,
      bps: convenio.terminoBotorga?.bps ?? null,
      desde: convenio.terminoBotorga?.desde ?? null,
    },
  ];

  const [dirIndex, setDirIndex] = useState(0);
  const [nuevo, setNuevo] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState(hoyLima());
  const formulario = useRef<HTMLFormElement>(null);

  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      const res = await cambiarTermino(
        estadoAnterior as Resultado<{ terminoId: string }>,
        formData,
      );
      return res as Estado;
    },
    ESTADO_INICIAL,
  );

  const direccion = direcciones[dirIndex]!;

  useEffect(() => {
    if (!estado.ok || !estado.data) {
      return;
    }
    toast.success("Descuento actualizado");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;

  return (
    <DialogContent pending={pendiente} className="sm:max-w-md">
      <DialogHeader
        icon={<Percent />}
        tone="warning"
        eyebrow="Condiciones del convenio"
      >
        <DialogTitle>Cambiar descuento</DialogTitle>
        <DialogDescription>
          Se cierra el término vigente y se abre uno nuevo desde la fecha
          elegida.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1">
        <Label>Dirección</Label>
        <div className="flex flex-col gap-2">
          {direcciones.map((d, i) => (
            <label
              key={d.otorganteId}
              className="border-input bg-background text-foreground flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="direccion"
                checked={dirIndex === i}
                onChange={() => setDirIndex(i)}
                className="accent-primary"
              />
              <span className="min-w-0 truncate">
                {d.otorganteNombre} → empleados de {d.beneficiariaNombre}
              </span>
            </label>
          ))}
        </div>
      </div>

      <DialogForm
        ref={formulario}
        action={formAction}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="convenioId" value={convenio.id} />
        <input
          type="hidden"
          name="empresaOtorganteId"
          value={direccion.otorganteId}
        />

        <div className="bg-muted/60 rounded-lg px-3 py-2 text-sm">
          <span className="text-muted-foreground">Actual: </span>
          {direccion.bps === null ? (
            <span>sin término vigente</span>
          ) : (
            <span>
              <strong>{bpsAPorcentaje(direccion.bps)}%</strong> (vigente desde{" "}
              {formatearFechaUI(direccion.desde!)})
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="nuevoDescuento">Nuevo descuento</Label>
          <div className="flex items-center gap-2">
            <Input
              id="nuevoDescuento"
              name="nuevoDescuento"
              inputMode="decimal"
              required
              placeholder="18"
              disabled={pendiente}
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vigenteDesde">Vigente desde</Label>
          <Input
            id="vigenteDesde"
            name="vigenteDesde"
            type="date"
            required
            disabled={pendiente}
            value={vigenteDesde}
            onChange={(e) => setVigenteDesde(e.target.value)}
          />
        </div>

        <p className="text-muted-foreground text-sm">
          Las ventas registradas antes de esta fecha conservarán el{" "}
          {direccion.bps === null ? "" : `${bpsAPorcentaje(direccion.bps)}%`}.
        </p>

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
            {pendiente ? "Aplicando…" : "Confirmar cambio"}
          </Button>
        </DialogFooter>
      </DialogForm>
    </DialogContent>
  );
}
