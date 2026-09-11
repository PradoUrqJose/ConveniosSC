import { describe, expect, it } from "vitest";

import {
  TONOS_PERSONA,
  fechaCortaVenta,
  formatearPorcentaje,
  tonoPersona,
  tramoDescuento,
} from "@/lib/presentacion-venta";

describe("tonoPersona", () => {
  it("es estable: la misma clave siempre da el mismo tono", () => {
    expect(tonoPersona("73452211")).toBe(tonoPersona("73452211"));
  });

  it("siempre devuelve un tono de la paleta", () => {
    for (const clave of ["", "1", "40000011", "CE-99887766", "ñandú"]) {
      expect(TONOS_PERSONA).toContain(tonoPersona(clave));
    }
  });

  it("reparte documentos distintos entre varios tonos", () => {
    const tonos = new Set(
      Array.from({ length: 60 }, (_, i) => tonoPersona(`7345${1000 + i}`)),
    );
    expect(tonos.size).toBeGreaterThan(3);
  });
});

describe("tramoDescuento", () => {
  it("clasifica en los bordes de cada tramo", () => {
    expect(tramoDescuento(0)).toBe("baja");
    expect(tramoDescuento(1000)).toBe("baja");
    expect(tramoDescuento(1001)).toBe("media");
    expect(tramoDescuento(2000)).toBe("media");
    expect(tramoDescuento(2001)).toBe("alta");
  });
});

describe("formatearPorcentaje", () => {
  it("omite decimales que sobran y conserva los que importan", () => {
    expect(formatearPorcentaje(1000)).toBe("10%");
    expect(formatearPorcentaje(1250)).toBe("12.5%");
    expect(formatearPorcentaje(333)).toBe("3.3%");
  });
});

describe("fechaCortaVenta", () => {
  it("omite el año cuando es el de hoy", () => {
    expect(fechaCortaVenta("2026-08-18", "2026-09-10")).toBe("18 ago");
    expect(fechaCortaVenta("2026-01-05", "2026-09-10")).toBe("5 ene");
  });

  it("usa las abreviaturas de Perú", () => {
    expect(fechaCortaVenta("2026-09-01", "2026-09-10")).toBe("1 set");
  });

  it("agrega el año cuando no es el de hoy", () => {
    expect(fechaCortaVenta("2025-12-31", "2026-01-02")).toBe("31 dic 2025");
  });
});
