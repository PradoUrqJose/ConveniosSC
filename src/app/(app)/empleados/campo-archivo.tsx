"use client";

import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { upload } from "@vercel/blob/client";
import { Camera, FileText, ImagePlus, Trash2 } from "lucide-react";

import { CargadorArchivoVenta } from "@/components/cargador-archivo-venta";
import { Button } from "@/components/ui/button";
import { subirArchivoLocal } from "@/modules/empleados/actions";
import type { Resultado } from "@/lib/tipos";
import type { MimePermitido } from "@/lib/archivos";
import { miniaturaPrimeraPagina } from "@/lib/miniatura-pdf";

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

export type TipoArchivo = "documento" | "evidencia";

const CONVENCION: Record<TipoArchivo, (ext: string) => string> = {
  documento: (ext) =>
    `ventas/${crypto.randomUUID()}/documento/${crypto.randomUUID()}.${ext}`,
  evidencia: (ext) =>
    `ventas/${crypto.randomUUID()}/evidencia/${crypto.randomUUID()}.${ext}`,
};

/**
 * Lógica compartida de selección, compresión, hash y subida a Blob (02 §8).
 * La usan tanto `<CampoArchivo>` (documento de venta) como
 * `<CampoEvidencias>` (0..5 archivos), para no duplicar el flujo de
 * compresión/sha256/subida con fallback local de desarrollo.
 */
export function useSubidaArchivo(tipo: TipoArchivo) {
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [datos, setDatos] = useState<DatosSubida | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  // Se conserva el File original: la miniatura de PDF necesita los bytes, no
  // el object URL (ver `miniatura-pdf.ts`).
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

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
    setPreviewMime(file.type);
    setArchivo(file);
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
    setPreview(null);
    setPreviewMime(null);
    setArchivo(null);
    setDatos(null);
    setError(null);
  };

  return {
    subiendo,
    progreso,
    datos,
    preview,
    previewMime,
    archivo,
    error,
    procesar,
    eliminar,
  };
}

/**
 * `<CampoArchivo>` (05 §5): selección de archivo y, solo en móvil, cámara;
 * compresión
 * en cliente (02 §8: máx 1600 px y 1 MB), sha256 con Web Crypto, subida
 * directa a Vercel Blob vía `POST /api/blob/upload`, progreso, miniatura y
 * eliminación. Los datos quedan en hidden inputs con prefijo configurable.
 */
