"use client";

import { useEffect, useRef, useState } from "react";
import { Download, PlusSquare, Share, Smartphone, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const CLAVE_VALOR_PERCIBIDO = "pwa-valor-percibido";
const CLAVE_DESCARTADO = "pwa-banner-descartado";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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

/** Eventos mínimos, sin identificadores ni datos de la operación del usuario. */
function telemetria(
  evento: "elegible" | "aceptada" | "descartada" | "lanzada",
) {
  console.info(JSON.stringify({ esquema: "convenios.pwa.v1", evento }));
}

function anunciarElegibilidad() {
  window.dispatchEvent(new Event("convenios:instalacion-elegible"));
}

/**
 * Android y escritorio exponen `beforeinstallprompt`; Safari en iOS no. En
 * ese caso se muestra la instrucción nativa de "Añadir a pantalla de inicio".
 */
export function BannerInstalacion() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalacionIOS, setInstalacionIOS] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hayModal, setHayModal] = useState(false);
  const aceptacionRegistrada = useRef(false);

  function registrarAceptacion() {
    if (aceptacionRegistrada.current) return;
    aceptacionRegistrada.current = true;
    telemetria("aceptada");
  }

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
      telemetria("lanzada");
      return;
    }

    const dispositivoIOS = esIOS();
    let eventoCapturado: BeforeInstallPromptEvent | null = null;
    const tieneValor = () =>
      localStorage.getItem(CLAVE_VALOR_PERCIBIDO) === "1";
    const puedeMostrarse = () =>
      !localStorage.getItem(CLAVE_DESCARTADO) &&
      (dispositivoIOS || eventoCapturado !== null);
    function mostrar() {
      if (!puedeMostrarse()) return;
      if (dispositivoIOS) {
        setInstalacionIOS(true);
        setVisible(true);
      } else if (eventoCapturado !== null) {
        setEvento(eventoCapturado);
        setVisible(true);
      }
    }
    // Perfil es una petición explícita. La confirmación de una venta es la
    // acción de valor que hace pertinente una sugerencia no invasiva.
    function mostrarDesdeMenu() {
      mostrar();
    }
    function alPercibirValor() {
      localStorage.setItem(CLAVE_VALOR_PERCIBIDO, "1");
      mostrar();
    }
    window.addEventListener("convenios:mostrar-instalacion", mostrarDesdeMenu);
    window.addEventListener("convenios:valor-percibido", alPercibirValor);

    // Safari no implementa beforeinstallprompt. La guía se ofrece solo por
    // petición desde Perfil o después de valor; nunca al abrir por primera vez.
    if (dispositivoIOS) {
      telemetria("elegible");
      anunciarElegibilidad();
      return () => {
        window.removeEventListener(
          "convenios:mostrar-instalacion",
          mostrarDesdeMenu,
        );
        window.removeEventListener(
          "convenios:valor-percibido",
          alPercibirValor,
        );
      };
    }

    function alCapturarPrompt(e: Event) {
      e.preventDefault();
      eventoCapturado = e as BeforeInstallPromptEvent;
      setEvento(eventoCapturado);
      telemetria("elegible");
      anunciarElegibilidad();
      if (tieneValor()) mostrar();
    }

    function alInstalar() {
      setVisible(false);
      localStorage.setItem(CLAVE_DESCARTADO, "1");
      registrarAceptacion();
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
      window.removeEventListener("convenios:valor-percibido", alPercibirValor);
    };
  }, []);

  if (hayModal || !visible || (!evento && !instalacionIOS)) {
    return null;
  }

  function descartar() {
    setVisible(false);
    localStorage.setItem(CLAVE_DESCARTADO, "1");
    telemetria("descartada");
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const decision = await evento.userChoice;
    setVisible(false);
    localStorage.setItem(CLAVE_DESCARTADO, "1");
    if (decision.outcome === "accepted") registrarAceptacion();
    else telemetria("descartada");
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
