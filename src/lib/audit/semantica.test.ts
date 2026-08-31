import { describe, expect, it } from "vitest";
import { accionAuditoria } from "@/db/schema";
import {
  accionesDeFamilia,
  ACCIONES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  esEntidadAuditoria,
  esFamiliaAuditoria,
  etiquetaAccion,
  etiquetaCampo,
  etiquetaEntidad,
  FAMILIAS_AUDITORIA,
  fraseAuditoria,
  metaDeAccion,
} from "./semantica";

describe("semántica de auditoría", () => {
  it("define familia, verbo y tono para cada acción del enum", () => {
    for (const accion of accionAuditoria.enumValues) {
      const meta = metaDeAccion(accion);
      expect(meta, `falta metadata para ${accion}`).not.toBeNull();
      expect(FAMILIAS_AUDITORIA.some((f) => f.valor === meta!.familia)).toBe(
        true,
      );
      expect(meta!.verbo.length).toBeGreaterThan(0);
    }
  });

  it("no reconoce una acción fuera del enum", () => {
    expect(metaDeAccion("BORRAR_TODO")).toBeNull();
  });

  it("agrupa cada acción en exactamente una familia y cubre las seis familias", () => {
    const cubiertas = new Set(
      FAMILIAS_AUDITORIA.map((f) => f.valor).filter(
        (familia) => accionesDeFamilia(familia).length > 0,
      ),
    );
    expect(cubiertas.size).toBe(FAMILIAS_AUDITORIA.length);

    const total = FAMILIAS_AUDITORIA.reduce(
      (suma, f) => suma + accionesDeFamilia(f.valor).length,
      0,
    );
    expect(total).toBe(accionAuditoria.enumValues.length);
  });

  it("valida familias y entidades conocidas, rechazando lo demás", () => {
    expect(esFamiliaAuditoria("VENTA")).toBe(true);
    expect(esFamiliaAuditoria("INVENTADA")).toBe(false);
    expect(esEntidadAuditoria("empleado")).toBe(true);
    expect(esEntidadAuditoria("inventada")).toBe(false);
    for (const entidad of ENTIDADES_AUDITORIA) {
      expect(etiquetaEntidad(entidad.valor)).toBe(entidad.etiqueta);
    }
    expect(etiquetaEntidad("desconocida")).toBe("desconocida");
  });

  it("humaniza campos conocidos y desconocidos del diff", () => {
    expect(etiquetaCampo("nombres")).toBe("Nombres");
    expect(etiquetaCampo("empresaId")).toBe("Empresa");
    expect(etiquetaCampo("nuevoCampoRaro")).toBe("Nuevo campo raro");
    expect(etiquetaCampo("campo_snake")).toBe("Campo snake");
  });

  it("da a cada acción un título propio (no cae al valor crudo del enum)", () => {
    for (const accion of accionAuditoria.enumValues) {
      expect(etiquetaAccion(accion)).not.toBe(accion);
    }
    expect(etiquetaAccion("BORRAR_TODO")).toBe("BORRAR_TODO");
  });

  it("expone una opción de select por acción, con su familia", () => {
    expect(ACCIONES_AUDITORIA).toHaveLength(accionAuditoria.enumValues.length);
    for (const opcion of ACCIONES_AUDITORIA) {
      expect(accionesDeFamilia(opcion.familia)).toContain(opcion.valor);
    }
  });

  it("arma la frase humana con actor y, sin actor, con 'El sistema'", () => {
    expect(
      fraseAuditoria({
        accion: "VENTA_ANULADA",
        actor: { nombres: "María", apellidos: "Pérez" },
      }),
    ).toBe("María Pérez anuló una venta");
    expect(fraseAuditoria({ accion: "LOGIN_OK", actor: null })).toBe(
      "El sistema inició sesión",
    );
  });
});
