import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { get, head } from "@vercel/blob";

import {
  detectarTipoReal,
  mimePermitidoPara,
  validarRutaBlob,
  MAX_BYTES_ARCHIVO,
  type MimePermitido,
  type TipoAdjunto,
} from "./archivos";

/** Metadatos que el servidor calculó él mismo a partir de los bytes reales. */
export type ArchivoVerificado = {
  mime: MimePermitido;
  sizeBytes: number;
  sha256: string;
};

export type MotivoRechazo =
  "RUTA" | "NO_EXISTE" | "TIPO" | "TAMANIO" | "CONTENIDO";

export type ResultadoVerificacion =
  | { ok: true; data: ArchivoVerificado }
  | { ok: false; motivo: MotivoRechazo; mensaje: string };

/** Solo el respaldo de desarrollo de `subirArchivoLocal` escribe aquí. */
const RUTA_LOCAL = /^\/uploads\/[A-Za-z0-9._-]+$/;

function fallo(motivo: MotivoRechazo, mensaje: string): ResultadoVerificacion {
  return { ok: false, motivo, mensaje };
}

/**
 * Verificación server-side de un archivo ya subido (02 §8, P0-02).
 *
 * Nada de lo que declara el cliente se toma por bueno: el `mime`, el tamaño y
 * el `sha256` que se guardan en `adjuntos` salen de aquí, no del formulario.
 * Un `sha256` inventado rompería la detección de documentos reutilizados
 * (02 §11.d) y un `mime` inventado permitiría almacenar contenido arbitrario
 * bajo una extensión inofensiva.
 *
 * Secuencia contra Vercel Blob:
 *   1. la ruta tiene que seguir la convención de la clase de adjunto
 *   2. `head()` — existencia y metadatos del store (tamaño y content type)
 *   3. descarga del contenido con tope de bytes
 *   4. magic bytes: el tipo real debe coincidir con el declarado en el store
 *      y estar permitido para esa clase de adjunto
 *   5. sha256 sobre los bytes descargados
 */
export async function verificarArchivoSubido(
  blobPath: string,
  tipo: TipoAdjunto,
): Promise<ResultadoVerificacion> {
  if (RUTA_LOCAL.test(blobPath)) {
    return verificarArchivoLocal(blobPath, tipo);
  }

  if (!validarRutaBlob(blobPath, tipo)) {
    return fallo("RUTA", "La ruta del archivo no es válida.");
  }

  let metadatos;
  try {
    metadatos = await head(blobPath);
  } catch {
    return fallo(
      "NO_EXISTE",
      "No pudimos verificar la subida de uno de los archivos. Vuelve a adjuntarlo.",
    );
  }

  if (metadatos.size < 1 || metadatos.size > MAX_BYTES_ARCHIVO) {
    return fallo("TAMANIO", "El archivo debe pesar entre 1 byte y 10 MB.");
  }
  if (!mimePermitidoPara(metadatos.contentType, tipo)) {
    return fallo("TIPO", mensajeTipo(tipo));
  }

  let bytes: Uint8Array;
  try {
    const contenido = await get(blobPath, {
      access: "private",
      useCache: false,
    });
    if (!contenido || contenido.statusCode !== 200) {
      return fallo(
        "NO_EXISTE",
        "No pudimos leer uno de los archivos subidos. Vuelve a adjuntarlo.",
      );
    }
    const leidos = await leerConTope(contenido.stream, MAX_BYTES_ARCHIVO);
    if (leidos === null) {
      return fallo("TAMANIO", "El archivo debe pesar entre 1 byte y 10 MB.");
    }
    bytes = leidos;
  } catch {
    return fallo(
      "NO_EXISTE",
      "No pudimos leer uno de los archivos subidos. Vuelve a adjuntarlo.",
    );
  }

  // El `head` puede decir una cosa y el objeto pesar otra: manda el contenido.
  if (bytes.byteLength !== metadatos.size) {
    return fallo(
      "CONTENIDO",
      "El archivo subido no coincide con lo que se declaró. Vuelve a adjuntarlo.",
    );
  }

  return desdeBytes(bytes, tipo, metadatos.contentType);
}

/**
 * Respaldo local de desarrollo (`public/uploads/...`). En producción esa ruta
 * no existe: `subirArchivoLocal` está deshabilitada allí y aceptarla sería
 * dar por bueno un archivo servido como estático público.
 */
async function verificarArchivoLocal(
  blobPath: string,
  tipo: TipoAdjunto,
): Promise<ResultadoVerificacion> {
  if (process.env.NODE_ENV === "production") {
    return fallo("RUTA", "La ruta del archivo no es válida.");
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(
      path.join(process.cwd(), "public", ...blobPath.split("/")),
    );
  } catch {
    return fallo(
      "NO_EXISTE",
      "No pudimos verificar la subida de uno de los archivos. Vuelve a adjuntarlo.",
    );
  }
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES_ARCHIVO) {
    return fallo("TAMANIO", "El archivo debe pesar entre 1 byte y 10 MB.");
  }
  return desdeBytes(new Uint8Array(bytes), tipo, null);
}

/**
 * Deriva los metadatos de confianza a partir de los bytes. `mimeDeclarado` es
 * el del store, no el del formulario: si el objeto se guardó con un content
 * type que no corresponde a su contenido, el archivo se rechaza.
 */
function desdeBytes(
  bytes: Uint8Array,
  tipo: TipoAdjunto,
  mimeDeclarado: string | null,
): ResultadoVerificacion {
  const tipoReal = detectarTipoReal(bytes);
  if (!tipoReal || !mimePermitidoPara(tipoReal, tipo)) {
    return fallo("CONTENIDO", mensajeTipo(tipo));
  }
  if (mimeDeclarado !== null && tipoReal !== mimeDeclarado) {
    return fallo(
      "CONTENIDO",
      "El contenido de uno de los archivos no corresponde a su formato declarado.",
    );
  }
  return {
    ok: true,
    data: {
      mime: tipoReal as MimePermitido,
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

function mensajeTipo(tipo: TipoAdjunto): string {
  return tipo === "evidencia"
    ? "Las evidencias deben ser imágenes JPG, PNG o WebP."
    : "El documento debe ser una imagen JPG, PNG, WebP o un PDF.";
}

/**
 * Lee el stream acumulando como mucho `tope` bytes. Devuelve `null` si lo
 * supera: el tamaño que dice `head` no basta para decidir cuánta memoria se
 * está dispuesto a gastar.
 */
async function leerConTope(
  stream: ReadableStream<Uint8Array>,
  tope: number,
): Promise<Uint8Array | null> {
  const lector = stream.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > tope) {
        return null;
      }
      trozos.push(value);
    }
  } finally {
    await lector.cancel().catch(() => undefined);
  }
  const salida = new Uint8Array(total);
  let offset = 0;
  for (const trozo of trozos) {
    salida.set(trozo, offset);
    offset += trozo.byteLength;
  }
  return salida;
}
