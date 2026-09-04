"use client";

import { ErrorRuta } from "@/components/estados";

/** Frontera de error de app — issue #56. Red de seguridad del shell: cubre cualquier ruta sin error.tsx propio. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="app" error={error} reset={reset} />;
}
