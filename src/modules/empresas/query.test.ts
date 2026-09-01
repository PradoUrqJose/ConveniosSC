import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type { TransaccionAuditada } from "@/lib/audit/registrar";
import type { SessionContext } from "@/lib/auth/guardas";
import { listarEmpresas } from "./query";

const ctx: SessionContext = {
  usuarioId: "11111111-1111-4111-8111-111111111111",
  empresaId: null,
  rol: "SUPERADMIN",
  requestId: "test-empresas",
  ip: null,
  userAgent: null,
};

describe("listarEmpresas", () => {
  it("pagina antes de calcular los agregados y conserva el filtro de estado", async () => {
    const consultas: SQL[] = [];
    const ejecutor: TransaccionAuditada = {
      async execute(consulta) {
        consultas.push(consulta);
        return [];
      },
    };

    await listarEmpresas(ctx, { q: "Andes", activo: true }, ejecutor);

    const listado = new PgDialect().sqlToQuery(consultas[0]!);
    const conteo = new PgDialect().sqlToQuery(consultas[1]!);
    expect(listado.sql).toContain("WITH empresas_candidatas AS");
    expect(listado.sql).toContain("empresas_pagina AS");
    expect(listado.sql).toMatch(/LIMIT \$\d+/);
    expect(listado.sql).toContain(
      "JOIN empresas_pagina ep ON ep.id = u.empresa_id",
    );
    expect(listado.sql).toContain(
      "JOIN empresas_pagina ep ON ep.id = em.empresa_id",
    );
    expect(listado.sql).toContain("FROM empresas_pagina ep");
    expect(listado.sql).toContain("FROM empresas_candidatas");
    expect(listado.sql).toMatch(/e\.activo = \$\d+/);
    expect(conteo.sql).toMatch(/e\.activo = \$\d+/);
  });

  it("aplica el cursor a la página base y omite el conteo posterior", async () => {
    const consultas: SQL[] = [];
    const ejecutor: TransaccionAuditada = {
      async execute(consulta) {
        consultas.push(consulta);
        return [];
      },
    };
    const cursor = Buffer.from(
      JSON.stringify({
        nombre: "Comercial",
        id: "22222222-2222-4222-8222-222222222222",
      }),
      "utf8",
    ).toString("base64url");

    await listarEmpresas(ctx, { cursor }, ejecutor);

    const listado = new PgDialect().sqlToQuery(consultas[0]!);
    expect(consultas).toHaveLength(1);
    expect(listado.sql).toContain("(e.nombre_comercial, e.id) >");
    expect(listado.sql).toContain("ORDER BY e.nombre_comercial ASC, e.id ASC");
  });

  it("usa la fila adicional solo para decidir si hay página siguiente", async () => {
    const filas = Array.from({ length: 20 }, (_, indice) => ({
      id: `00000000-0000-4000-8000-${String(indice).padStart(12, "0")}`,
      ruc: "20123456789",
      nombre_comercial: `Empresa ${indice}`,
      razon_social: `Empresa ${indice} S.A.C.`,
      activo: true,
      tope_monto_venta_centimos: 0,
      requiere_evidencia_en_venta: false,
      dias_retroactivos_venta: 7,
      total_usuarios: 0,
      total_empleados: 0,
      total_convenios: 0,
      hay_siguiente: true,
    }));
    const ejecutor: TransaccionAuditada = {
      async execute() {
        return filas;
      },
    };

    const pagina = await listarEmpresas(ctx, {}, ejecutor);

    expect(pagina.items).toHaveLength(20);
    expect(pagina.cursor).not.toBeNull();
  });
});
