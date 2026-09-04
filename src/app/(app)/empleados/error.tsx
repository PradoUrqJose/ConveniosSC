"use client";

import { ErrorRuta } from "@/components/estados";

/** Frontera de error de empleados — issue #56.  */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="empleados" error={error} reset={reset} />;
}
