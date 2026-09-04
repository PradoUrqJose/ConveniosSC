import { describe, expect, it } from "vitest";

import {
  contarFiltrosActivos,
  decidirCierre,
  etiquetaDeValor,
  hayCambiosEnBorrador,
  valoresNeutros,
  type GrupoFiltro,
  type RazonCierre,
} from "./capas-movil";

const RAZONES: RazonCierre[] = [
  "trigger-press",
  "outside-press",
  "escape-key",
  "close-watcher",
  "close-press",
  "focus-out",
  "imperative-action",
  "swipe",
  "none",
];

describe("decidirCierre", () => {
  it("sin cambios ni operación en curso, cualquier gesto cierra", () => {
    for (const razon of RAZONES) {
      expect(
        decidirCierre({ razon, hayCambios: false, pendiente: false }),
      ).toBe("cerrar");
    }
  });

  it("mientras hay una operación en curso no cierra nada", () => {
    for (const razon of RAZONES) {
      expect(decidirCierre({ razon, hayCambios: true, pendiente: true })).toBe(
        "bloquear",
      );
      expect(decidirCierre({ razon, hayCambios: false, pendiente: true })).toBe(
        "bloquear",
      );
    }
  });

  it("con cambios, Escape, la X y el arrastre piden confirmación", () => {
    for (const razon of [
      "escape-key",
      "close-press",
      "close-watcher",
      "swipe",
      "trigger-press",
    ] as RazonCierre[]) {
      expect(decidirCierre({ razon, hayCambios: true, pendiente: false })).toBe(
        "confirmar",
      );
    }
  });

  it("con cambios, tocar fuera o perder el foco no hace nada", () => {
    expect(
      decidirCierre({
        razon: "outside-press",
        hayCambios: true,
        pendiente: false,
      }),
    ).toBe("bloquear");
    expect(
      decidirCierre({ razon: "focus-out", hayCambios: true, pendiente: false }),
    ).toBe("bloquear");
  });

  it("el cierre pedido por el código tras guardar no se interrumpe", () => {
    expect(
      decidirCierre({
        razon: "imperative-action",
        hayCambios: true,
        pendiente: false,
      }),
    ).toBe("cerrar");
    expect(
      decidirCierre({ razon: "none", hayCambios: true, pendiente: false }),
    ).toBe("cerrar");
  });
});

const GRUPOS: GrupoFiltro[] = [
  {
    id: "estado",
    etiqueta: "Estado",
    opciones: [
      { valor: "todos", etiqueta: "Todos" },
      { valor: "activos", etiqueta: "Activos" },
    ],
  },
  {
    id: "orden",
    etiqueta: "Orden",
    opciones: [
      { valor: "nombre_asc", etiqueta: "Nombre A–Z" },
      { valor: "reciente", etiqueta: "Más recientes" },
    ],
  },
];

describe("filtros del sheet", () => {
  it("el valor neutro de cada grupo es su primera opción", () => {
    expect(valoresNeutros(GRUPOS)).toEqual({
      estado: "todos",
      orden: "nombre_asc",
    });
  });

  it("cuenta solo los grupos fuera de su valor neutro", () => {
    expect(contarFiltrosActivos(GRUPOS, valoresNeutros(GRUPOS))).toBe(0);
    expect(
      contarFiltrosActivos(GRUPOS, { estado: "activos", orden: "nombre_asc" }),
    ).toBe(1);
    expect(
      contarFiltrosActivos(GRUPOS, { estado: "activos", orden: "reciente" }),
    ).toBe(2);
  });

  it("detecta el borrador sin aplicar (el sheet no filtra en vivo)", () => {
    const aplicados = valoresNeutros(GRUPOS);
    expect(hayCambiosEnBorrador(GRUPOS, aplicados, aplicados)).toBe(false);
    expect(
      hayCambiosEnBorrador(GRUPOS, aplicados, {
        ...aplicados,
        estado: "activos",
      }),
    ).toBe(true);
  });

  it("la pill de la fila cae al valor neutro si el valor es desconocido", () => {
    expect(etiquetaDeValor(GRUPOS[0]!, "activos")).toBe("Activos");
    expect(etiquetaDeValor(GRUPOS[0]!, "inventado")).toBe("Todos");
  });
});
