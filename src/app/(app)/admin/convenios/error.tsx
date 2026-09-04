"use client";

import { ErrorRuta } from "@/components/estados";

/** Frontera de error de convenios — issue #56.  */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="convenios" error={error} reset={reset} />;
}
