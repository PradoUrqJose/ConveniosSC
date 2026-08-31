import { describe, expect, it } from "vitest";

import type { TransaccionAuditada } from "@/lib/audit/registrar";
import type { SessionContext } from "@/lib/auth/guardas";

import { completarSerie, obtenerDashboard, obtenerGranularidad } from "./query";

const ctx: SessionContext = {
  usuarioId: "11111111-1111-4111-8111-111111111111",
  empresaId: "22222222-2222-4222-8222-222222222222",
  rol: "ADMIN_EMPRESA",
  requestId: "test-dashboard",
  ip: null,
  userAgent: null,
};

function ejecutor(
  respuestas: unknown[],
  contador: { total: number },
): TransaccionAuditada {
  return {
    async execute() {
      return respuestas[contador.total++]!;
    },
  };
}

describe("series del dashboard", () => {
  it("usa días para 31 días aunque crucen de mes y completa los ceros", () => {
    expect(obtenerGranularidad("2026-01-15", "2026-02-14")).toBe("dia");
    expect(
      completarSerie(
        [
          {
            periodo: "2026-01-16",
            cantidad: 1,
            brutoCentimos: 500,
            descuentoCentimos: 50,
          },
        ],
        "2026-01-15",
        "2026-02-14",
        "dia",
      ),
    ).toHaveLength(31);
    expect(
      completarSerie([], "2026-01-15", "2026-02-14", "dia")[0],
    ).toMatchObject({
      periodo: "2026-01-15",
      cantidad: 0,
    });
    expect(obtenerGranularidad("2026-01-01", "2026-04-01")).toBe("mes");
  });
});

describe("obtenerDashboard", () => {
  it("devuelve sólo rankings propios y beneficiarios para ventas vendidas", async () => {
    const contador = { total: 0 };
    const dashboard = await obtenerDashboard(
      ctx,
      {
        desde: "2026-08-01",
        hasta: "2026-08-31",
        direccion: "vendidas",
      },
      ejecutor(
        [
          [
            {
              cantidad: 3,
              bruto: 10000,
              descuento: 1200,
              final: 8800,
              anuladas_cantidad: 1,
              anuladas_bruto: 2500,
            },
          ],
          [
            {
              periodo: "2026-08-01",
              cantidad: 3,
              bruto: 10000,
              descuento: 1200,
            },
          ],
          [
            {
              id: "empresa-compradora",
              nombre: "Empresa compradora",
              cantidad: 3,
              bruto: 10000,
              descuento: 1200,
            },
          ],
          [
            {
              id: "vendedor-propio",
              nombre: "Vendedora propia",
              cantidad: 3,
              bruto: 10000,
            },
          ],
          [
            {
              tipo: "beneficiario",
              id: "empleado-externo",
              nombre: "Beneficiaria",
              tipo_documento: "DNI",
              numero_documento: "12345678",
              cantidad: 2,
              bruto: 7000,
            },
            {
              tipo: "sede",
              id: "sede-propia",
              nombre: "Sede Centro",
              cantidad: 3,
              bruto: 10000,
            },
          ],
        ],
        contador,
      ),
    );

    expect(contador.total).toBe(5);
    expect(dashboard).toMatchObject({
      direccion: "vendidas",
      empresasCompradoras: [{ empresaNombre: "Empresa compradora" }],
      topVendedores: [{ nombre: "Vendedora propia" }],
      beneficiarios: [{ nombre: "Beneficiaria" }],
      porSede: [{ nombre: "Sede Centro" }],
    });
    expect("adopcion" in dashboard).toBe(false);
  });

  it("calcula adopción sólo con empleados propios en ventas compradas", async () => {
    const contador = { total: 0 };
    const dashboard = await obtenerDashboard(
      ctx,
      {
        desde: "2026-08-01",
        hasta: "2026-08-31",
        direccion: "compradas",
      },
      ejecutor(
        [
          [
            {
              cantidad: 2,
              bruto: 5000,
              descuento: 500,
              final: 4500,
              anuladas_cantidad: 3,
              anuladas_bruto: 7500,
              compradores: 2,
            },
          ],
          [],
          [
            {
              id: "empresa-vendedora",
              nombre: "Empresa vendedora",
              cantidad: 2,
              bruto: 5000,
              descuento: 500,
            },
          ],
          [{ activos: 8 }],
          [
            {
              id: "empleado-propio",
              nombre: "Empleado propio",
              tipo_documento: "DNI",
              numero_documento: "87654321",
              cantidad: 1,
              bruto: 2500,
            },
          ],
        ],
        contador,
      ),
    );

    expect(contador.total).toBe(5);
    expect(dashboard).toMatchObject({
      direccion: "compradas",
      empresasVendedoras: [{ empresaNombre: "Empresa vendedora" }],
      topEmpleados: [{ nombre: "Empleado propio" }],
      adopcion: { empleadosQueCompraron: 2, empleadosActivos: 8, tasa: 25 },
    });
    expect("topVendedores" in dashboard).toBe(false);
    expect("porSede" in dashboard).toBe(false);
  });

  it("conserva las anuladas aunque no haya registradas", async () => {
    const contador = { total: 0 };
    const dashboard = await obtenerDashboard(
      ctx,
      {
        desde: "2026-08-01",
        hasta: "2026-08-31",
        direccion: "vendidas",
      },
      ejecutor(
        [
          [
            {
              cantidad: 0,
              bruto: 0,
              descuento: 0,
              final: 0,
              anuladas_cantidad: 3,
              anuladas_bruto: 7500,
            },
          ],
          [],
          [],
          [],
          [],
        ],
        contador,
      ),
    );

    expect(dashboard.totales.cantidad).toBe(0);
    expect(dashboard.anuladas).toEqual({
      cantidad: 3,
      sumaBrutoCentimos: 7500,
    });
  });
});
