"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { actualizarEmpresa, crearEmpresa } from "@/modules/empresas/actions";
import type { FilaEmpresa } from "@/modules/empresas/query";
import type { Resultado } from "@/lib/tipos";

type Estado = Resultado<{ empresaId?: string }>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

function solesDesdeCentimos(centimos: number): string {
  return String(Math.trunc(centimos / 100));
}

export function FormEmpresa({
  empresa,
  onCerrar,
}: {
  empresa?: FilaEmpresa | null;
  onCerrar: () => void;
}) {
  const esEdicion = Boolean(empresa);
  const router = useRouter();

  // `crearEmpresa` y `actualizarEmpresa` devuelven `Resultado` con distinto
  // `data`; la UI no usa ese dato (refresca y cierra), así que el estado del
  // formulario los unifica y el cast queda acotado al borde del wrapper.
  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      const res = esEdicion
        ? await actualizarEmpresa(
            estadoAnterior as Resultado<Record<string, never>>,
            formData,
          )
        : await crearEmpresa(
            estadoAnterior as Resultado<{ empresaId: string }>,
            formData,
          );
      return res as Estado;
    },
    ESTADO_INICIAL,
  );

  const [evidencia, setEvidencia] = useState(
    empresa?.requiereEvidenciaEnVenta ?? false,
  );
  const [activo, setActivo] = useState(empresa?.activo ?? true);
  const [confirmaDesactivar, setConfirmaDesactivar] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!estado.ok || !estado.data) {
      return;
    }
    toast.success(esEdicion ? "Empresa actualizada" : "Empresa creada");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;
  useDialogFormError(estado, formulario, "error-form-empresa");
  const desactiva = esEdicion && !activo && (empresa?.activo ?? true);

  return (
    <DialogContent pending={pendiente} className="sm:max-w-lg">
      <DialogHeader icon={<Building2 />} eyebrow="Directorio empresarial">
        <DialogTitle>
          {esEdicion ? "Editar empresa" : "Crear empresa"}
        </DialogTitle>
        <DialogDescription>
          {esEdicion
            ? "Actualiza los datos de la empresa."
            : "Se creará la empresa con su sede «Principal»."}
        </DialogDescription>
      </DialogHeader>

      <DialogForm
        ref={formulario}
        action={formAction}
        className="flex flex-col gap-4"
      >
        {esEdicion ? (
          <input type="hidden" name="empresaId" value={empresa!.id} />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="ruc">RUC</Label>
          <Input
            id="ruc"
            name="ruc"
            inputMode="numeric"
            maxLength={11}
            required
            disabled={pendiente || esEdicion}
            defaultValue={empresa?.ruc ?? ""}
            placeholder="20123456789"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="razonSocial">Razón social</Label>
          <Input
            id="razonSocial"
            name="razonSocial"
            required
            disabled={pendiente}
            defaultValue={empresa?.razonSocial ?? ""}
            placeholder="Nombre legal S.A.C."
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="nombreComercial">Nombre comercial</Label>
          <Input
            id="nombreComercial"
            name="nombreComercial"
            required
            disabled={pendiente}
            defaultValue={empresa?.nombreComercial ?? ""}
            placeholder="Nombre que se muestra en la app"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="topeMontoVenta">Tope por venta (S/)</Label>
            <Input
              id="topeMontoVenta"
              name="topeMontoVenta"
              inputMode="decimal"
              required
              disabled={pendiente}
              defaultValue={
                empresa
                  ? solesDesdeCentimos(empresa.topeMontoVentaCentimos)
                  : "50000"
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="diasRetroactivosVenta">
              Días retroactivos de venta
            </Label>
            <select
              id="diasRetroactivosVenta"
              name="diasRetroactivosVenta"
              className="border-input bg-background text-foreground h-8 w-full rounded-md border px-2 text-sm"
              disabled={pendiente}
              defaultValue={empresa?.diasRetroactivosVenta ?? 7}
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i} value={i}>
                  {i} días
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <Label htmlFor="requiereEvidenciaEnVenta">
              Exigir evidencia en cada venta
            </Label>
            <span className="text-muted-foreground text-sm">
              El formulario pedirá al menos un adjunto de tipo «evidencia».
            </span>
          </div>
          <Switch
            id="requiereEvidenciaEnVenta"
            checked={evidencia}
            onCheckedChange={(v) => setEvidencia(v)}
            disabled={pendiente}
          />
          <input
            type="hidden"
            name="requiereEvidenciaEnVenta"
            value={evidencia ? "on" : ""}
          />
        </div>

        {esEdicion ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <Label htmlFor="activo">Empresa activa</Label>
              <span className="text-muted-foreground text-sm">
                Al desactivarla se bloqueará el acceso de sus usuarios.
              </span>
            </div>
            <Switch
              id="activo"
              checked={activo}
              onCheckedChange={(v) => setActivo(v)}
              disabled={pendiente}
            />
            <input type="hidden" name="activo" value={activo ? "on" : ""} />
          </div>
        ) : null}

        {desactiva ? (
          <div className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-lg border p-3">
            <p className="text-sm">
              Se bloqueará el acceso a{" "}
              <strong>{empresa!.totalUsuarios} usuarios</strong> y se
              suspenderán sus convenios. Podrás reactivar la empresa después.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmaDesactivar}
                onChange={(e) => setConfirmaDesactivar(e.target.checked)}
                className="mt-0.5"
              />
              Entiendo que esto bloquea el acceso de los usuarios de la empresa.
            </label>
          </div>
        ) : null}

        {error ? (
          <p
            id="error-form-empresa"
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
          <Button
            type="submit"
            disabled={pendiente || (desactiva && !confirmaDesactivar)}
          >
            {pendiente
              ? "Guardando…"
              : esEdicion
                ? "Guardar cambios"
                : "Crear empresa"}
          </Button>
        </DialogFooter>
      </DialogForm>
    </DialogContent>
  );
}
