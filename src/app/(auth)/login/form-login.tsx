"use client";

import { ArrowRight, Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

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
  const [estado, formAction, pendiente] = useActionState(
    iniciarSesion,
    ESTADO_INICIAL,
  );
  const [mostrarPassword, setMostrarPassword] = useState(false);
  // `<form action>` limpia los campos no controlados al resolver la action.
  // El usuario se mantiene controlado para no obligar a reescribirlo tras un
  // fallo; la contraseña sí debe borrarse, así que se deja sin controlar.
  const [username, setUsername] = useState("");
  const refPassword = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!estado.ok) {
      return;
    }
    // La action acaba de establecer una cookie httpOnly. Una navegación del
    // documento completo garantiza que el Proxy la reciba incluso en dev.
    window.location.assign(
      estado.data.debeCambiarPassword
        ? "/perfil/password"
        : volver && volver.startsWith("/")
          ? volver
          : "/",
    );
  }, [estado, volver]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;

  // Tras un fallo el foco vuelve a la contraseña, que es el campo que se vació.
  useEffect(() => {
    if (error) {
      refPassword.current?.focus();
    }
  }, [error]);

  return (
    <main className="dark:bg-background relative flex flex-1 items-center justify-center overflow-hidden bg-[#f5f7ff] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-primary/15 absolute -top-24 -left-28 size-80 rounded-full blur-3xl" />
        <div className="absolute -right-24 -bottom-28 size-96 rounded-full bg-violet-400/15 blur-3xl" />
      </div>
      <div className="bg-card shadow-primary/10 relative grid w-full max-w-4xl overflow-hidden rounded-3xl border shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
        <aside className="from-primary via-primary text-primary-foreground relative hidden min-h-[570px] overflow-hidden bg-linear-to-br to-indigo-950 p-9 lg:flex lg:flex-col">
          <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px] opacity-15" />
          <div className="relative flex size-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Building2 className="size-6" />
          </div>
          <div className="relative mt-auto">
            <p className="text-primary-foreground/70 text-sm font-medium">
              Plataforma de beneficios
            </p>
            <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-tight">
              Convenios que se mueven contigo.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/75">
              Registra, controla y aprovecha cada beneficio entre empresas desde
              un solo lugar.
            </p>
            <div className="mt-8 flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4" /> Acceso seguro para tu equipo
            </div>
          </div>
        </aside>

        <Card className="w-full rounded-none border-0 shadow-none ring-0">
          <CardContent className="flex flex-col justify-center gap-6 px-6 py-8 sm:px-10 lg:min-h-[570px] lg:gap-7 lg:py-9">
            <div>
              <div className="bg-primary text-primary-foreground mb-5 flex size-10 items-center justify-center rounded-xl lg:hidden">
                <Building2 className="size-5" />
              </div>
              <p className="text-primary text-xs font-bold tracking-[0.16em] uppercase">
                Bienvenido
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Ingresa a Convenios
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Usa las credenciales asignadas por tu empresa.
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
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-invalid={error ? true : undefined}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    ref={refPassword}
                    type={mostrarPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={pendiente}
                    className="pr-10"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "login-error" : undefined}
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

              {error && (
                <p
                  id="login-error"
                  role="alert"
                  aria-live="polite"
                  className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={pendiente}
                className="h-12 rounded-xl"
              >
                {pendiente ? "Ingresando…" : "Ingresar"}
                {!pendiente && <ArrowRight className="size-4" />}
              </Button>
            </form>

            <p className="text-muted-foreground text-sm">
              ¿Olvidaste tu contraseña? Contacta al administrador de tu empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
