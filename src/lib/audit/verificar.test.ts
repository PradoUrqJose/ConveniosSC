import { describe, expect, it } from "vitest";

import { calcularHash, canonicalizar } from "./canonico";
import { verificarCadena, verificarFilas, type FilaCadena } from "./verificar";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const TS = "2026-08-03T00:00:00.000Z";

function canon(id: number): string {
  return canonicalizar({
    accion: "LOGIN_OK",
    actor_empresa_id: null,
    actor_rol: null,
    actor_usuario_id: null,
    datos_antes: null,
    datos_despues: null,
    entidad: "empresa",
    entidad_id: `e${id}`,
    ip: null,
    request_id: null,
    ts: TS,
    user_agent: null,
  });
}

function construirFila(
  id: number,
  prev_hash: string | null,
  hash: string,
  cadena: string | null = null,
): FilaCadena {
  return {
    id,
    cadena,
    prev_hash,
    hash,
    accion: "LOGIN_OK",
    entidad: "empresa",
    entidad_id: `e${id}`,
    actor_usuario_id: null,
    actor_empresa_id: null,
    actor_rol: null,
    datos_antes: null,
    datos_despues: null,
    ip: null,
    request_id: null,
    user_agent: null,
    ts: new Date(TS),
  };
}

describe("verificarFilas", () => {
  it("acepta una cadena íntegra", () => {
    const f1 = construirFila(1, null, calcularHash(null, canon(1)));
    const f2 = construirFila(2, f1.hash, calcularHash(f1.hash, canon(2)));
    expect(verificarFilas([f1, f2])).toEqual({ verificadas: 2, rota: false });
  });

  it("detecta una fila alterada por el hash", () => {
    const f1 = construirFila(1, null, calcularHash(null, canon(1)));
    const f2 = construirFila(2, f1.hash, calcularHash(f1.hash, canon(2)));
    f2.hash =
      "0000000000000000000000000000000000000000000000000000000000000000";
    expect(verificarFilas([f1, f2])).toEqual({
      verificadas: 1,
      rota: true,
      enId: 2,
    });
  });

  it("detecta una fila alterada en prev_hash", () => {
    const f1 = construirFila(1, null, calcularHash(null, canon(1)));
    const f2 = construirFila(2, f1.hash, calcularHash(f1.hash, canon(2)));
    f2.prev_hash =
      "0000000000000000000000000000000000000000000000000000000000000000";
    expect(verificarFilas([f1, f2])).toEqual({
      verificadas: 1,
      rota: true,
      enId: 2,
    });
  });

  it("detecta una fila eliminada en medio", () => {
    const f1 = construirFila(1, null, calcularHash(null, canon(1)));
    const f3 = construirFila(3, "abc", calcularHash("abc", canon(3)));
    expect(verificarFilas([f1, f3])).toEqual({
      verificadas: 1,
      rota: true,
      enId: 3,
    });
  });

  it("valida un tramo con prevHashInicial", () => {
    const f1 = construirFila(1, null, calcularHash(null, canon(1)));
    const f2 = construirFila(2, f1.hash, calcularHash(f1.hash, canon(2)));
    expect(verificarFilas([f2], f1.hash)).toEqual({
      verificadas: 1,
      rota: false,
    });
  });

  it("verifica cadenas por recurso aunque sus filas estén intercaladas", () => {
    const cadenaA = '["empleado","a"]';
    const cadenaB = '["empleado","b"]';
    const canonA = (id: number) =>
      canonicalizar({
        accion: "LOGIN_OK",
        actor_empresa_id: null,
        actor_rol: null,
        actor_usuario_id: null,
        cadena: cadenaA,
        datos_antes: null,
        datos_despues: null,
        entidad: "empresa",
        entidad_id: `e${id}`,
        ip: null,
        request_id: null,
        ts: TS,
        user_agent: null,
      });
    const canonB = (id: number) =>
      canonicalizar({
        accion: "LOGIN_OK",
        actor_empresa_id: null,
        actor_rol: null,
        actor_usuario_id: null,
        cadena: cadenaB,
        datos_antes: null,
        datos_despues: null,
        entidad: "empresa",
        entidad_id: `e${id}`,
        ip: null,
        request_id: null,
        ts: TS,
        user_agent: null,
      });
    const a1 = construirFila(1, null, calcularHash(null, canonA(1)), cadenaA);
    const b1 = construirFila(2, null, calcularHash(null, canonB(2)), cadenaB);
    const a2 = construirFila(
      3,
      a1.hash,
      calcularHash(a1.hash, canonA(3)),
      cadenaA,
    );

    expect(verificarFilas([a1, b1, a2])).toEqual({
      verificadas: 3,
      rota: false,
    });
  });
});

describe("verificarCadena", () => {
  it("lee y reporta lotes acotados con el último ID", async () => {
    const f1 = construirFila(1, null, calcularHash(null, canon(1)));
    const f2 = construirFila(2, f1.hash, calcularHash(f1.hash, canon(2)));
    let consulta: SQL | undefined;
    const ejecutor = {
      async execute(sql: SQL) {
        consulta = sql;
        return [f1, f2];
      },
    };

    await expect(verificarCadena({ limite: 1 }, ejecutor)).resolves.toEqual({
      verificadas: 1,
      rota: false,
      ultimoId: 1,
      completa: false,
    });
    expect(new PgDialect().sqlToQuery(consulta!).sql).toContain("LIMIT $1");
    expect(new PgDialect().sqlToQuery(consulta!).params).toContain(2);
  });
});
