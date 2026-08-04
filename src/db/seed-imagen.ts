import { deflateSync } from "node:zlib";

/**
 * Generador de PNG mínimo para el seed. Evita meter binarios de ejemplo en el
 * repositorio y deja claro, al verlos, que son marcadores de posición: un
 * rectángulo liso con una banda superior más oscura, como un comprobante
 * genérico. No dibuja texto: haría falta rasterizar una fuente y no aporta.
 */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Buffer): number {
  let c = 0xffffffff;
  for (const byte of datos) {
    c = TABLA_CRC[(c ^ byte) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo: string, datos: Buffer): Buffer {
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([longitud, cuerpo, crc]);
}

export type ColorRgb = [number, number, number];

/**
 * PNG RGB de `ancho`×`alto` con el fondo `fondo` y una banda superior `banda`
 * que ocupa la sexta parte de la altura.
 */
export function pngMarcador(
  ancho: number,
  alto: number,
  fondo: ColorRgb,
  banda: ColorRgb,
): Buffer {
  // Cada fila lleva un byte de filtro (0 = None) delante de los píxeles.
  const filas: Buffer[] = [];
  const alturaBanda = Math.max(1, Math.floor(alto / 6));
  for (let y = 0; y < alto; y++) {
    const color = y < alturaBanda ? banda : fondo;
    const fila = Buffer.alloc(1 + ancho * 3);
    for (let x = 0; x < ancho; x++) {
      const off = 1 + x * 3;
      fila[off] = color[0];
      fila[off + 1] = color[1];
      fila[off + 2] = color[2];
    }
    filas.push(fila);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0; // compresión deflate
  ihdr[11] = 0; // filtro adaptativo
  ihdr[12] = 0; // sin entrelazado

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(Buffer.concat(filas), { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}
