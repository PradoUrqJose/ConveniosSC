"use client";

import {
  SerwistProvider as Provider,
  useSerwist,
} from "@serwist/turbopack/react";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Una nueva versión espera a que la persona decida aplicarla. Forzar
 * `skipWaiting` mientras se escribe una venta puede desmontar React antes de
 * que el debounce del borrador llegue a localStorage.
 */
function AvisoActualizacion() {
  const { serwist } = useSerwist();
  const [lista, setLista] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    if (!serwist) return;

    const alEsperar = () => setLista(true);
    const alControlar = () => {
      // Solo recargamos después de que el worker nuevo controle esta pestaña;
      // recargar antes es la causa típica de bucles o de una pantalla blanca.
      if (aplicando) window.location.reload();
    };

    serwist.addEventListener("waiting", alEsperar);
    serwist.addEventListener("controlling", alControlar);
    void navigator.serviceWorker.getRegistration("/").then((registro) => {
      if (registro?.waiting) setLista(true);
    });

    return () => {
      serwist.removeEventListener("waiting", alEsperar);
      serwist.removeEventListener("controlling", alControlar);
    };
  }, [serwist, aplicando]);

  if (!lista) return null;

  const actualizar = () => {
    // El formulario de venta escucha este evento y persiste de inmediato el
    // estado actual, sin depender de su debounce normal de 500 ms.
    window.dispatchEvent(new Event("convenios:antes-de-actualizar"));
    setAplicando(true);
    serwist?.messageSkipWaiting();
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      className="border-primary/20 bg-card fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border p-3 shadow-lg"
    >
      <p className="text-sm">
        Hay una actualización lista. Tus cambios de venta se conservarán.
      </p>
      <Button size="sm" onClick={actualizar} disabled={aplicando}>
        <RefreshCw
          className={aplicando ? "size-4 animate-spin" : "size-4"}
          aria-hidden="true"
        />
        {aplicando ? "Actualizando" : "Actualizar"}
      </Button>
    </aside>
  );
}

export function SerwistProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider
      swUrl="/serwist/sw.js"
      cacheOnNavigation={false}
      reloadOnOnline={false}
      options={{ scope: "/", updateViaCache: "none" }}
    >
      {children}
      <AvisoActualizacion />
    </Provider>
  );
}
