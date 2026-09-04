"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { useState } from "react";

import { CambiarPasswordDialog } from "@/components/auth/cambiar-password-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AccionCambiarPassword() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {/* Enlace real, no `Button render={<Link/>}`: Base UI espera un
          `<button>` nativo y avisa por consola con un `<a>` (issue #52). */}
      <Link
        href="/perfil/password"
        className={cn(buttonVariants({ variant: "outline" }), "lg:hidden")}
      >
        <KeyRound className="size-3.5" /> Cambiar contraseña
      </Link>
      <Button
        type="button"
        variant="outline"
        className="hidden lg:inline-flex"
        onClick={() => setAbierto(true)}
      >
        <KeyRound className="size-3.5" /> Cambiar contraseña
      </Button>
      <CambiarPasswordDialog abierto={abierto} alCambiarAbierto={setAbierto} />
    </>
  );
}
