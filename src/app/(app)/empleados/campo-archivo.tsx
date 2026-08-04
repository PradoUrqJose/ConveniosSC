"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { upload } from "@vercel/blob/client";
import { Camera, FileText, ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { subirArchivoLocal } from "@/modules/empleados/actions";
import type { Resultado } from "@/lib/tipos";
import type { MimePermitido } from "@/lib/archivos";

export type DatosSubida = {
  blobPath: string;
  sha256: string;
  mime: string;
  sizeBytes: number;
};

type EstadoVacio = Resultado<Record<string, never>>;

const ESTADO_VACIO: EstadoVacio = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

const MIME_IMAGEN: MimePermitido[] = ["image/jpeg", "image/png", "image/webp"];

export type TipoArchivo = "dni" | "documento" | "evidencia";

const CONVENCION: Record<TipoArchivo, (ext: string) => string> = {
  dni: (ext) =>
    `empleados/${crypto.randomUUID()}/dni/${crypto.randomUUID()}.${ext}`,
  documento: (ext) =>
    `ventas/${crypto.randomUUID()}/documento/${crypto.randomUUID()}.${ext}`,
  evidencia: (ext) =>
    `ventas/${crypto.randomUUID()}/evidencia/${crypto.randomUUID()}.${ext}`,
};

/**
 * Lógica compartida de selección, compresión, hash y subida a Blob (02 §8).
 * La usan tanto `<CampoArchivo>` (un solo archivo: DNI, documento de venta)
 * como `<CampoEvidencias>` (0..5 archivos), para no duplicar el flujo de
 * compresión/sha256/subida con fallback local de desarrollo.
 */
export function useSubidaArchivo(tipo: TipoArchivo) {
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [datos, setDatos] = useState<DatosSubida | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const procesar = async (file: File) => {
    setError(null);
    if (file.size < 1 || file.size > 10_485_760) {
      setError("El archivo debe pesar entre 1 byte y 10 MB.");
      return;
    }
    setSubiendo(true);
    setProgreso(0);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    try {
      const archivoFinal = await comprimir(file, setProgreso);
      const sha256 = await sha256Hex(archivoFinal);
      const ext = extensionDe(archivoFinal.type);
      const pathname = CONVENCION[tipo](ext);
      let blobPath: string;
      let mime: string;
      let sizeBytes: number;
      try {
        const blob = await upload(pathname, archivoFinal, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          contentType: archivoFinal.type,
          onUploadProgress: (evento) => {
            setProgreso(Math.round(evento.percentage));
          },
        });
        blobPath = blob.pathname;
        mime = archivoFinal.type;
        sizeBytes = archivoFinal.size;
      } catch (e) {
        const res = await subirArchivoLocal(
          ESTADO_VACIO,
          crearFormData(archivoFinal),
        );
        if (!res.ok) {
          throw new Error(res.mensaje);
        }
        blobPath = res.data.blobPath;
        mime = res.data.mime;
        sizeBytes = res.data.sizeBytes;
        void e;
      }
      const resultado = { blobPath, sha256, mime, sizeBytes };
      setDatos(resultado);
      return resultado;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo subir el archivo. Inténtalo de nuevo.",
      );
      return null;
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setDatos(null);
    setError(null);
  };

  return { subiendo, progreso, datos, preview, error, procesar, eliminar };
}

/**
 * `<CampoArchivo>` (05 §5): selección de foto (cámara/archivo), compresión
 * en cliente (02 §8: máx 1600 px y 1 MB), sha256 con Web Crypto, subida
 * directa a Vercel Blob vía `POST /api/blob/upload`, progreso, miniatura y
 * eliminación. Los datos quedan en hidden inputs con prefijo configurable.
 */
export function CampoArchivo({
  prefijo = "archivo",
  etiqueta = "Archivo",
  tipo,
  onEliminar,
  onCambio,
}: {
  prefijo?: string;
  etiqueta?: string;
  tipo: TipoArchivo;
  onEliminar?: () => void;
  /** Notifica al padre cuando la subida termina (o se elimina el archivo). */
  onCambio?: (datos: DatosSubida | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { subiendo, progreso, datos, preview, error, procesar, eliminar } =
    useSubidaArchivo(tipo);

  const alEliminar = () => {
    eliminar();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onEliminar?.();
    onCambio?.(null);
  };

  const alProcesar = async (file: File) => {
    const resultado = await procesar(file);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (resultado) {
      onCambio?.(resultado);
    }
  };

  const esImagen =
    datos !== null && MIME_IMAGEN.includes(datos.mime as MimePermitido);

  return (
    <div className="flex flex-col gap-3">
      {preview ? (
        <div className="flex items-center gap-3 rounded-xl border p-3">
          {esImagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Vista previa del archivo"
              className="size-16 rounded-lg border object-cover"
            />
          ) : (
            <div className="bg-muted flex size-16 items-center justify-center rounded-lg">
              <FileText className="text-muted-foreground size-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {datos ? datos.blobPath.split("/").pop() : "Procesando archivo…"}
            </p>
            <p className="text-muted-foreground text-xs">
              {subiendo
                ? progreso > 0
                  ? `Subiendo ${etiqueta.toLowerCase()}… ${progreso}%`
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
            aria-label="Eliminar archivo"
            onClick={alEliminar}
            disabled={subiendo}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={subiendo}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            Elegir archivo
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={subiendo}
            onClick={() => {
              const camara = document.createElement("input");
              camara.type = "file";
              camara.accept = "image/jpeg,image/png,image/webp";
              camara.capture = "environment";
              camara.onchange = () => {
                const f = camara.files?.[0];
                if (f) void alProcesar(f);
              };
              camara.click();
            }}
          >
            <Camera className="size-4" />
            Tomar foto
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void alProcesar(f);
        }}
      />

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {datos ? (
        <>
          <input
            type="hidden"
            name={`${prefijo}BlobPath`}
            value={datos.blobPath}
          />
          <input type="hidden" name={`${prefijo}Sha256`} value={datos.sha256} />
          <input type="hidden" name={`${prefijo}Mime`} value={datos.mime} />
          <input
            type="hidden"
            name={`${prefijo}SizeBytes`}
            value={String(datos.sizeBytes)}
          />
        </>
      ) : null}
    </div>
  );
}

export async function comprimir(
  file: File,
  onProgress: (n: number) => void,
): Promise<File> {
  if (file.type === "application/pdf") {
    onProgress(100);
    return file;
  }
  return imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/jpeg",
    onProgress: (n) => onProgress(Math.round(n)),
  });
}

export async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function extensionDe(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "jpg";
  }
}

function crearFormData(file: File): FormData {
  const fd = new FormData();
  fd.append("archivo", file);
  return fd;
}
