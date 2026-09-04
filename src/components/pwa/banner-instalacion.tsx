"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, PlusSquare, Share, Smartphone, X } from "lucide-react";

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
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function esIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Android y escritorio exponen `beforeinstallprompt`; Safari en iOS no. En
 * ese caso se muestra la instrucción nativa de "Añadir a pantalla de inicio".
 */
export function BannerInstalacion() {
  const pathname = usePathname();
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalacionIOS, setInstalacionIOS] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hayModal, setHayModal] = useState(false);

  useEffect(() => {
    const actualizar = () =>
      setHayModal(
        Boolean(
          document.querySelector(
            '[data-slot="dialog-content"], [data-slot="confirmar-destructivo"]',
          ),
        ),
      );
    actualizar();
    const observador = new MutationObserver(actualizar);
    observador.observe(document.body, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (estaInstalada()) {
      return;
    }

    const dispositivoIOS = esIOS();
    let eventoCapturado: BeforeInstallPromptEvent | null = null;
    function mostrarDesdeMenu() {
      if (dispositivoIOS) {
        setInstalacionIOS(true);
        setVisible(true);
      } else if (eventoCapturado) {
        setEvento(eventoCapturado);
        setVisible(true);
      }
    }
    window.addEventListener("convenios:mostrar-instalacion", mostrarDesdeMenu);

    if (localStorage.getItem(CLAVE_DESCARTADO)) {
      return () =>
        window.removeEventListener(
          "convenios:mostrar-instalacion",
          mostrarDesdeMenu,
        );
    }

    const conteo = registrarVisitaYObtenerConteo();

    // Safari no implementa beforeinstallprompt, por lo que nunca habría un
    // botón funcional si se dependiera únicamente de dicho evento.
    if (dispositivoIOS) {
      const temporizador = window.setTimeout(() => {
        setInstalacionIOS(true);
        setVisible(true);
      }, 0);
      return () => {
        window.clearTimeout(temporizador);
        window.removeEventListener(
          "convenios:mostrar-instalacion",
          mostrarDesdeMenu,
        );
      };
    }

    function alCapturarPrompt(e: Event) {
      e.preventDefault();
      eventoCapturado = e as BeforeInstallPromptEvent;
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
      window.removeEventListener(
        "convenios:mostrar-instalacion",
        mostrarDesdeMenu,
      );
    };
  }, []);

  // No interrumpir el formulario de venta.
  if (pathname.startsWith("/ventas/nueva")) {
    return null;
  }

  if (hayModal || !visible || (!evento && !instalacionIOS)) {
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
      aria-label="Sugerencia para instalar Convenios"
      className="border-border/80 bg-card/96 fixed inset-x-3 bottom-[calc(var(--mob-hueco-avisos,4.2rem)+0.5rem)] z-[var(--z-pwa)] mx-auto max-w-md overflow-hidden rounded-[1.4rem] border p-4 shadow-[0_24px_70px_rgba(15,23,42,.24)] backdrop-blur-xl lg:right-5 lg:bottom-5 lg:left-auto"
    >
      <div className="flex items-start gap-3">
        <div className="from-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-linear-to-br to-cyan-400/15 ring-1 ring-current/10">
          <Smartphone className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold tracking-tight">Lleva Convenios contigo</p>
          <p className="text-muted-foreground mt-0.5 leading-5">
            {instalacionIOS
              ? "En iPhone y iPad la instalación se completa desde el menú Compartir."
              : "Instálala para abrirla a pantalla completa y acceder más rápido."}
          </p>
        </div>
        <button
          type="button"
          onClick={descartar}
          aria-label="Cerrar instrucciones de instalación"
          className="text-muted-foreground hover:bg-muted hover:text-foreground -mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full transition-colors"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {instalacionIOS ? (
        <ol className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <li className="bg-muted/70 flex items-center gap-2 rounded-xl p-3 font-semibold">
            <span className="bg-background text-primary grid size-7 shrink-0 place-items-center rounded-lg shadow-sm">
              <Share className="size-3.5" />
            </span>
            1. Toca Compartir
          </li>
          <li className="bg-muted/70 flex items-center gap-2 rounded-xl p-3 font-semibold">
            <span className="bg-background text-primary grid size-7 shrink-0 place-items-center rounded-lg shadow-sm">
              <PlusSquare className="size-3.5" />
            </span>
            2. Añadir a inicio
          </li>
        </ol>
      ) : (
        <Button className="mt-4 h-10 w-full rounded-xl" onClick={instalar}>
          <Download className="size-4" />
          Instalar aplicación
        </Button>
      )}
    </div>
  );
}
