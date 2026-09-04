"use client";

import { ErrorRuta } from "@/components/estados";

/** Frontera de error de sedes — issue #56.  */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="sedes" error={error} reset={reset} />;
}
