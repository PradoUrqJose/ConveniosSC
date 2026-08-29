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
              : "lg:text-[13px] lg:font-semibold lg:text-[#344054]"
          }
        >
          {etiqueta}
          {requerido ? <span className="text-destructive"> *</span> : null}
        </Label>
        {indicador ? (
          <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap lg:text-[11px] lg:text-[#98a2b3]">
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
        className="flex min-h-[154px] min-w-0 items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-[#c8d2df] bg-gradient-to-b from-[rgba(247,250,253,0.8)] to-white p-5 text-center transition hover:border-[#0f62ad] hover:bg-[#f5f9ff] lg:h-[176px] lg:max-h-[176px] lg:min-h-[176px] lg:overflow-hidden"
      >
        {children ?? (
          <div className="flex max-w-[500px] flex-col items-center">
            <div className="mb-2.5 hidden size-[42px] place-items-center rounded-xl bg-[#eaf4ff] text-[#0f62ad] lg:grid">
              <Upload className="size-[21px]" />
            </div>
            <p className="hidden text-sm font-semibold text-[#172033] lg:block">
              {titulo}
            </p>
            <p className="text-muted-foreground mb-3.5 text-xs lg:mt-1 lg:text-[#98a2b3]">
              {ayuda}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row lg:justify-center">
              <Button
                type="button"
                disabled={subiendo}
                onClick={() => inputRef.current?.click()}
                className="lg:min-h-10 lg:rounded-[10px] lg:bg-[#0f62ad] lg:px-[15px] lg:shadow-[0_5px_12px_rgba(15,98,173,0.18)] lg:hover:bg-[#094d8c]"
              >
                <ImagePlus className="size-4 lg:size-[17px]" />
                Elegir archivo
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={subiendo}
                onClick={abrirCamara}
                className="lg:hidden"
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
