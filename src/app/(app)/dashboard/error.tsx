"use client";

import { ErrorRuta } from "@/components/estados";

/** Frontera de error de dashboard — issue #56. El periodo elegido vive en la URL, así que el reintento lo conserva. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="dashboard" error={error} reset={reset} />;
}
