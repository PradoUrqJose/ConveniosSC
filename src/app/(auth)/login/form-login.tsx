"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RolUsuario } from "@/lib/auth/sesion";
import type { Resultado } from "@/lib/tipos";
import { iniciarSesion } from "@/modules/auth/actions";

type EstadoLogin = Resultado<{ debeCambiarPassword: boolean; rol: RolUsuario }>;

const ESTADO_INICIAL: EstadoLogin = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function LoginForm({ volver }: { volver: string | undefined }) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    iniciarSesion,
    ESTADO_INICIAL,
  );
  const [mostrarPassword, setMostrarPassword] = useState(false);

  useEffect(() => {
    if (!estado.ok) {
      return;
    }
    if (estado.data.debeCambiarPassword) {
      router.push("/perfil/password");
    } else {
      router.push(volver && volver.startsWith("/") ? volver : "/");
    }
    router.refresh();
  }, [estado, router, volver]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-[400px]">
        <CardContent className="flex flex-col gap-6 pt-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Convenios</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Registro de ventas entre empresas con convenio
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                inputMode="text"
                autoCapitalize="off"
                autoFocus
                required
                disabled={pendiente}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={pendiente}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((v) => !v)}
                  aria-label={
                    mostrarPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                  tabIndex={-1}
                >
                  {mostrarPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={pendiente} className="h-12">
              {pendiente ? "Ingresando…" : "Ingresar"}
            </Button>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </form>

          <p className="text-muted-foreground text-center text-sm">
            ¿Olvidaste tu contraseña? Contacta al administrador de tu empresa.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
