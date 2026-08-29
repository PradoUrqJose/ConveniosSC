"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { CargadorArchivoVenta } from "@/components/cargador-archivo-venta";
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
  const [slots, setSlots] = useState<string[]>(["evidencia-principal"]);
  const [cantidad, setCantidad] = useState(0);
  const itemsRef = useRef<Record<string, EvidenciaItem | null>>({});

  const emitir = () => {
    const items = Object.values(itemsRef.current).filter(
      (v): v is EvidenciaItem => v !== null,
    );
    setCantidad(items.length);
    onCambio(items);
  };

  const agregar = () => {
    if (slots.length >= MAX_EVIDENCIAS) return;
    setSlots((s) => [...s, crypto.randomUUID()]);
  };

  const quitar = (key: string) => {
    delete itemsRef.current[key];
    setSlots((s) => {
      const restantes = s.filter((k) => k !== key);
      return restantes.length > 0
        ? restantes
        : [`evidencia-${crypto.randomUUID()}`];
    });
    emitir();
  };

  const actualizar = (key: string, item: EvidenciaItem | null) => {
    itemsRef.current[key] = item;
    emitir();
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        className={
          slots.length > 1 ? "grid gap-2.5 lg:grid-cols-2" : "grid gap-2.5"
        }
      >
        {slots.map((key, indice) => (
          <SlotEvidencia
            key={key}
            compacto={slots.length > 1}
            mostrarEtiqueta={indice === 0}
            numero={indice + 1}
            indicador={`${cantidad}/${MAX_EVIDENCIAS} archivos`}
            onDatos={(item) => actualizar(key, item)}
            onQuitar={() => quitar(key)}
          />
        ))}
      </div>

      {cantidad === slots.length && slots.length < MAX_EVIDENCIAS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={agregar}
          className="self-start rounded-full font-semibold text-[var(--venta-azul)] lg:self-center"
        >
          <Plus className="size-4" />
          Agregar otra evidencia
        </Button>
      ) : null}
    </div>
  );
}

function SlotEvidencia({
  compacto,
  mostrarEtiqueta,
  numero,
  indicador,
  onDatos,
  onQuitar,
}: {
  compacto: boolean;
  mostrarEtiqueta: boolean;
  numero: number;
  indicador: string;
  onDatos: (item: EvidenciaItem | null) => void;
  onQuitar: () => void;
}) {
  const { subiendo, progreso, datos, preview, error, procesar, eliminar } =
    useSubidaArchivo("evidencia");
  const [descripcion, setDescripcion] = useState("");

  useEffect(() => {
    onDatos(datos ? { ...datos, descripcion } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, descripcion]);

  const alEliminar = () => {
    eliminar();
    onQuitar();
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <CargadorArchivoVenta
        etiqueta={
          mostrarEtiqueta ? "Evidencia adicional" : `Evidencia ${numero}`
        }
        ocultarEtiqueta={!mostrarEtiqueta}
        indicador={mostrarEtiqueta ? indicador : undefined}
        titulo={compacto ? "Añade otra imagen" : "Arrastra la evidencia aquí"}
        ayuda="Formatos JPG, PNG o WEBP. Tamaño máximo de 10 MB."
        accept="image/jpeg,image/png,image/webp"
        subiendo={subiendo}
        onArchivo={procesar}
      >
        {preview ? (
          <div className="relative flex w-full min-w-0 items-center gap-3 rounded-[18px] border-2 border-[var(--venta-azul-borde)] bg-[var(--venta-azul-humo)] p-3 text-left lg:max-w-[500px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Vista previa de la evidencia"
              className="size-14 shrink-0 rounded-lg border object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {datos ? (
                <Input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción (opcional)"
                  maxLength={120}
                  className="h-8 bg-white text-sm"
                />
              ) : null}
              <p className="text-muted-foreground max-w-full truncate text-xs">
                {subiendo
                  ? progreso > 0
                    ? `Subiendo… ${progreso}%`
                    : "Comprimiendo…"
                  : datos
                    ? `${(datos.sizeBytes / 1024).toFixed(1)} KB · subido`
                    : ""}
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
          </div>
        ) : undefined}
      </CargadorArchivoVenta>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
