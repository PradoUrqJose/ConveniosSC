import { describe, expect, it } from "vitest";
import {
  normalizarParametrosAuditoria,
  serializarParametrosAuditoria,
} from "./filtros";

describe("filtros de Auditoría", () => {
  it("nunca deja pasar una acción, familia, entidad, cursor o ID inválido", () => {
    const filtros = normalizarParametrosAuditoria({
      accion: "BORRAR_TODO",
      familia: "INVENTADA",
      entidad: "tabla_inventada",
      cursor: "cursor-corrupto",
      actorId: "id-mal-formado",
      entidadId: "tampoco-es-uuid",
    });

    expect(filtros).toEqual({
      desde: undefined,
      hasta: undefined,
      familia: undefined,
      accion: undefined,
      entidad: undefined,
      entidadId: undefined,
      actorId: undefined,
      actor: undefined,
      cursor: undefined,
    });
  });

  it("acepta familia y entidad conocidas, y descarta la familia si hay acción concreta", () => {
    expect(
      normalizarParametrosAuditoria({ familia: "VENTA", entidad: "venta" }),
    ).toMatchObject({ familia: "VENTA", entidad: "venta" });

    expect(
      normalizarParametrosAuditoria({
        familia: "VENTA",
        accion: "LOGIN_OK",
      }),
    ).toMatchObject({ familia: undefined, accion: "LOGIN_OK" });
  });

  it("sanea el actor como texto y lo distingue de actorId", () => {
    expect(normalizarParametrosAuditoria({ actor: "jperez" })).toMatchObject({
      actor: "jperez",
      actorId: undefined,
    });
  });

  it("elimina un rango de fechas invertido al serializar", () => {
    const query = serializarParametrosAuditoria({
      desde: "2026-09-10",
      hasta: "2026-09-01",
      accion: "LOGIN_OK",
    });

    expect(query.toString()).toBe("accion=LOGIN_OK");
  });
});
