"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
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
      <DialogContent showCloseButton={false} variant="secret">
        <DialogHeader
          icon={<KeyRound />}
          tone="success"
          eyebrow="Credencial temporal"
        >
          <DialogTitle>Usuario listo</DialogTitle>
          <DialogDescription>
            Entrégale la contraseña al usuario por un canal seguro.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <p className="sr-only" role="status" aria-live="polite">
            {copiado ? "Contraseña copiada" : ""}
          </p>
          <dl className="divide-border/70 bg-muted/20 overflow-hidden rounded-[var(--radius-control)] border">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-muted-foreground">Usuario</dt>
              <dd className="font-medium">@{username}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-muted-foreground">Contraseña</dt>
              <dd className="flex items-center gap-2">
                <code className="bg-background ring-border rounded-lg px-3 py-2 font-mono text-base font-semibold tracking-wide ring-1">
                  {passwordTemporal}
                </code>
                <Button
                  variant="outline"
                  size="icon-lg"
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

          <p className="text-foreground border-warning/35 bg-warning/10 flex items-start gap-2 rounded-[var(--radius-control)] border p-4 text-sm">
            <span>
              Esta contraseña <strong>no se volverá a mostrar</strong>. Deberá
              cambiarla en su primer ingreso.
            </span>
          </p>
        </DialogBody>

        <DialogFooter>
          <DialogClose render={<Button />}>Entendido</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