export function CampoArchivo({
  prefijo = "archivo",
  etiqueta = "Archivo",
  tipo,
  variante = "predeterminada",
  onEliminar,
  onCambio,
}: {
  prefijo?: string;
  etiqueta?: string;
  tipo: TipoArchivo;
  variante?: "predeterminada" | "venta";
  onEliminar?: () => void;
  /** Notifica al padre cuando la subida termina (o se elimina el archivo). */
  onCambio?: (datos: DatosSubida | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    subiendo,
    progreso,
    datos,
    preview,
    previewMime,
    archivo,
    error,
    procesar,
    eliminar,
  } = useSubidaArchivo(tipo);

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
    previewMime !== null && MIME_IMAGEN.includes(previewMime as MimePermitido);
  const esPdf = previewMime === "application/pdf";

  if (variante === "venta") {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <CargadorArchivoVenta
          etiqueta="Documento de venta"
          requerido
          titulo="Arrastra el comprobante aquí"
          ayuda="Formatos JPG, PNG o PDF. Tamaño máximo de 10 MB."
          accept="image/jpeg,image/png,image/webp,application/pdf"
          subiendo={subiendo}
          onArchivo={alProcesar}
        >
          {preview ? (
            <div className="flex h-full w-full min-w-0 items-center gap-3 overflow-hidden rounded-[18px] border-2 border-[var(--venta-azul-borde)] bg-[var(--venta-azul-humo)] p-3 text-left lg:p-2">
              <VistaPreviaArchivo
                preview={preview}
                esImagen={esImagen}
                archivoPdf={esPdf ? archivo : null}
                alt="Vista previa del documento de venta"
                claseImagen="size-16 shrink-0 rounded-lg border object-cover lg:h-full lg:w-[42%] lg:max-w-52"
                claseCaja="bg-background flex size-16 shrink-0 items-center justify-center rounded-lg border lg:h-full lg:w-[36%] lg:max-w-40"
                claseIcono="text-primary size-6 lg:size-10"
              />
              <div className="min-w-0 flex-1">
                <p className="max-w-full truncate text-sm font-semibold">
                  {textoArchivoCargado(datos)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
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
                className="text-[var(--venta-gris-claro)] hover:bg-white hover:text-[var(--destructive)] lg:size-7 lg:rounded-md"
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
        {datos ? <InputsArchivo prefijo={prefijo} datos={datos} /> : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {preview ? (
        <div className="flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border p-3">
          <VistaPreviaArchivo
            preview={preview}
            esImagen={esImagen}
            archivoPdf={esPdf ? archivo : null}
            alt="Vista previa del archivo"
            claseImagen="size-16 shrink-0 rounded-lg border object-cover"
            claseCaja="bg-muted flex size-16 items-center justify-center rounded-lg"
            claseIcono="text-muted-foreground size-6"
          />
          <div className="min-w-0 flex-1">
            <p className="max-w-full truncate text-sm font-medium">
              {textoArchivoCargado(datos)}
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

      {datos ? <InputsArchivo prefijo={prefijo} datos={datos} /> : null}
    </div>
  );
}

/**
 * Miniatura del archivo cargado. Las imágenes usan el object URL directo; de
 * los PDF se rasteriza la primera página con pdf.js (ver `miniatura-pdf.ts`:
 * la CSP prohíbe el visor nativo), así que ambos casos terminan en un `<img>`
 * con el mismo encuadre. Mientras se rasteriza —o si el PDF no se puede
 * abrir— se muestra el ícono.
 */
function VistaPreviaArchivo({
  preview,
  esImagen,
  archivoPdf,
  alt,
  claseImagen,
  claseCaja,
  claseIcono,
}: {
  preview: string;
  esImagen: boolean;
  archivoPdf: Blob | null;
  alt: string;
  claseImagen: string;
  claseCaja: string;
  claseIcono: string;
}) {
  const miniaturaPdf = useMiniaturaPdf(archivoPdf);
  const fuente = esImagen ? preview : miniaturaPdf;

  if (fuente) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fuente}
        alt={alt}
        // Una página es mucho más alta que la caja: anclar el recorte arriba
        // muestra el encabezado del comprobante y no una franja vacía del
        // centro. Las fotos se siguen recortando centradas.
        className={miniaturaPdf ? `${claseImagen} object-top` : claseImagen}
      />
    );
  }

  return (
    <div className={claseCaja}>
      <FileText className={claseIcono} />
    </div>
  );
}

/** Rasteriza el PDF `archivo` y limpia el object URL que genera. */
function useMiniaturaPdf(archivo: Blob | null) {
  const [miniatura, setMiniatura] = useState<string | null>(null);

  useEffect(() => {
    if (!archivo) return;
    let vigente = true;
    let generada: string | null = null;
    void miniaturaPrimeraPagina(archivo).then((url) => {
      if (!url) return;
      // Si el archivo cambió mientras se rasterizaba, esta miniatura ya no sirve.
      if (!vigente) {
        URL.revokeObjectURL(url);
        return;
      }
      generada = url;
      setMiniatura(url);
    });
    return () => {
      vigente = false;
      setMiniatura(null);
      if (generada) URL.revokeObjectURL(generada);
    };
  }, [archivo]);

  // Sin archivo la miniatura anterior ya no aplica, aunque su limpieza aún no corra.
  return archivo ? miniatura : null;
}

/** El pathname contiene IDs internos y no es un nombre útil para la persona usuaria. */
function textoArchivoCargado(datos: DatosSubida | null) {
  return datos ? "Archivo cargado" : "Procesando archivo…";
}

function InputsArchivo({
  prefijo,
  datos,
}: {
  prefijo: string;
  datos: DatosSubida;
}) {
  return (
    <>
      <input type="hidden" name={`${prefijo}BlobPath`} value={datos.blobPath} />
      <input type="hidden" name={`${prefijo}Sha256`} value={datos.sha256} />
      <input type="hidden" name={`${prefijo}Mime`} value={datos.mime} />
      <input
        type="hidden"
        name={`${prefijo}SizeBytes`}
        value={String(datos.sizeBytes)}
      />
    </>
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
