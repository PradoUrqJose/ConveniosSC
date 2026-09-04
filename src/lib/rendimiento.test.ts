import { describe, expect, it } from "vitest";

import {
  ESQUEMA_RUM,
  esEventoRum,
  normalizarRutaRum,
  porcentajeMuestreo,
} from "./rendimiento";

describe("contrato RUM", () => {
  it("normaliza ids y nunca acepta query strings", () => {
    expect(normalizarRutaRum("/ventas/123")).toBe("/ventas/:id");
    expect(normalizarRutaRum("/ventas?dni=12345678")).toBeNull();
  });

  it("acepta sólo el esquema sin campos de negocio", () => {
    expect(
      esEventoRum({
        esquema: ESQUEMA_RUM,
        ruta: "/dashboard",
        rol: "ADMIN_EMPRESA",
        metrica: "LCP",
        valor: 2500,
        navegacion: "fria",
        dispositivo: "movil",
      }),
    ).toBe(true);
    expect(esEventoRum({ esquema: ESQUEMA_RUM, dni: "12345678" })).toBe(false);
  });

  it("limita el muestreo a un porcentaje válido", () => {
    expect(porcentajeMuestreo("2")).toBe(1);
    expect(porcentajeMuestreo("-1")).toBe(0);
    expect(porcentajeMuestreo("invalido")).toBe(0.1);
  });
});
