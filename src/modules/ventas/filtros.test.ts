import { describe, expect, it } from "vitest";

import {
  filtrosDesdeParametros,
  mismoConjuntoVentas,
  normalizarParametrosVentas,
  parametrosDesdeUrl,
} from "./filtros";

describe("filtros de Ventas", () => {
  it("descarta parámetros inválidos antes de construir la consulta", () => {
    const sp = normalizarParametrosVentas({
      desde: "2026-02-30",
      hasta: "2026-08-30",
      empresa: "no-es-un-uuid",
      vendedor: "no-es-un-uuid",
      montoMin: "S/ 10",
      estado: "inventado",
      orden: "por_nombre",
      revision: "true",
    });

    expect(sp).toEqual({
      q: undefined,
      desde: undefined,
      hasta: "2026-08-30",
      empresa: undefined,
      estado: undefined,
      vendedor: undefined,
      sede: undefined,
      montoMin: undefined,
      montoMax: undefined,
      revision: undefined,
      dir: undefined,
      orden: undefined,
      cursor: undefined,
      antes: undefined,
    });
  });

  it("conserva parámetros válidos y fuerza vendedor/sede al lado vendido", () => {
    const sp = normalizarParametrosVentas({
      dir: "compradas",
      vendedor: "550e8400-e29b-41d4-a716-446655440000",
      sede: "550e8400-e29b-41d4-a716-446655440001",
      empresa: "550e8400-e29b-41d4-a716-446655440002",
      montoMin: "10,50",
      estado: "TODAS",
    });
    const filtros = filtrosDesdeParametros(sp, true);

    expect(filtros).toMatchObject({
      direccion: "compradas",
      empresaId: "550e8400-e29b-41d4-a716-446655440002",
      estado: "TODAS",
      montoMinCentimos: 1050,
      vendedorId: undefined,
      sedeId: undefined,
    });
  });

  it("puede reconstruir la vista desde la URL del navegador", () => {
    const sp = parametrosDesdeUrl(
      new URLSearchParams(
        "dir=compradas&estado=ANULADA&orden=monto_asc&revision=1",
      ),
    );

    expect(sp).toMatchObject({
      dir: "compradas",
      estado: "ANULADA",
      orden: "monto_asc",
      revision: "1",
    });
  });

  it("distingue filtros de cursores y conserva el resumen sólo para el mismo conjunto", () => {
    const primera = normalizarParametrosVentas({ q: "lima" });
    const segundaPagina = normalizarParametrosVentas({
      q: "lima",
      cursor: "siguiente",
      antes: "-",
    });
    const busquedaDistinta = normalizarParametrosVentas({
      q: "arequipa",
      cursor: "siguiente",
    });

    expect(mismoConjuntoVentas(primera, segundaPagina)).toBe(true);
    expect(mismoConjuntoVentas(primera, busquedaDistinta)).toBe(false);
  });
});
