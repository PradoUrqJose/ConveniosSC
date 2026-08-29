import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  claveCadenaAuditoria,
  registrar,
  type TransaccionAuditada,
} from "./registrar";

describe("registrar", () => {
  it("usa la cadena del recurso tanto para el lock como para buscar el extremo", async () => {
    const consultas: SQL[] = [];
    const tx: TransaccionAuditada = {
      async execute(consulta) {
        consultas.push(consulta);
        return [];
      },
    };
    const cadena = claveCadenaAuditoria("empleado", "empleado-1");

    await registrar(tx, {
      accion: "EMPLEADO_ACTUALIZADO",
      entidad: "empleado",
      entidadId: "empleado-1",
    });

    const dialecto = new PgDialect();
    const sqlUltima = dialecto.sqlToQuery(consultas[0]!);
    const sqlInsert = dialecto.sqlToQuery(consultas[1]!);

    expect(sqlUltima.sql).toContain("pg_advisory_xact_lock(hashtext($1))");
    expect(sqlUltima.sql).toContain("WHERE cadena = $2");
    expect(sqlUltima.params).toEqual([cadena, cadena]);
    expect(sqlInsert.sql).toContain("cadena, prev_hash, hash");
    expect(sqlInsert.params).toContain(cadena);
  });

  it("codifica pares distintos sin ambigüedad de separadores", () => {
    expect(claveCadenaAuditoria("a:b", "c")).not.toBe(
      claveCadenaAuditoria("a", "b:c"),
    );
  });
});
