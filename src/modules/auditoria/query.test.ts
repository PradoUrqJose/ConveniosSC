import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type { TransaccionAuditada } from "@/lib/audit/registrar";
import type { SessionContext } from "@/lib/auth/guardas";
import { listarAuditoria } from "./query";

const ctx: SessionContext = {
  usuarioId: "11111111-1111-4111-8111-111111111111",
  empresaId: null,
  rol: "SUPERADMIN",
  requestId: "test-auditoria",
  ip: null,
  userAgent: null,
};

const ctxAdminEmpresa: SessionContext = {
  ...ctx,
  empresaId: "22222222-2222-4222-8222-222222222222",
  rol: "ADMIN_EMPRESA",
};

const ctxVendedor: SessionContext = {
  ...ctx,
  empresaId: "33333333-3333-4333-8333-333333333333",
  rol: "VENDEDOR",
};

describe("listarAuditoria", () => {
  it("ordena y pagina por la tupla ts, id", async () => {
    let consulta: SQL | undefined;
    const filas = Array.from({ length: 51 }, (_, indice) => ({
      id: 100 - indice,
      ts: "2026-08-30T12:00:00.000Z",
      accion: "LOGIN_OK",
      entidad: "sesion",
      entidad_id: String(indice),
      datos_antes: null,
      datos_despues: null,
      ip: null,
      actor_id: null,
      username: null,
      nombres: null,
      apellidos: null,
      rol: null,
    }));
    const ejecutor: TransaccionAuditada = {
      async execute(sql) {
        consulta = sql;
        return filas;
      },
    };
    const cursorEntrada = Buffer.from(
      JSON.stringify({ ts: "2026-08-31T12:00:00.000Z", id: 101 }),
      "utf8",
    ).toString("base64url");

    const pagina = await listarAuditoria(
      ctx,
      { desde: "2026-08-01", hasta: "2026-08-31", cursor: cursorEntrada },
      ejecutor,
    );

    const texto = new PgDialect().sqlToQuery(consulta!).sql;
    expect(texto).toContain("(a.ts, a.id) <");
    expect(texto).toContain("ORDER BY a.ts DESC, a.id DESC");
    expect(pagina.items).toHaveLength(50);
    expect(
      JSON.parse(Buffer.from(pagina.cursor!, "base64url").toString("utf8")),
    ).toEqual({ ts: "2026-08-30T12:00:00.000Z", id: 51 });
  });

  it("impone en SQL la empresa del administrador aunque manipule filtros", async () => {
    let consulta: SQL | undefined;
    const ejecutor: TransaccionAuditada = {
      async execute(sql) {
        consulta = sql;
        return [];
      },
    };

    await listarAuditoria(
      ctxAdminEmpresa,
      { actorId: "44444444-4444-4444-8444-444444444444" },
      ejecutor,
    );

    const query = new PgDialect().sqlToQuery(consulta!);
    expect(query.sql).toContain("a.actor_empresa_id = $1");
    expect(query.params).toContain(ctxAdminEmpresa.empresaId);
  });

  it("mantiene la auditoría global para SUPERADMIN y rechaza al VENDEDOR", async () => {
    let consulta: SQL | undefined;
    const ejecutor: TransaccionAuditada = {
      async execute(sql) {
        consulta = sql;
        return [];
      },
    };

    await listarAuditoria(ctx, {}, ejecutor);
    expect(new PgDialect().sqlToQuery(consulta!).sql).not.toContain(
      "actor_empresa_id",
    );
    await expect(
      listarAuditoria(ctxVendedor, {}, ejecutor),
    ).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
  });
});
