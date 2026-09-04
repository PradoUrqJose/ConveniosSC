"use client";

import { ErrorRuta } from "@/components/estados";

/** Frontera de error de venta-detalle — issue #56.  */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="venta-detalle" error={error} reset={reset} />;
}
