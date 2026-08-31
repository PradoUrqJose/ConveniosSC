"use client";

import { useState } from "react";
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
  const [pendiente, setPendiente] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent variant="secret" pending={pendiente}>
        <DialogHeader icon={<KeyRound />} eyebrow="Seguridad de cuenta">
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Actualiza tu contraseña. Cerraremos las otras sesiones activas por
            seguridad.
          </DialogDescription>
        </DialogHeader>
        <FormularioCambiarPassword
          alCompletar={() => alCambiarAbierto(false)}
          etiquetaBoton="Guardar contraseña"
          compacto
          alCambiarPendiente={setPendiente}
        />
      </DialogContent>
    </Dialog>
  );
}
