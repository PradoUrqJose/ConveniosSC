import { describe, expect, it } from "vitest";

import type { SessionContext } from "@/lib/auth/guardas";
import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { crearEmpleadoCore } from "./acciones";

describe("permisos para crear empleados", () => {
  it("rechaza al vendedor antes de ejecutar cualquier consulta", async () => {
    const tx = {
      execute: () => {
        throw new Error("No debe consultar la base de datos");
      },
    } as unknown as TransaccionAuditada;
    const ctx: SessionContext = {
      usuarioId: "11111111-1111-4111-8111-111111111111",
      empresaId: "22222222-2222-4222-8222-222222222222",
      rol: "VENDEDOR",
      requestId: "test-vendedor-no-crea-empleados",
      ip: null,
      userAgent: null,
    };

    await expect(
      crearEmpleadoCore(tx, ctx, {
        empresaId: "33333333-3333-4333-8333-333333333333",
        tipoDocumento: "DNI",
        numeroDocumento: "12345678",
        nombres: "Ana",
        apellidos: "Prueba",
        consentimiento: true,
      }),
    ).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
      message: "Los vendedores no pueden crear empleados.",
    });
  });
});
