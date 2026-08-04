"use client";

import { Check, Eye, EyeOff, KeyRound, ShieldCheck, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Resultado } from "@/lib/tipos";
import { cambiarPassword } from "@/modules/auth/actions";

type Estado = Resultado<Record<string, never>>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function CambiarPasswordForm() {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    cambiarPassword,
    ESTADO_INICIAL,
  );
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mostrar, setMostrar] = useState(false);

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
    if (estado.ok) {
      toast.success("Se cerraron tus otras sesiones");
      router.push("/");
      router.refresh();
    }
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
      <div className="bg-primary/10 pointer-events-none absolute -top-32 -right-24 size-96 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <Card className="bg-card/95 relative w-full max-w-[460px] rounded-[1.6rem] shadow-[0_24px_70px_rgba(15,23,42,.12)]">
        <CardContent className="flex flex-col gap-6 px-6 pt-7 pb-6 sm:px-8">
          <div>
            <span className="from-primary/15 text-primary ring-primary/10 mb-5 grid size-12 place-items-center rounded-2xl bg-linear-to-br to-cyan-400/15 ring-1">
              <KeyRound className="size-5" />
            </span>
            <p className="page-kicker">Seguridad de la cuenta</p>
            <h1 className="text-2xl font-bold tracking-[-0.035em]">
              Cambia tu contraseña
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Por seguridad, debes definir una contraseña propia antes de
              continuar.
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
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
                  aria-label={
                    mostrar ? "Ocultar contraseñas" : "Mostrar contraseñas"
                  }
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
                    {r.ok ? (
                      <Check className="size-4" />
                    ) : (
                      <X className="size-4" />
                    )}
                    {r.texto}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              type="submit"
              disabled={pendiente}
              className="h-12 rounded-xl font-bold"
            >
              {!pendiente ? <ShieldCheck className="size-4" /> : null}
              {pendiente ? "Guardando…" : "Guardar y continuar"}
            </Button>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
