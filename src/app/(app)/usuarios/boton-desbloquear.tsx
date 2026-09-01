"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LockOpen } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Resultado } from "@/lib/tipos";
import { desbloquearUsuario } from "@/modules/usuarios/actions";
import type { FilaUsuario } from "@/modules/usuarios/query";

type Estado = Resultado<Record<string, never>>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

/**
 * Levanta el bloqueo por intentos fallidos. No lleva diálogo de confirmación:
 * es reversible (el usuario puede volver a bloquearse fallando otra vez) y
 * quien lo pulsa está resolviendo a alguien que no puede trabajar.
 */
export function BotonDesbloquear({
  usuario,
  enMenu = false,
}: {
  usuario: FilaUsuario;
  enMenu?: boolean;
}) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    desbloquearUsuario,
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (estado.ok) {
      toast.success(`@${usuario.username} puede volver a iniciar sesión`);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  useEffect(() => {
    if (!estado.ok && estado.mensaje) {
      toast.error(estado.mensaje);
    }
  }, [estado]);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="usuarioId" value={usuario.id} />
      {enMenu ? (
        <DropdownMenuItem
          render={<button type="submit" disabled={pendiente} />}
        >
          <LockOpen /> {pendiente ? "Desbloqueando…" : "Desbloquear"}
        </DropdownMenuItem>
      ) : (
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={pendiente}
        >
          <LockOpen className="size-3.5" />
          {pendiente ? "Desbloqueando…" : "Desbloquear"}
        </Button>
      )}
    </form>
  );
}
