import { describe, expect, it } from "vitest";
import { normalizarParametrosDashboard } from "./filtros";

describe("filtros de Dashboard", () => {
  it("normaliza dirección desconocida y rango invertido", () => {
    expect(
      normalizarParametrosDashboard(
        { dir: "ajena", desde: "2026-09-10", hasta: "2026-09-01" },
        "2026-09-30",
      ),
    ).toEqual({
      dir: "vendidas",
      desde: "2026-09-01",
      hasta: "2026-09-30",
    });
  });
});
