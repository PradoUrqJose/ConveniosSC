import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type { TransaccionAuditada } from "@/lib/audit/registrar";

import { obtenerSesionValida } from "./sesion";

describe("obtenerSesionValida", () => {
  it("devuelve el perfil breve junto con la sesión ya validada", async () => {
    const consultas: SQL[] = [];
    const ejecutor: TransaccionAuditada = {
      async execute(consulta) {
        consultas.push(consulta);
        return [
          {
            id: "sesion-1",
            usuario_id: "usuario-1",
            rol: "ADMIN_EMPRESA",
            empresa_id: "empresa-1",
            debe_cambiar_password: false,
            nombres: "Ana",
            apellidos: "Pérez",
            sede_por_defecto_id: "sede-1",
            nombre_comercial: "Comercial Andina",
          },
        ];
      },
    };

    await expect(
      obtenerSesionValida(ejecutor, "token-prueba"),
    ).resolves.toEqual({
      sesionId: "sesion-1",
      usuarioId: "usuario-1",
      empresaId: "empresa-1",
      rol: "ADMIN_EMPRESA",
      debeCambiarPassword: false,
      nombres: "Ana",
      apellidos: "Pérez",
      empresaNombre: "Comercial Andina",
      sedePorDefectoId: "sede-1",
    });

    const consulta = new PgDialect().sqlToQuery(consultas[0]!);
    expect(consulta.sql).toContain("u.nombres, u.apellidos");
    expect(consulta.sql).toContain("u.sede_por_defecto_id");
    expect(consulta.sql).toContain("e.nombre_comercial");
  });
});
