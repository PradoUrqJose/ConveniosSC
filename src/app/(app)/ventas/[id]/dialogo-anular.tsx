"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";

import { ConfirmarDestructivo } from "@/components/ui/confirmar-destructivo";
import { anularVenta } from "@/modules/ventas/actions";
import type { Resultado } from "@/lib/tipos";

type Estado = Resultado<Record<string, never>>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function DialogoAnular({
  ventaId,
  entidad,
  onCerrar,
}: {
  ventaId: string;
  entidad: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    anularVenta,
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (!estado.ok) {
      return;
    }
    toast.success("Venta anulada");
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
      icono={Ban}
      eyebrow="Gestión de ventas"
      titulo="Anular venta"
      entidad={entidad}
      consecuencia="Esta acción no se puede deshacer. Si fue un error, deberás registrar una venta nueva."
      accion="Anular venta"
      accionPendiente="Anulando…"
      formAction={formAction}
      camposOcultos={<input type="hidden" name="ventaId" value={ventaId} />}
      motivo={{
        etiqueta: "Motivo de la anulación",
        placeholder: "El cliente devolvió la compra…",
      }}
      error={error}
    />
  );
}
