"use client";

import { ErrorRuta } from "@/components/estados";

/**
 * Frontera de error del punto de venta — issue #56.
 *
 * Es la única pantalla con datos a medio escribir, así que el reintento no
 * los puede perder: `form-venta.tsx` guarda un borrador local
 * (`lib/borrador-venta.ts`) y lo restaura al montar, de modo que `reset()`
 * devuelve el formulario con documento, importe y evidencias donde estaban.
 * Se dice explícitamente, porque un usuario que no lo sabe no toca el botón.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorRuta
      dominio="venta-nueva"
      error={error}
      reset={reset}
      descripcionExtra="La venta que estabas registrando quedó guardada en este dispositivo: al reintentar vuelve con los datos que ya habías cargado."
    />
  );
}
