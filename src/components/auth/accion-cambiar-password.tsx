"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { useState } from "react";

import { CambiarPasswordDialog } from "@/components/auth/cambiar-password-dialog";
import { Button } from "@/components/ui/button";

export function AccionCambiarPassword() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button
        render={<Link href="/perfil/password" />}
        variant="outline"
        className="lg:hidden"
      >
        <KeyRound className="size-3.5" /> Cambiar contraseña
      </Button>
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
