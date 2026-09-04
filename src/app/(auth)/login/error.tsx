"use client";

import { ErrorRuta } from "@/components/estados";

/** Frontera de error del login — issue #56. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRuta dominio="login" error={error} reset={reset} />;
}
