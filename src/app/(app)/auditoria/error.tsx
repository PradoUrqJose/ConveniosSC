"use client";

import { ErrorRuta } from "@/components/estados";

/** Frontera de error de auditoria — issue #56.  */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="auditoria" error={error} reset={reset} />;
}
