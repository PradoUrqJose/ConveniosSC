import { describe, expect, it } from "vitest";

import {
  normalizarParametrosUsuarios,
  serializarParametrosUsuarios,
} from "./filtros";

describe("filtros de Usuarios", () => {
  it("normaliza filtros válidos y descarta parámetros inválidos", () => {
    expect(
      normalizarParametrosUsuarios({
        q: "  jose  ",
        empresa: "11111111-1111-4111-8111-111111111111",
        rol: "VENDEDOR",
        estado: "activos",
        cursor: "corrupto",
      }),
    ).toMatchObject({
      q: "jose",
      empresaId: "11111111-1111-4111-8111-111111111111",
      rol: "VENDEDOR",
      activo: true,
      cursor: undefined,
    });
  });

  it("serializa una URL compartible con todos los filtros", () => {
    expect(
      serializarParametrosUsuarios({
        q: "jose",
        empresa: "11111111-1111-4111-8111-111111111111",
        rol: "ADMIN_EMPRESA",
        estado: "inactivos",
      }).toString(),
    ).toBe(
      "q=jose&empresa=11111111-1111-4111-8111-111111111111&rol=ADMIN_EMPRESA&estado=inactivos",
    );
  });
});
