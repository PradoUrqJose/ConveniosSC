"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, WifiOff } from "lucide-react";

import { useEnLinea } from "@/components/estados";

/**
 * Aviso de conexión bajo la cabecera (04-UI §0).
 *
 * Va en el flujo del documento, no flotando: empuja el contenido en vez de
 * taparlo, así que no compite con la barra inferior ni con el CTA del punto
 * de venta, y ningún toque queda debajo (criterio «los mensajes no quedan
 * tapados», issue #56).
 *
 * Desde el #56 también confirma la vuelta: caer en silencio dejaba al
 * usuario sin saber si ya podía guardar. El aviso verde se retira solo a los
 * pocos segundos para no volverse ruido permanente.
 */
const MS_AVISO_REGRESO = 4_000;

export function BannerOffline() {
  const enLinea = useEnLinea();
  // `regreso` solo lo enciende el evento `online`, que por definición llega
  // después de una caída: no hace falta recordar aparte que hubo una, ni
  // sincronizar estado derivado dentro de un efecto.
  const [regreso, setRegreso] = useState(false);

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const alVolver = () => {
      setRegreso(true);
      id = setTimeout(() => setRegreso(false), MS_AVISO_REGRESO);
    };
    const alCaer = () => {
      clearTimeout(id);
      setRegreso(false);
    };
    window.addEventListener("online", alVolver);
    window.addEventListener("offline", alCaer);
    return () => {
      clearTimeout(id);
      window.removeEventListener("online", alVolver);
      window.removeEventListener("offline", alCaer);
    };
  }, []);

  if (!enLinea) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950"
      >
        <WifiOff className="size-4 shrink-0" aria-hidden="true" />
        Sin conexión. Puedes seguir llenando el formulario, pero no podrás
        guardar hasta recuperar la señal.
      </div>
    );
  }

  if (!regreso) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-success/15 text-success flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      Conexión restablecida. Ya puedes guardar.
    </div>
  );
}
