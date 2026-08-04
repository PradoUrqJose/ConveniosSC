"use client";

import { useSyncExternalStore } from "react";

function suscribir(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function estaEnLinea(): boolean {
  return window.navigator.onLine;
}

/** Banner ámbar fijo bajo el header cuando no hay conexión (04-UI §0). */
export function BannerOffline() {
  const enLinea = useSyncExternalStore(suscribir, estaEnLinea, () => true);

  if (enLinea) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      Sin conexión. Puedes seguir llenando el formulario, pero no podrás guardar
      hasta recuperar la señal.
    </div>
  );
}
