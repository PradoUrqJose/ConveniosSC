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
});
