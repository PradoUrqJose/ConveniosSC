"use client";

import { useId, useRef, type ReactNode } from "react";
import { Camera, ImagePlus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type CargadorArchivoVentaProps = {
  etiqueta: string;
  ocultarEtiqueta?: boolean;
  requerido?: boolean;
  indicador?: ReactNode;
  titulo: string;
  ayuda: string;
  accept: string;
  acceptCamara?: string;
  subiendo: boolean;
  onArchivo: (archivo: File) => unknown;
  children?: ReactNode;
};

/**
 * Presentación compartida de los cargadores de Nueva venta.
 *
 * Este componente solo resuelve interacción y layout: selección, cámara móvil
 * y arrastrar/soltar. La validación, compresión y subida pertenecen al
 * componente de negocio que recibe `onArchivo`.
 */
export function CargadorArchivoVenta({
  etiqueta,
  ocultarEtiqueta = false,
  requerido = false,
  indicador,
  titulo,
  ayuda,
  accept,
  acceptCamara = "image/jpeg,image/png,image/webp",
  subiendo,
  onArchivo,
  children,
}: CargadorArchivoVentaProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const entregarArchivo = (archivo: File | undefined) => {
    if (!archivo || subiendo) return;
    void onArchivo(archivo);
  };

  const abrirCamara = () => {
    const camara = document.createElement("input");
    camara.type = "file";
    camara.accept = acceptCamara;
    camara.capture = "environment";
    camara.onchange = () => entregarArchivo(camara.files?.[0]);
    camara.click();
  };

  return (
    <div
      data-slot="campo-archivo-venta"
      className="flex min-w-0 flex-col gap-2 lg:gap-[7px]"
    >
      <div className="flex min-h-5 items-center justify-between gap-3">
        <Label
          htmlFor={inputId}
          className={
            ocultarEtiqueta
              ? "sr-only"
              : "text-[13px] font-semibold text-[var(--venta-gris)]"
          }
        >
          {etiqueta}
          {requerido ? <span className="text-destructive"> *</span> : null}
        </Label>
        {indicador ? (
          <span className="shrink-0 text-[11px] whitespace-nowrap text-[var(--venta-gris-claro)]">
            {indicador}
          </span>
        ) : null}
      </div>

      <div
        data-slot="cargador-archivo-venta"
        onDragOver={(evento) => evento.preventDefault()}
        onDrop={(evento) => {
          evento.preventDefault();
          entregarArchivo(evento.dataTransfer.files[0]);
        }}
        className="flex min-h-[154px] min-w-0 items-center justify-center rounded-[22px] border-2 border-dashed border-[var(--venta-linea)] bg-[var(--venta-papel)] px-5 py-7 text-center transition hover:border-[var(--venta-azul-borde)] hover:bg-[var(--venta-azul-humo)] lg:h-[192px] lg:max-h-[192px] lg:min-h-[192px] lg:overflow-hidden"
      >
        {children ?? (
          <div className="flex max-w-[500px] flex-col items-center">
            <div className="mb-2.5 hidden size-[42px] place-items-center rounded-xl bg-[var(--venta-azul-humo)] text-[var(--venta-azul)] lg:grid">
              <Upload className="size-[21px]" />
            </div>
            <p className="hidden text-[15px] font-semibold lg:block">
              {titulo}
            </p>
            <p className="mb-3.5 text-[13px] text-[var(--venta-gris)] lg:mt-1">
              {ayuda}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row lg:justify-center">
              <Button
                type="button"
                disabled={subiendo}
                onClick={() => inputRef.current?.click()}
                className="rounded-full bg-[var(--venta-azul)] px-5 font-semibold text-white hover:bg-[var(--venta-azul-hondo)] lg:min-h-10"
              >
                <ImagePlus className="size-4 lg:size-[17px]" />
                Elegir archivo
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={subiendo}
                onClick={abrirCamara}
                className="rounded-full border-2 border-[var(--venta-linea)] font-semibold lg:hidden"
              >
                <Camera className="size-4" />
                Tomar foto
              </Button>
            </div>
          </div>
        )}

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(evento) => {
            entregarArchivo(evento.currentTarget.files?.[0]);
            evento.currentTarget.value = "";
          }}
        />
      </div>
    </div>
  );
}
