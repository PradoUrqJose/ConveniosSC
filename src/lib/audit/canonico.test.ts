import { describe, expect, it } from "vitest";

import { calcularHash, canonicalizar, redactar, sha256Hex } from "./canonico";

describe("canonicalizar", () => {
  it("ordena claves alfabéticamente en todos los niveles", () => {
    const canon = canonicalizar({
      b: 1,
      a: { d: 2, c: 3 },
    });
    expect(canon).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("es determinista (misma entrada → mismo string)", () => {
    const a = canonicalizar({ x: 1, y: [3, { z: 2, a: 1 }] });
    const b = canonicalizar({ y: [3, { a: 1, z: 2 }], x: 1 });
    expect(a).toBe(b);
  });

  it("no distingue orden de claves en objetos anidados", () => {
    const a = canonicalizar({ datos: { monto: 100, dni: "123" } });
    const b = canonicalizar({ datos: { dni: "123", monto: 100 } });
    expect(a).toBe(b);
  });
});

describe("redactar", () => {
  it("reemplaza password_hash y tokens, preserva el resto", () => {
    const resultado = redactar({
      password_hash: "abc",
      token: "xyz",
      datos: { token_hash: "t", dni: "40000001", monto: 100 },
      nombres: "Ana",
    });
    expect(resultado).toEqual({
      password_hash: "[REDACTADO]",
      token: "[REDACTADO]",
      datos: { token_hash: "[REDACTADO]", dni: "40000001", monto: 100 },
      nombres: "Ana",
    });
  });

  it("redacta también dentro de arreglos", () => {
    const resultado = redactar({ lista: [{ password: "x" }, "ok"] });
    expect(resultado).toEqual({ lista: [{ password: "[REDACTADO]" }, "ok"] });
  });

  it("null/undefined → null", () => {
    expect(redactar(null)).toBeNull();
    expect(redactar(undefined)).toBeNull();
  });
});

describe("calcularHash", () => {
  it("usa la cadena vacía como prev_hash en la primera fila", () => {
    const h = calcularHash(null, '{"accion":"LOGIN_OK"}');
    expect(h).toBe(sha256Hex('|{"accion":"LOGIN_OK"}'));
  });

  it("encadena el prev_hash anterior", () => {
    const primera = calcularHash(null, '{"a":1}');
    const segunda = calcularHash(primera, '{"a":2}');
    expect(segunda).toBe(sha256Hex(`${primera}|{"a":2}`));
  });

  it("es determinista", () => {
    expect(calcularHash("x", '{"a":1}')).toBe(calcularHash("x", '{"a":1}'));
  });
});
