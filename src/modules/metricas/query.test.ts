import { describe, expect, it } from "vitest";

import type { TransaccionAuditada } from "@/lib/audit/registrar";
import type { SessionContext } from "@/lib/auth/guardas";

import { obtenerDashboard } from "./query";

const ctx: SessionContext = {
  usuarioId: "11111111-1111-4111-8111-111111111111",
  empresaId: null,
  rol: "SUPERADMIN",
  requestId: "test-dashboard",
  ip: null,
  userAgent: null,
};

describe("obtenerDashboard", () => {
  it("fusiona las métricas compatibles en cinco consultas sin alterar el resultado", async () => {
    const respuestas = [
      [
        {
          cantidad: 3,
          bruto: 10000,
          descuento: 1200,
          final: 8800,
          anuladas_cantidad: 1,
          anuladas_bruto: 2500,
          compradores: 2,
          activos: 8,
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
          id: "22222222-2222-4222-8222-222222222222",
          nombre: "Empresa compradora",
          cantidad: 3,
          bruto: 10000,
          descuento: 1200,
        },
      ],
      [
        {
          id: "33333333-3333-4333-8333-333333333333",
          nombre: "Vendedora Uno",
          cantidad: 3,
          bruto: 10000,
        },
      ],
      [
        {
          tipo: "empleado",
          id: "44444444-4444-4444-8444-444444444444",
          nombre: "Empleada Uno",
          tipo_documento: "DNI",
          numero_documento: "12345678",
          cantidad: 2,
          bruto: 7000,
        },
        {
          tipo: "sede",
          id: "55555555-5555-4555-8555-555555555555",
          nombre: "Sede Centro",
          tipo_documento: null,
          numero_documento: null,
          cantidad: 3,
          bruto: 10000,
        },
      ],
    ];
    let llamadas = 0;
    const ejecutor: TransaccionAuditada = {
      async execute() {
        return respuestas[llamadas++]!;
      },
    };

    const dashboard = await obtenerDashboard(
      ctx,
      { desde: "2026-08-01", hasta: "2026-08-31" },
      ejecutor,
    );

    expect(llamadas).toBe(5);
    expect(dashboard).toMatchObject({
      totales: {
        cantidad: 3,
        sumaBrutoCentimos: 10000,
        sumaDescuentoCentimos: 1200,
        sumaFinalCentimos: 8800,
        ticketPromedioCentimos: 2933,
      },
      anuladas: { cantidad: 1, sumaBrutoCentimos: 2500 },
      adopcion: {
        empleadosQueCompraron: 2,
        empleadosActivos: 8,
        tasa: 25,
      },
      topEmpleados: [
        {
          empleadoId: "44444444-4444-4444-8444-444444444444",
          nombre: "Empleada Uno",
          tipoDocumento: "DNI",
          numeroDocumento: "12345678",
          cantidad: 2,
          brutoCentimos: 7000,
        },
      ],
      porSede: [
        {
          sedeId: "55555555-5555-4555-8555-555555555555",
          nombre: "Sede Centro",
          cantidad: 3,
          brutoCentimos: 10000,
        },
      ],
    });
  });
});
