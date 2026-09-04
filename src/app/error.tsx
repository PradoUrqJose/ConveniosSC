"use client";

import { ErrorRuta } from "@/components/estados";

/**
 * Frontera de error raíz — issue #56.
 *
 * Cubre todo lo que queda fuera del shell autenticado (la galería de
 * estilos, la propia pantalla `~offline`) y hace de red bajo las fronteras
 * por dominio. Se queda dentro del layout raíz, así que el tema y el toaster
 * siguen vivos; solo `global-error.tsx` reemplaza el documento entero.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="raiz" error={error} reset={reset} />;
}
