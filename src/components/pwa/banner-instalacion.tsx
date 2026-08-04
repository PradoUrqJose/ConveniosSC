"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const CLAVE_VISITAS = "pwa-visitas";
const CLAVE_DESCARTADO = "pwa-banner-descartado";
const VISITAS_PARA_MOSTRAR = 2;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function registrarVisitaYObtenerConteo(): number {
  const previas = Number(localStorage.getItem(CLAVE_VISITAS) ?? "0");
  const total = previas + 1;
  localStorage.setItem(CLAVE_VISITAS, String(total));
  return total;
}

function estaInstalada(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** Prompt de instalación tras la segunda visita, ver docs/04-UI.md §16. */
export function BannerInstalacion() {
  const pathname = usePathname();
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (estaInstalada() || localStorage.getItem(CLAVE_DESCARTADO)) {
      return;
    }

    const conteo = registrarVisitaYObtenerConteo();

    function alCapturarPrompt(e: Event) {
      e.preventDefault();
      if (conteo >= VISITAS_PARA_MOSTRAR) {
        setEvento(e as BeforeInstallPromptEvent);
        setVisible(true);
      } else {
        setEvento(e as BeforeInstallPromptEvent);
      }
    }

    function alInstalar() {
      setVisible(false);
      localStorage.setItem(CLAVE_DESCARTADO, "1");
    }

    window.addEventListener("beforeinstallprompt", alCapturarPrompt);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alCapturarPrompt);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  // No interrumpir el formulario de venta.
  if (pathname.startsWith("/ventas/nueva")) {
    return null;
  }

  if (!visible || !evento) {
    return null;
  }

  function descartar() {
    setVisible(false);
    localStorage.setItem(CLAVE_DESCARTADO, "1");
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    setVisible(false);
    localStorage.setItem(CLAVE_DESCARTADO, "1");
  }

  return (
    <div
      role="status"
      className="border-border bg-card fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-xl border p-3 shadow-lg lg:right-4 lg:bottom-4 lg:left-auto"
    >
      <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-full">
        <Download className="text-primary size-4" aria-hidden="true" />
      </div>
      <div className="flex-1 text-sm">
        <p className="font-medium">Instalar Convenios</p>
        <p className="text-muted-foreground">
          Acceso rápido desde tu pantalla de inicio.
        </p>
      </div>
      <Button size="sm" onClick={instalar}>
        Instalar
      </Button>
      <button
        type="button"
        onClick={descartar}
        aria-label="Descartar"
        className="text-muted-foreground hover:text-foreground shrink-0 p-1"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
