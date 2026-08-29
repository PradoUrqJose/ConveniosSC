import { describe, expect, it } from "vitest";

import { zDocumentoIdentidad } from "./zod";

describe("documento de identidad", () => {
  it.each([
    ["DNI", "12345678"],
    ["CARNET_EXTRANJERIA", "123456789"],
    ["CARNET_EXTRANJERIA", "N-123456789"],
  ] as const)("acepta %s válido: %s", (tipoDocumento, numeroDocumento) => {
    expect(
      zDocumentoIdentidad.parse({ tipoDocumento, numeroDocumento }),
    ).toEqual({ tipoDocumento, numeroDocumento });
  });

  it("normaliza el Carné de Extranjería antes de persistir o buscar", () => {
    expect(
      zDocumentoIdentidad.parse({
        tipoDocumento: "CARNET_EXTRANJERIA",
        numeroDocumento: " n-123456 ",
      }),
    ).toEqual({
      tipoDocumento: "CARNET_EXTRANJERIA",
      numeroDocumento: "N-123456",
    });
  });

  it.each([
    ["DNI", "1234567"],
    ["DNI", "A2345678"],
    ["CARNET_EXTRANJERIA", ""],
    ["CARNET_EXTRANJERIA", "-"],
    ["CARNET_EXTRANJERIA", "-123456"],
    ["CARNET_EXTRANJERIA", "1234567890123"],
    ["CARNET_EXTRANJERIA", "1234/567"],
  ] as const)("rechaza %s inválido: %s", (tipoDocumento, numeroDocumento) => {
    expect(
      zDocumentoIdentidad.safeParse({ tipoDocumento, numeroDocumento }).success,
    ).toBe(false);
  });

  it("permite el mismo número bajo tipos distintos", () => {
    const dni = zDocumentoIdentidad.parse({
      tipoDocumento: "DNI",
      numeroDocumento: "12345678",
    });
    const ce = zDocumentoIdentidad.parse({
      tipoDocumento: "CARNET_EXTRANJERIA",
      numeroDocumento: "12345678",
    });

    expect(dni.tipoDocumento).not.toBe(ce.tipoDocumento);
    expect(dni.numeroDocumento).toBe(ce.numeroDocumento);
  });
});
