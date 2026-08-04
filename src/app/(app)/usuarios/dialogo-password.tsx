"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Contraseña temporal mostrada una sola vez (04 §9). Solo se cierra con el botón. */
export function DialogoPassword({
  username,
  passwordTemporal,
  onCerrar,
}: {
  username: string;
  passwordTemporal: string;
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(passwordTemporal);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sin permiso de portapapeles: el usuario puede copiar a mano
    }
  };

  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(abierto, detalles) => {
        if (!abierto && detalles.reason === "close-press") {
          onCerrar();
        }
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="size-4 text-emerald-600" />
            Usuario listo
          </DialogTitle>
          <DialogDescription>
            Entrégale la contraseña al usuario por un canal seguro.
          </DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Usuario</dt>
            <dd className="font-medium">@{username}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Contraseña</dt>
            <dd className="flex items-center gap-2">
              <code className="bg-muted rounded-md px-2 py-1 font-semibold">
                {passwordTemporal}
              </code>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={copiar}
                aria-label="Copiar contraseña"
              >
                {copiado ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </dd>
          </div>
        </dl>

        <p className="flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-600/10 p-3 text-sm text-amber-700">
          <span>
            Esta contraseña <strong>no se volverá a mostrar</strong>. Deberá
            cambiarla en su primer ingreso.
          </span>
        </p>

        <DialogFooter>
          <DialogClose render={<Button />}>Entendido</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
