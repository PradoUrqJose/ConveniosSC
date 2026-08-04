import { describe, expect, it } from "vitest";

import { calcularDescuento, formatearSoles, parsearSoles } from "./dinero";

describe("calcularDescuento", () => {
  const casos: Array<{
    bruto: number;
    bps: number;
    descuento: number;
    final: number;
  }> = [
    { bruto: 10000, bps: 1500, descuento: 1500, final: 8500 },
    { bruto: 3333, bps: 1500, descuento: 500, final: 2833 },
    { bruto: 1, bps: 1500, descuento: 0, final: 1 },
    { bruto: 10, bps: 1500, descuento: 2, final: 8 },
    { bruto: 99999999, bps: 10000, descuento: 99999999, final: 0 },
    { bruto: 12345, bps: 0, descuento: 0, final: 12345 },
  ];

  it.each(casos)(
    "bruto=$bruto bps=$bps → descuento=$descuento final=$final",
    ({ bruto, bps, descuento, final }) => {
      expect(calcularDescuento(bruto, bps)).toEqual({ descuento, final });
    },
  );
});

describe("parsearSoles", () => {
  it.each(["1234.5", "1,234.50", "1234,50"])(
    "%s → 123450 céntimos",
    (entrada) => {
      expect(parsearSoles(entrada)).toBe(123450);
    },
  );

  it("entero sin decimales", () => {
    expect(parsearSoles("50000")).toBe(5000000);
  });

  it("agrupación de miles sin decimales", () => {
    expect(parsearSoles("50,000")).toBe(5000000);
  });

  it("un solo céntimo", () => {
    expect(parsearSoles("0.01")).toBe(1);
  });

  it("lanza con texto inválido", () => {
    expect(() => parsearSoles("abc")).toThrow();
  });

  it("lanza con cadena vacía", () => {
    expect(() => parsearSoles("")).toThrow();
  });
});

describe("formatearSoles", () => {
  it("formatea con separador de miles y dos decimales", () => {
    expect(formatearSoles(123450)).toBe("S/ 1,234.50");
  });

  it("formatea céntimos exactos", () => {
    expect(formatearSoles(1)).toBe("S/ 0.01");
  });

  it("formatea cero", () => {
    expect(formatearSoles(0)).toBe("S/ 0.00");
  });
});
