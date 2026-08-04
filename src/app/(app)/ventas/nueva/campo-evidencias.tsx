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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Evidencia adicional</span>
        <span className="text-muted-foreground text-xs">
          {slots.length}/{MAX_EVIDENCIAS}
        </span>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Ej. foto del empleado con la compra.
      </p>

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
          className="self-start"
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      ) : null}
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
    <div className="flex items-center gap-3 rounded-xl border p-3">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Vista previa de la evidencia"
          className="size-14 shrink-0 rounded-lg border object-cover"
        />
      ) : (
        <div className="bg-muted flex size-14 shrink-0 items-center justify-center rounded-lg">
          <FileText className="text-muted-foreground size-5" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {datos ? (
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción (opcional)"
            maxLength={120}
            className="h-8 text-sm"
          />
        ) : (
          <div className="flex gap-2">
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
        <p className="text-muted-foreground truncate text-xs">
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
