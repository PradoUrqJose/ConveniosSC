"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Resultado } from "@/lib/tipos";
import { actualizarUsuario } from "@/modules/usuarios/actions";
import type { FilaUsuario } from "@/modules/usuarios/query";

type Estado = Resultado<Record<string, never>>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function DialogoDesactivar({
  usuario,
  onCerrar,
}: {
  usuario: FilaUsuario;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const activar = !usuario.activo;

  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      return actualizarUsuario(estadoAnterior, formData);
    },
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (!estado.ok) {
      return;
    }
    toast.success(activar ? "Usuario reactivado" : "Usuario desactivado");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {activar ? "Reactivar usuario" : "Desactivar usuario"}
        </DialogTitle>
        <DialogDescription>
          {activar
            ? `@${usuario.username} volverá a poder iniciar sesión.`
            : `@${usuario.username} perderá el acceso de inmediato y se revocarán sus sesiones.`}
        </DialogDescription>
      </DialogHeader>

      <form
        ref={formulario}
        action={formAction}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="usuarioId" value={usuario.id} />
        <input type="hidden" name="activo" value={activar ? "on" : ""} />

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            type="submit"
            variant={activar ? "default" : "destructive"}
            disabled={pendiente}
          >
            {pendiente
              ? "Guardando…"
              : activar
                ? "Reactivar"
                : "Desactivar usuario"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
