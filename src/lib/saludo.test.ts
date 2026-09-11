import { describe, expect, it } from "vitest";

import { saludoPorHora } from "@/lib/saludo";

/** Lima es UTC-5 todo el año (sin horario de verano). */
function enLima(hora: number, minuto = 30): Date {
  return new Date(Date.UTC(2026, 8, 10, hora + 5, minuto));
}

describe("saludoPorHora", () => {
  it("saluda de mañana entre las 5:00 y las 11:59 de Lima", () => {
    expect(saludoPorHora(enLima(5, 0))).toBe("Buenos días");
    expect(saludoPorHora(enLima(11, 59))).toBe("Buenos días");
  });

  it("saluda de tarde entre las 12:00 y las 18:59 de Lima", () => {
    expect(saludoPorHora(enLima(12, 0))).toBe("Buenas tardes");
    expect(saludoPorHora(enLima(18, 59))).toBe("Buenas tardes");
  });

  it("saluda de noche desde las 19:00 hasta las 4:59 de Lima", () => {
    expect(saludoPorHora(enLima(19, 0))).toBe("Buenas noches");
    expect(saludoPorHora(enLima(2))).toBe("Buenas noches");
    expect(saludoPorHora(enLima(4, 59))).toBe("Buenas noches");
  });
});
