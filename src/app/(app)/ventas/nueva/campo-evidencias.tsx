"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, ImagePlus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useSubidaArchivo,
  type DatosSubida,
} from "@/app/(app)/empleados/campo-archivo";

export type EvidenciaItem = DatosSubida & { descripcion: string };

const MAX_EVIDENCIAS = 5;

/**
 * Evidencia adicional 0..5 (04 §4, `documento` es aparte y obligatorio).
 * Cada slot reutiliza `useSubidaArchivo` (mismo flujo de compresión, sha256
 * y subida que `<CampoArchivo>`) y solo acepta imágenes: las evidencias no
 * admiten PDF (03 §7).
 */
export function CampoEvidencias({
  onCambio,
}: {
  onCambio: (items: EvidenciaItem[]) => void;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const itemsRef = useRef<Record<string, EvidenciaItem | null>>({});

  const emitir = () => {
    onCambio(
      Object.values(itemsRef.current).filter(
        (v): v is EvidenciaItem => v !== null,
      ),
    );
  };

  const agregar = () => {
    if (slots.length >= MAX_EVIDENCIAS) return;
    setSlots((s) => [...s, crypto.randomUUID()]);
  };

  const quitar = (key: string) => {
    delete itemsRef.current[key];
    setSlots((s) => s.filter((k) => k !== key));
    emitir();
  };

  const actualizar = (key: string, item: EvidenciaItem | null) => {
    itemsRef.current[key] = item;
    emitir();
  };

  return (
    <div className="flex flex-col gap-3 lg:gap-0">
      <div className="flex items-start justify-between gap-3 lg:mb-3">
        <div className="min-w-0">
          <span className="block text-sm font-medium lg:text-[13px] lg:font-semibold lg:text-[#344054]">
            Evidencia adicional
          </span>
          {/* Solo escritorio: en la PWA el contador de la derecha ya lo explica. */}
          <p className="text-muted-foreground mt-1 hidden text-xs lg:block lg:text-[11px] lg:text-[#98a2b3]">
            Puedes adjuntar hasta 5 imágenes del empleado o la compra.
          </p>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap lg:text-[11px] lg:text-[#98a2b3]">
          {slots.length}/{MAX_EVIDENCIAS}
          <span className="hidden lg:inline"> archivos</span>
        </span>
      </div>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-5 lg:gap-2.5">
        {slots.map((key) => (
          <SlotEvidencia
            key={key}
            onDatos={(item) => actualizar(key, item)}
            onQuitar={() => quitar(key)}
          />
        ))}

        {slots.length < MAX_EVIDENCIAS ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={agregar}
            className="self-start lg:aspect-[1/0.8] lg:min-h-[86px] lg:w-full lg:rounded-xl lg:border-dashed lg:border-[#c7d1dd] lg:bg-[#fafbfc] lg:text-[#667085] lg:hover:border-[#0f62ad] lg:hover:bg-[#f5f9ff] lg:hover:text-[#0f62ad]"
          >
            <Plus className="size-4 lg:size-5" />
            Agregar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SlotEvidencia({
  onDatos,
  onQuitar,
}: {
  onDatos: (item: EvidenciaItem | null) => void;
  onQuitar: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { subiendo, progreso, datos, preview, error, procesar, eliminar } =
    useSubidaArchivo("evidencia");
  const [descripcion, setDescripcion] = useState("");

  useEffect(() => {
    onDatos(datos ? { ...datos, descripcion } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, descripcion]);

  const alEliminar = () => {
    eliminar();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onQuitar();
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border p-3 lg:relative lg:aspect-[1/0.8] lg:min-h-[86px] lg:flex-col lg:justify-center lg:overflow-hidden lg:p-2">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Vista previa de la evidencia"
          className="size-14 shrink-0 rounded-lg border object-cover lg:absolute lg:inset-0 lg:size-full lg:rounded-none"
        />
      ) : (
        <div className="bg-muted flex size-14 shrink-0 items-center justify-center rounded-lg lg:hidden">
          <FileText className="text-muted-foreground size-5" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:z-10 lg:w-full lg:items-center lg:rounded-md lg:bg-white/85 lg:p-1.5">
        {datos ? (
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción (opcional)"
            maxLength={120}
            className="h-8 text-sm lg:w-full lg:bg-white"
          />
        ) : (
          <div className="flex gap-2 lg:flex-col">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={subiendo}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="size-3.5" />
              Elegir
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={subiendo}
              onClick={() => {
                const camara = document.createElement("input");
                camara.type = "file";
                camara.accept = "image/jpeg,image/png,image/webp";
                camara.capture = "environment";
                camara.onchange = () => {
                  const f = camara.files?.[0];
                  if (f) void procesar(f);
                };
                camara.click();
              }}
            >
              <Camera className="size-3.5" />
              Foto
            </Button>
          </div>
        )}
        <p className="text-muted-foreground truncate text-xs lg:hidden">
          {subiendo
            ? progreso > 0
              ? `Subiendo… ${progreso}%`
              : "Comprimiendo…"
            : datos
              ? `${(datos.sizeBytes / 1024).toFixed(1)} KB · subido`
              : (error ?? "")}
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Quitar evidencia"
        onClick={alEliminar}
        disabled={subiendo}
        className="lg:absolute lg:top-1 lg:right-1 lg:z-20 lg:rounded-full lg:bg-white/90"
      >
        <Trash2 className="size-4" />
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void procesar(f);
        }}
      />
    </div>
  );
}
