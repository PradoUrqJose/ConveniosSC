import { describe, expect, it } from "vitest";

import { detectarTipoReal, validarTipoReal } from "./archivos";

function desdeHex(hex: string): Uint8Array {
  return new Uint8Array(
    hex
      .replace(/\s/g, "")
      .match(/.{2}/g)!
      .map((byte) => parseInt(byte, 16)),
  );
}

describe("detectarTipoReal", () => {
  it("detecta JPEG por FF D8 FF", () => {
    const buf = desdeHex("FF D8 FF E0 00 10 4A 46 49 46 00");
    expect(detectarTipoReal(buf)).toBe("image/jpeg");
  });

  it("detecta PNG por su firma completa", () => {
    const buf = desdeHex("89 50 4E 47 0D 0A 1A 0A 00 00 00 0D");
    expect(detectarTipoReal(buf)).toBe("image/png");
  });

  it("detecta WebP por RIFF + WEBP", () => {
    const buf = desdeHex("52 49 46 46 24 00 00 00 57 45 42 50");
    expect(detectarTipoReal(buf)).toBe("image/webp");
  });

  it("detecta PDF por %PDF-", () => {
    const buf = desdeHex("25 50 44 46 2D 31 2E 37");
    expect(detectarTipoReal(buf)).toBe("application/pdf");
  });

  it("devuelve null para un ejecutable renombrado (MZ)", () => {
    const buf = desdeHex("4D 5A 90 00 03 00 00 00");
    expect(detectarTipoReal(buf)).toBeNull();
  });

  it("devuelve null para un buffer vacío o corto", () => {
    expect(detectarTipoReal(new Uint8Array(0))).toBeNull();
    expect(detectarTipoReal(new Uint8Array([0xff]))).toBeNull();
  });
});

describe("validarTipoReal", () => {
  it("acepta un .jpg real como image/jpeg", () => {
    const buf = desdeHex("FF D8 FF E0");
    expect(validarTipoReal(buf, "image/jpeg")).toBe(true);
  });

  it("rechaza un .exe renombrado a .jpg", () => {
    const buf = desdeHex("4D 5A 90 00 03 00 00 00");
    expect(validarTipoReal(buf, "image/jpeg")).toBe(false);
  });

  it("rechaza un PNG declarado como PDF", () => {
    const buf = desdeHex("89 50 4E 47 0D 0A 1A 0A");
    expect(validarTipoReal(buf, "application/pdf")).toBe(false);
  });
});
