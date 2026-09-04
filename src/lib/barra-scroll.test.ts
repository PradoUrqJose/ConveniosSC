import { describe, expect, it } from "vitest";

import {
  BLOQUEO_MS,
  estadoInicialBarra,
  siguienteEstadoBarra,
  type EstadoBarra,
  type MedidasScroll,
} from "./barra-scroll";

const DOCUMENTO = 4000;
const VIEWPORT = 800;

function avanzar(
  estado: EstadoBarra,
  y: number,
  opciones: Partial<MedidasScroll> = {},
) {
  return siguienteEstadoBarra(estado, {
    y,
    alturaViewport: VIEWPORT,
    alturaDocumento: DOCUMENTO,
    ahora: 10_000,
    permitirOcultar: true,
    ...opciones,
  });
}

describe("siguienteEstadoBarra", () => {
  it("se oculta tras 80px hacia abajo y vuelve con 30px hacia arriba", () => {
    let estado = estadoInicialBarra(0);
    // El ancla se fija al salir de la zona superior (80px).
    estado = avanzar(estado, 80);
    estado = avanzar(estado, 120);
    estado = avanzar(estado, 159);
    expect(estado.visible).toBe(true);
    estado = avanzar(estado, 161);
    expect(estado.visible).toBe(false);

    // El bloqueo antiparpadeo impide revertir en el mismo instante.
    estado = avanzar(estado, 141);
    expect(estado.visible).toBe(false);

    estado = avanzar(estado, 130, { ahora: 10_000 + BLOQUEO_MS });
    expect(estado.visible).toBe(true);
  });

  it("no se oculta con un scroll corto ni con idas y vueltas", () => {
    let estado = estadoInicialBarra(0);
    estado = avanzar(estado, 80);
    for (const y of [100, 150, 120, 160, 130, 155]) {
      estado = avanzar(estado, y);
      expect(estado.visible).toBe(true);
    }
  });

  it("está siempre visible en el tope y en el final del documento", () => {
    let estado = estadoInicialBarra(0);
    estado = avanzar(estado, 300);
    estado = avanzar(estado, 385);
    expect(estado.visible).toBe(false);

    estado = avanzar(estado, DOCUMENTO - VIEWPORT, {
      ahora: 10_000 + BLOQUEO_MS,
    });
    expect(estado.visible).toBe(true);

    estado = avanzar(estado, 40, { ahora: 20_000 });
    expect(estado.visible).toBe(true);
  });

  it("aguanta el rebote de iOS por arriba y por abajo", () => {
    let estado = estadoInicialBarra(0);
    estado = avanzar(estado, -60);
    expect(estado.visible).toBe(true);
    estado = avanzar(estado, DOCUMENTO - VIEWPORT + 90, { ahora: 11_000 });
    expect(estado.visible).toBe(true);
  });

  it("se queda visible cuando no se permite ocultar (foco, teclado, reduced motion)", () => {
    let estado = estadoInicialBarra(0);
    estado = avanzar(estado, 300);
    estado = avanzar(estado, 385);
    expect(estado.visible).toBe(false);

    estado = avanzar(estado, 500, {
      ahora: 30_000,
      permitirOcultar: false,
    });
    expect(estado.visible).toBe(true);

    // Y sigue visible mientras dure la condición, aunque siga bajando.
    estado = avanzar(estado, 900, { ahora: 40_000, permitirOcultar: false });
    expect(estado.visible).toBe(true);
  });
});
