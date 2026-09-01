import { describe, expect, it } from "vitest";

import {
  normalizarParametrosSedes,
  serializarParametrosSedes,
} from "./filtros";

describe("filtros de Sedes", () => {
  it("acepta los filtros admitidos y descarta IDs o cursores inválidos", () => {
    expect(
      normalizarParametrosSedes({
        q: "  Principal  ",
        empresa: "no-es-un-uuid",
        estado: "inactivas",
        cursor: "corrupto",
      }),
    ).toEqual({ q: "Principal", activo: false });
  });

  it("serializa una vista compartible sin valores por defecto", () => {
    expect(
      serializarParametrosSedes({ q: "Lima", estado: "activas" }).toString(),
    ).toBe("q=Lima&estado=activas");
  });
});
