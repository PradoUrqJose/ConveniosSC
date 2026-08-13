"use client";

import { KeyRound } from "lucide-react";

import { FormularioCambiarPassword } from "@/components/auth/formulario-cambiar-password";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CambiarPasswordDialog({
  abierto,
  alCambiarAbierto,
}: {
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
}) {
  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent className="gap-5 sm:max-w-[30rem] sm:p-6">
        <DialogHeader className="pr-8">
          <span className="from-primary/15 text-primary ring-primary/10 mb-2 grid size-11 place-items-center rounded-xl bg-linear-to-br to-cyan-400/15 ring-1">
            <KeyRound className="size-5" />
          </span>
          <DialogTitle className="text-xl font-bold tracking-[-0.03em]">
            Cambiar contraseña
          </DialogTitle>
          <DialogDescription>
            Actualiza tu contraseña. Cerraremos las otras sesiones activas por
            seguridad.
          </DialogDescription>
        </DialogHeader>
        <FormularioCambiarPassword
          alCompletar={() => alCambiarAbierto(false)}
          etiquetaBoton="Guardar contraseña"
          compacto
        />
      </DialogContent>
    </Dialog>
  );
}
