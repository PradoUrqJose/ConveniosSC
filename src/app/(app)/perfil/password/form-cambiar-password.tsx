"use client";

import { KeyRound } from "lucide-react";

import { FormularioCambiarPassword } from "@/components/auth/formulario-cambiar-password";
import { Card, CardContent } from "@/components/ui/card";

export function CambiarPasswordForm() {
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

          <FormularioCambiarPassword redirigirAlInicio />
        </CardContent>
      </Card>
    </main>
  );
}
