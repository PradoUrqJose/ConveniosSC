"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserRoundX } from "lucide-react";
import { ConfirmarDestructivo } from "@/components/ui/confirmar-destructivo";
import { rechazarEmpleado } from "@/modules/empleados/actions";
import type { FilaEmpleado } from "@/modules/empleados/query";
import type { Resultado } from "@/lib/tipos";
type Estado = Resultado<Record<string, never>>;
const ESTADO_INICIAL: Estado = { ok: false, codigo: "VALIDACION", mensaje: "" };
export function DialogoRechazo({
  empleado,
  onCerrar,
}: {
  empleado: FilaEmpleado;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    rechazarEmpleado,
    ESTADO_INICIAL,
  );
  useEffect(() => {
    if (!estado.ok) return;
    toast.success("Empleado rechazado");
    router.refresh();
    onCerrar();
  }, [estado, router, onCerrar]);
  return (
    <ConfirmarDestructivo
      abierto
      alCerrar={onCerrar}
      pendiente={pendiente}
      icono={UserRoundX}
      eyebrow="Revisión de afiliación"
      titulo="Rechazar empleado"
      entidad={
        <>
          <span className="text-foreground font-medium">
            {empleado.nombres} {empleado.apellidos}
          </span>{" "}
          · {empleado.tipoDocumento === "DNI" ? "DNI" : "CE"}{" "}
          {empleado.numeroDocumento}
        </>
      }
      consecuencia="Las ventas registradas para este empleado quedarán marcadas para revisión."
      accion="Rechazar empleado"
      accionPendiente="Rechazando…"
      formAction={formAction}
      camposOcultos={
        <input type="hidden" name="empleadoId" value={empleado.id} />
      }
      motivo={{
        etiqueta: "Motivo del rechazo",
        placeholder: "El documento no coincide con el titular…",
      }}
      error={!estado.ok && estado.mensaje ? estado.mensaje : null}
    />
  );
}
