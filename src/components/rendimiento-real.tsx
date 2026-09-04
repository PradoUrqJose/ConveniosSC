"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

import {
  ESQUEMA_RUM,
  normalizarRutaRum,
  type NombreMetricaRum,
  type RolRum,
} from "@/lib/rendimiento";

const activo = process.env.NEXT_PUBLIC_RUM_ENABLED === "1";
const requiereConsentimiento =
  process.env.NEXT_PUBLIC_RUM_REQUIRES_CONSENT === "1";
const tasa = Number(process.env.NEXT_PUBLIC_RUM_SAMPLE_RATE ?? "0.1");

function tieneMuestra() {
  return Number.isFinite(tasa) && tasa > 0 && Math.random() < Math.min(tasa, 1);
}

function puedeMedir() {
  if (!activo || !tieneMuestra()) return false;
  return (
    !requiereConsentimiento ||
    window.localStorage.getItem("convenios-rum-consent") === "granted"
  );
}

function tipoDispositivo() {
  return window.matchMedia("(max-width: 767px)").matches
    ? "movil"
    : "escritorio";
}

function tipoNavegacion() {
  return performance.getEntriesByType("navigation").length > 0
    ? "fria"
    : "caliente";
}

/**
 * Frontera cliente mínima recomendada por Next para reportar Web Vitals.
 * El payload no contiene IDs, URL de recursos, texto, ni datos de negocio.
 */
export function RendimientoReal({ rol }: { rol: RolRum }) {
  const ruta = usePathname();
  const permitido = useRef(false);
  const inicioRuta = useRef(0);
  const rutaActual = useRef(ruta);

  useEffect(() => {
    rutaActual.current = ruta;
  }, [ruta]);

  useEffect(() => {
    permitido.current = puedeMedir();
  }, []);

  const publicar = useCallback(
    (metrica: NombreMetricaRum, valor: number) => {
      const rutaSegura = normalizarRutaRum(rutaActual.current);
      if (!permitido.current || !rutaSegura || !Number.isFinite(valor)) return;
      const cuerpo = JSON.stringify({
        esquema: ESQUEMA_RUM,
        ruta: rutaSegura,
        rol,
        metrica,
        valor: Number(valor.toFixed(2)),
        navegacion: tipoNavegacion(),
        dispositivo: tipoDispositivo(),
      });
      if (!navigator.sendBeacon?.("/api/rendimiento", cuerpo)) {
        void fetch("/api/rendimiento", {
          method: "POST",
          body: cuerpo,
          headers: { "content-type": "application/json" },
          keepalive: true,
        });
      }
    },
    [rol],
  );

  useReportWebVitals((metrica) => {
    if (["TTFB", "FCP", "LCP", "INP", "CLS"].includes(metrica.name)) {
      publicar(metrica.name as NombreMetricaRum, metrica.value);
    }
  });

  useEffect(() => {
    const inicio = performance.now();
    publicar("shell", inicio - inicioRuta.current);
    const frame = requestAnimationFrame(() =>
      publicar("datos", performance.now() - inicio),
    );
    inicioRuta.current = inicio;
    return () => cancelAnimationFrame(frame);
  }, [publicar, ruta]);

  useEffect(() => {
    const observer = new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries() as PerformanceResourceTiming[]) {
        const nombre = entrada.name;
        const metrica = nombre.includes("_next/static")
          ? "js"
          : nombre.includes("_rsc") || entrada.initiatorType === "fetch"
            ? "rsc"
            : nombre.includes("/api/")
              ? "api"
              : /\.(pdf|png|jpe?g|webp)(?:$|\?)/i.test(nombre)
                ? "adjunto"
                : null;
        if (metrica) publicar(metrica, entrada.duration);
      }
    });
    observer.observe({ type: "resource", buffered: true });
    return () => observer.disconnect();
  }, [publicar, ruta]);

  return null;
}
