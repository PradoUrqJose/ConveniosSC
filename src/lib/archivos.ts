/**
 * Validación server-side del tipo real de un archivo por magic bytes
 * (02 §8). No se confía en la extensión ni en el Content-Type declarado.
 */
const FIRMAS: { mime: string; evaluar: (b: Uint8Array) => boolean }[] = [
  {
    mime: "image/jpeg",
    evaluar: (b) =>
      b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    evaluar: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    evaluar: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 && // "RIFF"
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 && // "WEBP"
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    mime: "application/pdf",
    evaluar: (b) =>
      b.length >= 5 &&
      b[0] === 0x25 && // "%PDF-"
      b[1] === 0x50 &&
      b[2] === 0x44 &&
      b[3] === 0x46 &&
      b[4] === 0x2d,
  },
];

/** Devuelve el MIME real del archivo según sus primeros bytes, o `null`. */
export function detectarTipoReal(buffer: Uint8Array): string | null {
  for (const firma of FIRMAS) {
    if (firma.evaluar(buffer)) {
      return firma.mime;
    }
  }
  return null;
}

/**
 * Comprueba que el tipo real del buffer coincida con el declarado.
 * Rechaza por ejemplo un `.exe` renombrado a `.jpg`.
 */
export function validarTipoReal(
  buffer: Uint8Array,
  mimeDeclarado: string,
): boolean {
  return detectarTipoReal(buffer) === mimeDeclarado;
}

/**
 * Convenciones de ruta de blob de 02 §8:
 *   ventas/{ventaId}/documento/{uuid}.{ext}
 *   ventas/{ventaId}/evidencia/{orden}-{uuid}.jpg
 * El primer segmento identifica la entidad; los IDs reales aún no existen al
 * subir (la fila en `adjuntos` se crea al guardar), por eso se acepta cualquier
 * uuid como marcador.
 */
const RUTA_BLOB =
  /^ventas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(documento|evidencia)\/[^/]+\.(jpg|png|webp|pdf)$/i;

/** Valida que el pathname propuesto siga las convenciones de ruta de 02 §8. */
export function validarRutaBlob(pathname: string): boolean {
  return RUTA_BLOB.test(pathname);
}

export const MIME_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type MimePermitido = (typeof MIME_PERMITIDOS)[number];

export function esMimePermitido(mime: string): mime is MimePermitido {
  return MIME_PERMITIDOS.includes(mime as MimePermitido);
}
