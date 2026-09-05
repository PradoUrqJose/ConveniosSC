"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CapaCerrar,
  CapaContenido,
  CapaDescripcion,
  CapaEncabezado,
  CapaFormulario,
  CapaPie,
  CapaTitulo,
} from "@/components/ui/capa";
import type { Resultado } from "@/lib/tipos";
import { resetearPassword } from "@/modules/usuarios/actions";
import type { FilaUsuario } from "@/modules/usuarios/query";

type Estado = Resultado<{ passwordTemporal: string }>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function DialogoResetear({
  usuario,
  onReset,
}: {
  usuario: FilaUsuario;
  onReset: (passwordTemporal: string) => void;
}) {
  const formulario = useRef<HTMLFormElement>(null);

  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      return resetearPassword(estadoAnterior, formData);
    },
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (!estado.ok || !estado.data) {
      return;
    }
    onReset(estado.data.passwordTemporal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;

  return (
    <CapaContenido
      pendiente={pendiente}
      variante="secret"
      className="sm:max-w-md"
    >
      <CapaEncabezado
        icono={<KeyRound />}
        tone="warning"
        eyebrow="Seguridad de cuenta"
      >
        <CapaTitulo>Restablecer contraseña</CapaTitulo>
        <CapaDescripcion>
          Se generará una nueva contraseña temporal para @{usuario.username} y
          se revocarán todas sus sesiones.
        </CapaDescripcion>
      </CapaEncabezado>

      <CapaFormulario
        ref={formulario}
        action={formAction}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="usuarioId" value={usuario.id} />

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <CapaPie className="mt-2">
          <CapaCerrar>Cancelar</CapaCerrar>
          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Restableciendo…" : "Restablecer contraseña"}
          </Button>
        </CapaPie>
      </CapaFormulario>
    </CapaContenido>
  );
}
