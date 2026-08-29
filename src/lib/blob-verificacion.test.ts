import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const head = vi.fn();
const get = vi.fn();

vi.mock("@vercel/blob", () => ({
  head: (...args: unknown[]) => head(...args),
  get: (...args: unknown[]) => get(...args),
}));

const { verificarArchivoSubido } = await import("./blob-verificacion");

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(64, 7),
]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(64, 7)]);
const EXE = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(64, 7)]);

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

function ruta(tipo: "documento" | "evidencia", ext = "jpg"): string {
  return `ventas/${randomUUID()}/${tipo}/${randomUUID()}.${ext}`;
}

/** `head` + `get` coherentes: el store devuelve exactamente esos bytes. */
function blobEn(pathname: string, bytes: Buffer, contentType: string) {
  head.mockResolvedValue({ pathname, size: bytes.byteLength, contentType });
  get.mockResolvedValue({
    statusCode: 200,
    stream: new ReadableStream<Uint8Array>({
      start(controlador) {
        controlador.enqueue(new Uint8Array(bytes));
        controlador.close();
      },
    }),
  });
}

beforeEach(() => {
  head.mockReset();
  get.mockReset();
});

describe("verificarArchivoSubido — Vercel Blob", () => {
  it("devuelve mime, tamaño y sha256 calculados sobre los bytes reales", async () => {
    const p = ruta("documento");
    blobEn(p, JPEG, "image/jpeg");

    const res = await verificarArchivoSubido(p, "documento");

    expect(res).toEqual({
      ok: true,
      data: {
        mime: "image/jpeg",
        sizeBytes: JPEG.byteLength,
        sha256: sha256(JPEG),
      },
    });
  });

  it("acepta un PDF como documento de venta", async () => {
    const p = ruta("documento", "pdf");
    blobEn(p, PDF, "application/pdf");

    const res = await verificarArchivoSubido(p, "documento");
    expect(res.ok).toBe(true);
  });

  it("rechaza un PDF como evidencia (03 §7)", async () => {
    const p = `ventas/${randomUUID()}/evidencia/${randomUUID()}.pdf`;
    blobEn(p, PDF, "application/pdf");

    const res = await verificarArchivoSubido(p, "evidencia");
    expect(res).toMatchObject({ ok: false, motivo: "RUTA" });
    expect(head).not.toHaveBeenCalled();
  });

  it("rechaza contenido que no corresponde al content type del store", async () => {
    const p = ruta("documento");
    blobEn(p, EXE, "image/jpeg");

    const res = await verificarArchivoSubido(p, "documento");
    expect(res).toMatchObject({ ok: false, motivo: "CONTENIDO" });
  });

  it("rechaza un content type no permitido sin llegar a descargar", async () => {
    const p = ruta("documento");
    head.mockResolvedValue({
      pathname: p,
      size: 10,
      contentType: "text/html",
    });

    const res = await verificarArchivoSubido(p, "documento");
    expect(res).toMatchObject({ ok: false, motivo: "TIPO" });
    expect(get).not.toHaveBeenCalled();
  });

  it("rechaza un blob que pesa más de 10 MB", async () => {
    const p = ruta("documento");
    head.mockResolvedValue({
      pathname: p,
      size: 10_485_761,
      contentType: "image/jpeg",
    });

    const res = await verificarArchivoSubido(p, "documento");
    expect(res).toMatchObject({ ok: false, motivo: "TAMANIO" });
  });

  it("rechaza un blob cuyo contenido no pesa lo que dice el head", async () => {
    const p = ruta("documento");
    head.mockResolvedValue({
      pathname: p,
      size: JPEG.byteLength + 1,
      contentType: "image/jpeg",
    });
    get.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream<Uint8Array>({
        start(controlador) {
          controlador.enqueue(new Uint8Array(JPEG));
          controlador.close();
        },
      }),
    });

    const res = await verificarArchivoSubido(p, "documento");
    expect(res).toMatchObject({ ok: false, motivo: "CONTENIDO" });
  });

  it("rechaza un blob inexistente", async () => {
    const p = ruta("documento");
    head.mockRejectedValue(new Error("BlobNotFoundError"));

    const res = await verificarArchivoSubido(p, "documento");
    expect(res).toMatchObject({ ok: false, motivo: "NO_EXISTE" });
  });

  it("rechaza una ruta fuera de la convención sin consultar el store", async () => {
    const res = await verificarArchivoSubido(
      "empleados/x/dni/foto.jpg",
      "documento",
    );
    expect(res).toMatchObject({ ok: false, motivo: "RUTA" });
    expect(head).not.toHaveBeenCalled();
  });
});

describe("verificarArchivoSubido — respaldo local de desarrollo", () => {
  const escritos: string[] = [];

  afterEach(async () => {
    while (escritos.length > 0) {
      const archivo = escritos.pop();
      if (archivo) await rm(archivo, { force: true });
    }
  });

  async function escribir(bytes: Buffer): Promise<string> {
    const nombre = `test-verificacion-${randomUUID()}.jpg`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const absoluto = path.join(dir, nombre);
    await writeFile(absoluto, bytes);
    escritos.push(absoluto);
    return `/uploads/${nombre}`;
  }

  it("calcula los metadatos leyendo el archivo del disco", async () => {
    const p = await escribir(JPEG);

    const res = await verificarArchivoSubido(p, "documento");

    expect(res).toEqual({
      ok: true,
      data: {
        mime: "image/jpeg",
        sizeBytes: JPEG.byteLength,
        sha256: sha256(JPEG),
      },
    });
  });

  it("rechaza un ejecutable renombrado a .jpg", async () => {
    const p = await escribir(EXE);

    const res = await verificarArchivoSubido(p, "documento");
    expect(res).toMatchObject({ ok: false, motivo: "CONTENIDO" });
  });

  it("rechaza un archivo que no existe", async () => {
    const res = await verificarArchivoSubido(
      `/uploads/no-existe-${randomUUID()}.jpg`,
      "documento",
    );
    expect(res).toMatchObject({ ok: false, motivo: "NO_EXISTE" });
  });

  it("no acepta rutas con salto de directorio", async () => {
    const res = await verificarArchivoSubido(
      "/uploads/../../etc/passwd",
      "documento",
    );
    expect(res).toMatchObject({ ok: false, motivo: "RUTA" });
  });
});
