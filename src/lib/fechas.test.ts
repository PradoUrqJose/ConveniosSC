import { afterEach, describe, expect, it, vi } from "vitest";

import {
  compararFechas,
  esFechaValida,
  fechaRelativa,
  formatearFechaHoraLima,
  formatearFechaUI,
  formatearHoraLima,
  hoyLima,
  sumarDias,
} from "./fechas";

describe("hoyLima", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a las 23:00 en Lima, en UTC ya es el día siguiente", () => {
    // Lima es UTC-5 sin horario de verano: 2026-03-04 23:00 Lima = 2026-03-05 04:00 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T04:00:00.000Z"));

    expect(hoyLima()).toBe("2026-03-04");
  });

  it("a mediodía en Lima, coincide con el día UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T17:00:00.000Z"));

    expect(hoyLima()).toBe("2026-03-05");
  });
});

describe("esFechaValida", () => {
  it("acepta una fecha real", () => {
    expect(esFechaValida("2026-08-03")).toBe(true);
  });

  it("rechaza formato incorrecto", () => {
    expect(esFechaValida("03/08/2026")).toBe(false);
  });

  it("rechaza una fecha calendario inexistente", () => {
    expect(esFechaValida("2026-02-30")).toBe(false);
  });
});

describe("compararFechas", () => {
  it("ordena correctamente", () => {
    expect(compararFechas("2026-01-01", "2026-01-02")).toBe(-1);
    expect(compararFechas("2026-01-02", "2026-01-01")).toBe(1);
    expect(compararFechas("2026-01-01", "2026-01-01")).toBe(0);
  });
});

describe("sumarDias", () => {
  it("suma días cruzando el fin de mes", () => {
    expect(sumarDias("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("resta días con valor negativo", () => {
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("formatearFechaUI", () => {
  it("convierte YYYY-MM-DD a dd/mm/aaaa", () => {
    expect(formatearFechaUI("2026-08-03")).toBe("03/08/2026");
  });
});

describe("formatearFechaHoraLima / formatearHoraLima", () => {
  it("formatea un TIMESTAMPTZ a hora de Lima", () => {
    // 2026-08-03T19:32:00Z = 2026-08-03 14:32 en Lima (UTC-5).
    expect(formatearFechaHoraLima("2026-08-03T19:32:00.000Z")).toBe(
      "03/08/2026 14:32",
    );
    expect(formatearHoraLima("2026-08-03T19:32:00.000Z")).toBe("14:32");
  });
});

describe("fechaRelativa", () => {
  const ahora = new Date("2026-08-03T19:32:00.000Z");

  it("menos de un minuto", () => {
    expect(fechaRelativa(new Date("2026-08-03T19:31:45.000Z"), ahora)).toBe(
      "hace un momento",
    );
  });

  it("minutos", () => {
    expect(fechaRelativa(new Date("2026-08-03T19:20:00.000Z"), ahora)).toBe(
      "hace 12 minutos",
    );
  });

  it("horas, menos de 24h", () => {
    expect(fechaRelativa(new Date("2026-08-03T17:32:00.000Z"), ahora)).toBe(
      "hace 2 horas",
    );
  });

  it("24h o más devuelve fecha absoluta", () => {
    expect(fechaRelativa(new Date("2026-08-01T19:32:00.000Z"), ahora)).toBe(
      formatearFechaHoraLima("2026-08-01T19:32:00.000Z"),
    );
  });
});
