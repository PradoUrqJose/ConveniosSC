"use client";

import { Check, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter, DialogForm } from "@/components/ui/dialog";
import { useDialogFormError } from "@/components/ui/use-dialog-form-error";
import type { Resultado } from "@/lib/tipos";
import { cambiarPassword } from "@/modules/auth/actions";

type Estado = Resultado<Record<string, never>>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function FormularioCambiarPassword({
  alCompletar,
  etiquetaBoton = "Guardar y continuar",
  compacto = false,
  redirigirAlInicio = false,
  alCambiarPendiente,
}: {
  /** Si no se indica, conserva el destino de la página obligatoria. */
  alCompletar?: () => void;
  etiquetaBoton?: string;
  compacto?: boolean;
  /** La página obligatoria termina siempre en el inicio. */
  redirigirAlInicio?: boolean;
  alCambiarPendiente?: (pendiente: boolean) => void;
}) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    cambiarPassword,
    ESTADO_INICIAL,
  );
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    alCambiarPendiente?.(pendiente);
  }, [alCambiarPendiente, pendiente]);

  const requisitos = [
    { ok: nueva.length >= 8, texto: "Al menos 8 caracteres" },
    { ok: /[a-zA-Z]/.test(nueva), texto: "Al menos una letra" },
    { ok: /\d/.test(nueva), texto: "Al menos un número" },
    {
      ok: nueva.length > 0 && nueva === confirmacion,
      texto: "Las contraseñas coinciden",
    },
  ];

  useEffect(() => {
    if (!estado.ok) return;

    toast.success("Se cerraron tus otras sesiones");
    if (alCompletar) {
      alCompletar();
      router.refresh();
      return;
    }
    router.push("/");
    router.refresh();
  }, [alCompletar, estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;
  const Form = compacto ? DialogForm : "form";
  useDialogFormError(estado, formulario, "error-cambiar-password");

  return (
    <Form ref={formulario} action={formAction} className="flex flex-col gap-4">
      {redirigirAlInicio ? (
        <input type="hidden" name="redirigirAlInicio" value="on" />
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="actual">Contraseña actual</Label>
        <Input
          id="actual"
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          disabled={pendiente}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nueva">Nueva contraseña</Label>
        <div className="relative">
          <Input
            id="nueva"
            name="nueva"
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            required
            disabled={pendiente}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            aria-label={mostrar ? "Ocultar contraseñas" : "Mostrar contraseñas"}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
            tabIndex={-1}
          >
            {mostrar ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmacion">Confirmar nueva</Label>
        <Input
          id="confirmacion"
          name="confirmacion"
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          required
          disabled={pendiente}
        />
      </div>

      <ul
        className="bg-muted/60 flex flex-col gap-2 rounded-xl p-3 text-sm"
        aria-live="polite"
      >
        {requisitos.map((r) => (
          <li
            key={r.texto}
            className={
              r.ok
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-muted-foreground"
            }
          >
            <span className="inline-flex items-center gap-1.5">
              {r.ok ? <Check className="size-4" /> : <X className="size-4" />}
              {r.texto}
            </span>
          </li>
        ))}
      </ul>

      {compacto && error ? (
        <p
          id="error-cambiar-password"
          role="alert"
          className="text-destructive text-sm"
        >
          {error}
        </p>
      ) : null}

      {compacto ? (
        <DialogFooter>
          <Button type="submit" disabled={pendiente}>
            {!pendiente ? <ShieldCheck className="size-4" /> : null}
            {pendiente ? "Guardando…" : etiquetaBoton}
          </Button>
        </DialogFooter>
      ) : (
        <Button
          type="submit"
          disabled={pendiente}
          className="h-12 rounded-xl font-bold"
        >
          {!pendiente ? <ShieldCheck className="size-4" /> : null}
          {pendiente ? "Guardando…" : etiquetaBoton}
        </Button>
      )}
      {!compacto && error ? (
        <p
          id="error-cambiar-password"
          role="alert"
          className="text-destructive text-sm"
        >
          {error}
        </p>
      ) : null}
    </Form>
  );
}
