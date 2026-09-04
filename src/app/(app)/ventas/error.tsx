"use client";

import { ErrorRuta } from "@/components/estados";

/** Frontera de error de ventas — issue #56. Búsqueda, filtros y página siguen en la URL tras el reintento. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="ventas" error={error} reset={reset} />;
}
