import { describe, expect, it } from "vitest";
import { normalizarParametrosEmpleados } from "./filtros";

describe("filtros de Empleados", () => {
  it("vuelve al tab por defecto e ignora un cursor corrupto", () => {
    expect(
      normalizarParametrosEmpleados({
        tab: "eliminados",
        cursor: "cursor-corrupto",
      }),
    ).toMatchObject({ tab: "todos", estado: undefined, cursor: undefined });
  });
});
