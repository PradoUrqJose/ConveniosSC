import { describe, expect, it } from "vitest";

import type { TransaccionAuditada } from "@/lib/audit/registrar";

import { listarVentas } from "./query";

const contexto = {
  usuarioId: "550e8400-e29b-41d4-a716-446655440000",
  empresaId: "550e8400-e29b-41d4-a716-446655440001",
  rol: "VENDEDOR" as const,
  requestId: "test-ventas-performance",
  ip: null,
  userAgent: null,
};

function ejecutorFalso(contador: { total: number }): TransaccionAuditada {
  return {
    async execute() {
      contador.total += 1;
      return [];
    },
  };
}

describe("listado de Ventas", () => {
  it("reutiliza el resumen al cambiar sólo el cursor", async () => {
    const contador = { total: 0 };
    const resumen = {
      cantidad: 26,
      sumaBruto: 26000,
      sumaDescuento: 2600,
      sumaFinal: 23400,
    };

    const pagina = await listarVentas(
      contexto,
      {
        cursor: "cursor-de-prueba",
        resumenReutilizado: resumen,
      },
      ejecutorFalso(contador),
    );

    expect(contador.total).toBe(1);
    expect(pagina.resumen).toEqual(resumen);
    expect(pagina.items).toEqual([]);
  });

  it("sigue consultando el resumen cuando no se entrega uno reutilizable", async () => {
    const contador = { total: 0 };

    await listarVentas(
      contexto,
      { cursor: "cursor-de-prueba" },
      ejecutorFalso(contador),
    );

    expect(contador.total).toBe(2);
  });
});
