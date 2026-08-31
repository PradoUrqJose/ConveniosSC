"use client";

import * as React from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  pendiente?: boolean;
  icono: LucideIcon;
  eyebrow: string;
  titulo: string;
  entidad: React.ReactNode;
  consecuencia: React.ReactNode;
  accion: string;
  accionPendiente: string;
  formAction: React.ComponentProps<"form">["action"];
  camposOcultos: React.ReactNode;
  motivo?: {
    etiqueta: string;
    placeholder: string;
    nombre?: string;
    minimo?: number;
    maximo?: number;
  };
  error?: string | null;
};

/** Confirmación irreversible: siempre `alertdialog` y jamás enfoca la acción. */
export function ConfirmarDestructivo({
  abierto,
  alCerrar,
  pendiente = false,
  icono: Icono,
  eyebrow,
  titulo,
  entidad,
  consecuencia,
  accion,
  accionPendiente,
  formAction,
  camposOcultos,
  motivo,
  error,
}: Props) {
  const motivoRef = React.useRef<HTMLTextAreaElement>(null);
  const cancelarRef = React.useRef<HTMLButtonElement>(null);
  const [longitud, setLongitud] = React.useState(0);
  const maximo = motivo?.maximo ?? 300;
  React.useEffect(() => {
    if (!abierto) return;
    const id = window.setTimeout(
      () => (motivoRef.current ?? cancelarRef.current)?.focus(),
      0,
    );
    return () => window.clearTimeout(id);
  }, [abierto]);
  return (
    <AlertDialog.Root
      open={abierto}
      onOpenChange={(siguiente, detalles) => {
        if (!siguiente && pendiente) {
          detalles.preventUnmountOnClose();
          return;
        }
        if (!siguiente) alCerrar();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="dialog-overlay fixed inset-0 isolate z-[var(--z-overlay)] bg-slate-950/42 backdrop-blur-[6px]" />
        <AlertDialog.Popup
          data-slot="confirmar-destructivo"
          className="bg-popover text-popover-foreground ring-foreground/10 fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex w-full flex-col overflow-hidden rounded-t-[var(--radius-modal)] ring-1 outline-none sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:w-[min(calc(100vw-3rem),30rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-modal)]"
        >
          <div className="relative z-[1] flex shrink-0 items-start px-5 pt-6 pb-5 sm:px-[1.875rem] sm:pt-[1.625rem]">
            <div className="min-w-0 flex-1">
              <div className="text-destructive mb-2 flex items-center gap-1.5 text-[0.6875rem] leading-4 font-bold tracking-[0.18em] uppercase [&_svg]:size-3.5">
                <Icono />
                <span>{eyebrow}</span>
              </div>
              <div className="space-y-1">
                <AlertDialog.Title className="font-heading text-[1.625rem] leading-8 font-extrabold tracking-[-0.025em] text-balance sm:text-[1.6875rem]">
                  {titulo}
                </AlertDialog.Title>
                <AlertDialog.Description className="text-muted-foreground max-w-[56ch] text-[0.90625rem] leading-5.5 text-pretty">
                  {entidad}
                </AlertDialog.Description>
              </div>
            </div>
          </div>
          <form
            action={formAction}
            className="flex flex-col gap-4 px-5 pb-6 sm:px-[1.875rem]"
          >
            {camposOcultos}
            <p className="border-destructive/25 bg-destructive/10 text-foreground rounded-xl border p-3 text-sm">
              {consecuencia}
            </p>
            {motivo ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="motivo">{motivo.etiqueta}</Label>
                  <span
                    className="text-muted-foreground text-xs"
                    aria-hidden="true"
                  >
                    {longitud}/{maximo}
                  </span>
                </div>
                <Textarea
                  ref={motivoRef}
                  id="motivo"
                  name={motivo.nombre ?? "motivo"}
                  required
                  minLength={motivo.minimo ?? 5}
                  maxLength={maximo}
                  disabled={pendiente}
                  placeholder={motivo.placeholder}
                  rows={4}
                  aria-describedby="contador-motivo"
                  onChange={(e) => setLongitud(e.currentTarget.value.length)}
                />
                <span id="contador-motivo" className="sr-only">
                  {longitud} de {maximo} caracteres usados.
                </span>
              </div>
            ) : null}
            {error ? (
              <p
                role="alert"
                aria-live="assertive"
                className="text-destructive text-sm"
              >
                {error}
              </p>
            ) : null}
            <div className="border-border bg-popover -mx-5 mt-2 flex min-h-20 flex-col-reverse gap-2.5 border-t px-5 pt-[1.125rem] pb-[1.375rem] sm:-mx-[1.875rem] sm:flex-row sm:items-center sm:justify-end sm:px-[1.875rem] [&_[data-slot=button]]:min-h-12 [&_[data-slot=button]]:px-6">
              <AlertDialog.Close
                disabled={pendiente}
                render={<Button ref={cancelarRef} variant="outline" />}
              >
                Cancelar
              </AlertDialog.Close>
              <Button type="submit" variant="destructive" disabled={pendiente}>
                {pendiente ? accionPendiente : accion}
              </Button>
            </div>
          </form>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
