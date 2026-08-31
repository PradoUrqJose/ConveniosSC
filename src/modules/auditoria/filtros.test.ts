import { describe, expect, it } from "vitest";
import {
  normalizarParametrosAuditoria,
  serializarParametrosAuditoria,
} from "./filtros";

describe("filtros de Auditoría", () => {
  it("nunca deja pasar una acción, cursor o ID inválido", () => {
    const filtros = normalizarParametrosAuditoria({
      accion: "BORRAR_TODO",
      cursor: "cursor-corrupto",
      actorId: "id-mal-formado",
      entidadId: "tampoco-es-uuid",
    });

    expect(filtros).toEqual({
      desde: undefined,
      hasta: undefined,
      accion: undefined,
      entidad: undefined,
      entidadId: undefined,
      actorId: undefined,
      cursor: undefined,
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
