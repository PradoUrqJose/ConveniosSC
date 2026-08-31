"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserRoundCheck, UserRoundX } from "lucide-react";

import { ConfirmarDestructivo } from "@/components/ui/confirmar-destructivo";
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
    <ConfirmarDestructivo
      abierto
      alCerrar={onCerrar}
      pendiente={pendiente}
      icono={activar ? UserRoundCheck : UserRoundX}
      eyebrow="Gestión de accesos"
      titulo={activar ? "Reactivar usuario" : "Desactivar usuario"}
      entidad={
        activar
          ? `@${usuario.username} volverá a poder iniciar sesión.`
          : `@${usuario.username} perderá el acceso de inmediato.`
      }
      consecuencia={
        activar
          ? "Se reactivará el acceso de esta cuenta."
          : "Se revocarán de inmediato todas las sesiones de esta cuenta."
      }
      accion={activar ? "Reactivar usuario" : "Desactivar usuario"}
      accionPendiente="Guardando…"
      formAction={formAction}
      camposOcultos={
        <>
          <input type="hidden" name="usuarioId" value={usuario.id} />
          <input type="hidden" name="activo" value={activar ? "on" : ""} />
        </>
      }
      error={error}
    />
  );
}
