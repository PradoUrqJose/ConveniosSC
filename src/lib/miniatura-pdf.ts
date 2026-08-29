/**
 * Miniatura de la primera página de un PDF.
 *
 * La CSP del proyecto fija `object-src 'none'` (`next.config.ts`), así que el
 * visor nativo de Chrome (`<embed>`/`<object>`) no se puede usar para
 * previsualizar. Se rasteriza la primera página con pdf.js y se devuelve un
 * object URL de imagen, que además funciona en móvil y se puede recortar con
 * `object-cover` igual que una foto.
 */
const ANCHO_MINIATURA = 480;

/** pdf.js pesa ~1 MB: se carga solo cuando de verdad hay un PDF que pintar. */
async function cargarPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
}

/**
 * Devuelve un object URL PNG con la primera página, o `null` si el PDF no se
 * pudo abrir (cifrado, corrupto). Quien lo llame debe revocarlo.
 *
 * Recibe el archivo y no una URL a propósito: la CSP fija
 * `connect-src 'self' https:`, así que pdf.js no puede hacer fetch de un
 * object URL `blob:` y falla con `ResponseException`. Con los bytes en mano no
 * hay petición que bloquear.
 */
export async function miniaturaPrimeraPagina(
  archivo: Blob,
): Promise<string | null> {
  try {
    const pdfjs = await cargarPdfJs();
    const datos = new Uint8Array(await archivo.arrayBuffer());
    const tarea = pdfjs.getDocument({
      data: datos,
      // Las 14 fuentes base (Helvetica, Times…) no vienen incrustadas en el
      // PDF: sin este directorio la página se rasteriza sin texto.
      standardFontDataUrl: "/pdfjs/standard_fonts/",
    });
    const documento = await tarea.promise;
    try {
      const pagina = await documento.getPage(1);
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({
        scale: ANCHO_MINIATURA / base.width,
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const contexto = canvas.getContext("2d");
      if (!contexto) return null;
      // Las páginas sin fondo propio son transparentes: el blanco evita que la
      // miniatura se vea como un recuadro vacío sobre el fondo del cargador.
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: contexto, canvas, viewport })
        .promise;
      const blob = await new Promise<Blob | null>((resolver) =>
        canvas.toBlob(resolver, "image/png"),
      );
      return blob ? URL.createObjectURL(blob) : null;
    } finally {
      // `destroy()` vive en la tarea de carga, no en el documento.
      void tarea.destroy();
    }
  } catch {
    return null;
  }
}
