import { describe, expect, it } from "vitest";

import { capitalizarNombre } from "./utils";

describe("capitalizarNombre", () => {
  it("capitaliza cada palabra de un nombre en mayúsculas", () => {
    expect(capitalizarNombre("JUAN PEREZ")).toBe("Juan Perez");
  });

  it("capitaliza un nombre en minúsculas", () => {
    expect(capitalizarNombre("maria rodriguez")).toBe("Maria Rodriguez");
  });

  it("mantiene en minúscula los conectores comunes salvo al inicio", () => {
    expect(capitalizarNombre("juan de la cruz")).toBe("Juan de la Cruz");
  });

  it("respeta acentos y eñes", () => {
    expect(capitalizarNombre("JOSÉ MUÑOZ")).toBe("José Muñoz");
  });

  it("no falla con espacios repetidos", () => {
    expect(capitalizarNombre("ANA  TORRES")).toBe("Ana Torres");
  });
});
