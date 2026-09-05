"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  Plus,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AdjuntoVenta } from "@/modules/ventas/query";

/**
 * Visor bajo demanda de evidencia. No recibe URLs firmadas ni bytes: cada
 * apertura pasa por la ruta autorizada de adjuntos, que emite su auditoría y
 * conserva la política `private, no-store` del archivo completo.
 */
export default function VisorAdjuntos({
  adjuntos,
  indiceInicial,
  alCerrar,
}: {
  adjuntos: AdjuntoVenta[];
  indiceInicial: number;
  alCerrar: () => void;
}) {
  const [indice, setIndice] = useState(indiceInicial);
  const [zoom, setZoom] = useState(1);
  const inicioX = useRef<number | null>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const adjunto = adjuntos[indice];
  const esPdf = adjunto?.mime === "application/pdf";

  const mover = useCallback(
    (delta: number) => {
      setIndice(
        (actual) => (actual + delta + adjuntos.length) % adjuntos.length,
      );
      setZoom(1);
    },
    [adjuntos.length],
  );

  useEffect(() => {
    dialogo.current?.focus();
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") alCerrar();
      if (evento.key === "ArrowLeft" && adjuntos.length > 1) mover(-1);
      if (evento.key === "ArrowRight" && adjuntos.length > 1) mover(1);
      if (evento.key === "+" || evento.key === "=")
        setZoom((actual) => Math.min(3, actual + 0.25));
      if (evento.key === "-") setZoom((actual) => Math.max(1, actual - 0.25));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [adjuntos.length, alCerrar, mover]);

  if (!adjunto) return null;
  const etiqueta =
    adjunto.descripcion ??
    (adjunto.tipo === "DOCUMENTO_VENTA" ? "Documento de venta" : "Evidencia");
  const fuente = `/api/adjuntos/${adjunto.id}`;

  return (
    <div
      ref={dialogo}
      role="dialog"
      aria-modal="true"
      aria-label={`Visor: ${etiqueta}`}
      tabIndex={-1}
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-slate-950 text-white"
      onTouchStart={(evento) => {
        inicioX.current = evento.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(evento) => {
        const inicio = inicioX.current;
        const fin = evento.changedTouches[0]?.clientX;
        inicioX.current = null;
        if (
          inicio !== null &&
          fin !== undefined &&
          Math.abs(fin - inicio) > 48 &&
          adjuntos.length > 1
        ) {
          mover(fin < inicio ? 1 : -1);
        }
      }}
    >
      <header className="flex min-h-14 items-center justify-between gap-2 px-3">
        <p className="min-w-0 truncate text-sm font-medium">
          {etiqueta}{" "}
          <span className="text-slate-400">
            {adjuntos.length > 1 ? `(${indice + 1}/${adjuntos.length})` : ""}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {!esPdf ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Alejar"
                onClick={() => setZoom((actual) => Math.max(1, actual - 0.25))}
              >
                <Minus />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Acercar"
                onClick={() => setZoom((actual) => Math.min(3, actual + 0.25))}
              >
                <Plus />
              </Button>
            </>
          ) : null}
          <a
            href={fuente}
            download
            className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Descargar archivo autorizado"
          >
            <Download className="size-4" />
          </a>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cerrar visor"
            onClick={alCerrar}
          >
            <X />
          </Button>
        </div>
      </header>
      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
        {adjuntos.length > 1 ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Archivo anterior"
            className="absolute left-2 z-10"
            onClick={() => mover(-1)}
          >
            <ChevronLeft />
          </Button>
        ) : null}
        {esPdf ? (
          <iframe
            title={etiqueta}
            src={fuente}
            className="h-full w-full max-w-5xl rounded bg-white"
          />
        ) : (
          // La URL completa se solicita sólo al abrir el visor; la miniatura no bloquea el detalle.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fuente}
            alt={etiqueta}
            className="max-h-full max-w-full object-contain transition-transform"
            style={{ transform: `scale(${zoom})` }}
          />
        )}
        {adjuntos.length > 1 ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Archivo siguiente"
            className="absolute right-2 z-10"
            onClick={() => mover(1)}
          >
            <ChevronRight />
          </Button>
        ) : null}
      </main>
      <p className="px-4 py-3 text-center text-xs text-slate-300">
        Desliza para cambiar de archivo · Escape para cerrar
      </p>
    </div>
  );
}
