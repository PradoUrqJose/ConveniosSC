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
 * uuid como marcador. `addRandomSuffix` de Vercel Blob añade un sufijo al
 * nombre antes de la extensión, así que el nombre se valida permisivo.
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const RUTA_POR_TIPO: Record<TipoAdjunto, RegExp> = {
  documento: new RegExp(
    `^ventas/${UUID}/documento/[^/]+\\.(jpg|jpeg|png|webp|pdf)$`,
    "i",
  ),
  // Las evidencias no admiten PDF (03 §7): son fotos del punto de venta.
  evidencia: new RegExp(
    `^ventas/${UUID}/evidencia/[^/]+\\.(jpg|jpeg|png|webp)$`,
    "i",
  ),
};

/**
 * Valida que el pathname propuesto siga las convenciones de ruta de 02 §8.
 * Con `tipo` se exige además que la carpeta y la extensión correspondan a esa
 * clase de adjunto; sin él basta con que encaje en alguna.
 */
export function validarRutaBlob(pathname: string, tipo?: TipoAdjunto): boolean {
  if (tipo) {
    return RUTA_POR_TIPO[tipo].test(pathname);
  }
  return Object.values(RUTA_POR_TIPO).some((patron) => patron.test(pathname));
}

/** Clase de adjunto que declara la ruta, o `null` si no es una ruta válida. */
export function tipoAdjuntoDeRuta(pathname: string): TipoAdjunto | null {
  for (const [tipo, patron] of Object.entries(RUTA_POR_TIPO)) {
    if (patron.test(pathname)) {
      return tipo as TipoAdjunto;
    }
  }
  return null;
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

/** Clases de adjunto de una venta (01 §7: `DOCUMENTO_VENTA` y `EVIDENCIA`). */
export type TipoAdjunto = "documento" | "evidencia";

/**
 * Qué MIME acepta cada clase de adjunto. El documento de la venta puede ser
 * una boleta en PDF; las evidencias son siempre imágenes (03 §7).
 */
export const MIMES_POR_TIPO: Record<TipoAdjunto, readonly MimePermitido[]> = {
  documento: MIME_PERMITIDOS,
  evidencia: ["image/jpeg", "image/png", "image/webp"],
};

export function mimePermitidoPara(mime: string, tipo: TipoAdjunto): boolean {
  return (MIMES_POR_TIPO[tipo] as readonly string[]).includes(mime);
}

/** Tope de tamaño de cualquier adjunto (02 §8): 10 MB. */
export const MAX_BYTES_ARCHIVO = 10_485_760;
