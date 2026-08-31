import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type { TransaccionAuditada } from "@/lib/audit/registrar";
import type { SessionContext } from "@/lib/auth/guardas";
import { listarAuditoria, obtenerDetalleAuditoria } from "./query";

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

  it("lista metadatos sin snapshots y vuelve a imponer el alcance al leer detalle", async () => {
    const consultas: SQL[] = [];
    const ejecutor: TransaccionAuditada = {
      async execute(sql) {
        consultas.push(sql);
        return [];
      },
    };

    await listarAuditoria(ctxAdminEmpresa, {}, ejecutor);
    await obtenerDetalleAuditoria(ctxAdminEmpresa, 99, ejecutor);

    const listado = new PgDialect().sqlToQuery(consultas[0]!);
    const detalle = new PgDialect().sqlToQuery(consultas[1]!);
    expect(listado.sql).not.toContain("datos_antes");
    expect(listado.sql).not.toContain("datos_despues");
    expect(detalle.sql).toContain("a.actor_empresa_id = $1");
    expect(detalle.params).toContain(ctxAdminEmpresa.empresaId);
    expect(detalle.params).toContain(99);
  });

  it("expande la familia en las acciones que la componen, sin usar = ANY", async () => {
    let consulta: SQL | undefined;
    const ejecutor: TransaccionAuditada = {
      async execute(sql) {
        consulta = sql;
        return [];
      },
    };

    await listarAuditoria(ctx, { familia: "SESION" }, ejecutor);

    const query = new PgDialect().sqlToQuery(consulta!);
    expect(query.sql).not.toContain("ANY(");
    expect(query.sql).toContain("a.accion = $1");
    expect(query.params).toEqual(
      expect.arrayContaining(["LOGIN_OK", "LOGIN_FALLIDO", "LOGOUT"]),
    );
  });

  it("ignora la familia cuando hay una acción concreta", async () => {
    let consulta: SQL | undefined;
    const ejecutor: TransaccionAuditada = {
      async execute(sql) {
        consulta = sql;
        return [];
      },
    };

    await listarAuditoria(
      ctx,
      { familia: "SESION", accion: "VENTA_CREADA" },
      ejecutor,
    );

    const query = new PgDialect().sqlToQuery(consulta!);
    expect(query.params.slice(0, -1)).toEqual(["VENTA_CREADA"]);
  });

  it("filtra por username del actor con ILIKE", async () => {
    let consulta: SQL | undefined;
    const ejecutor: TransaccionAuditada = {
      async execute(sql) {
        consulta = sql;
        return [];
      },
    };

    await listarAuditoria(ctx, { actor: "jperez" }, ejecutor);

    const query = new PgDialect().sqlToQuery(consulta!);
    expect(query.sql).toContain("u.username ILIKE");
    expect(query.params).toContain("%jperez%");
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
