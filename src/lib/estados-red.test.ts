import { describe, expect, it } from "vitest";

import {
  clasificarFallo,
  copiaFallo,
  debeMostrarEsqueleto,
  esReintentable,
  MS_UMBRAL_ESQUELETO,
  recuperacionDe,
  reintentoAutomaticoSeguro,
  retrasoReintento,
  type ClaseFallo,
} from "./estados-red";

const CLASES: ClaseFallo[] = [
  "offline",
  "servidor",
  "timeout",
  "sesion",
  "permiso",
  "datos",
  "desconocido",
];

describe("clasificarFallo", () => {
  it("sin red gana sobre cualquier otra señal", () => {
    expect(
      clasificarFallo({
        enLinea: false,
        estadoHttp: 500,
        codigo: "SIN_PERMISO",
      }),
    ).toBe("offline");
  });

  it("traduce los códigos de dominio", () => {
    expect(clasificarFallo({ codigo: "NO_AUTENTICADO" })).toBe("sesion");
    expect(clasificarFallo({ codigo: "SIN_PERMISO" })).toBe("permiso");
    expect(clasificarFallo({ codigo: "ERROR_INTERNO" })).toBe("servidor");
    expect(clasificarFallo({ codigo: "VALIDACION" })).toBe("datos");
    expect(clasificarFallo({ codigo: "CONFLICTO" })).toBe("datos");
    expect(clasificarFallo({ codigo: "NO_ENCONTRADO" })).toBe("datos");
  });

  it("separa 401, 403, 5xx y timeout del HTTP", () => {
    expect(clasificarFallo({ estadoHttp: 401 })).toBe("sesion");
    expect(clasificarFallo({ estadoHttp: 403 })).toBe("permiso");
    expect(clasificarFallo({ estadoHttp: 408 })).toBe("timeout");
    expect(clasificarFallo({ estadoHttp: 504 })).toBe("timeout");
    expect(clasificarFallo({ estadoHttp: 500 })).toBe("servidor");
    expect(clasificarFallo({ estadoHttp: 503 })).toBe("servidor");
    expect(clasificarFallo({ estadoHttp: 422 })).toBe("datos");
  });

  it("un aborto por tiempo es timeout, no caída del servidor", () => {
    const abort = new Error("The operation was aborted.");
    abort.name = "AbortError";
    expect(clasificarFallo({ error: abort, enLinea: true })).toBe("timeout");
    expect(
      clasificarFallo({ error: new Error("Request timed out"), enLinea: true }),
    ).toBe("timeout");
  });

  it("con red y fetch rechazado es servidor caído, no offline", () => {
    // El caso que la página `~offline` confundía: hay internet, el que no
    // contesta es el servidor.
    expect(
      clasificarFallo({
        error: new TypeError("Failed to fetch"),
        enLinea: true,
      }),
    ).toBe("servidor");
    expect(
      clasificarFallo({ error: new TypeError("Load failed"), enLinea: true }),
    ).toBe("servidor");
  });

  it("sin señales útiles no inventa una causa", () => {
    expect(clasificarFallo({})).toBe("desconocido");
    expect(clasificarFallo({ error: new Error("boom") })).toBe("desconocido");
    expect(clasificarFallo({ estadoHttp: 0 })).toBe("desconocido");
  });
});

describe("esReintentable / recuperacionDe", () => {
  it("solo los fallos de transporte se reintentan igual", () => {
    expect(esReintentable("offline")).toBe(true);
    expect(esReintentable("servidor")).toBe(true);
    expect(esReintentable("timeout")).toBe(true);
    expect(esReintentable("desconocido")).toBe(true);
    expect(esReintentable("sesion")).toBe(false);
    expect(esReintentable("permiso")).toBe(false);
    expect(esReintentable("datos")).toBe(false);
  });

  it("cada clase ofrece exactamente una salida", () => {
    expect(recuperacionDe("offline")).toBe("esperar-red");
    expect(recuperacionDe("sesion")).toBe("reautenticar");
    expect(recuperacionDe("permiso")).toBe("volver");
    expect(recuperacionDe("datos")).toBe("volver");
    expect(recuperacionDe("servidor")).toBe("reintentar");
    expect(recuperacionDe("timeout")).toBe("reintentar");
  });
});

describe("reintentoAutomaticoSeguro", () => {
  it("nunca reenvía una mutación por su cuenta", () => {
    for (const clase of CLASES) {
      expect(reintentoAutomaticoSeguro({ clase, mutacion: true })).toBe(false);
    }
  });

  it("reintenta lecturas solo ante fallos de transporte", () => {
    expect(
      reintentoAutomaticoSeguro({ clase: "offline", mutacion: false }),
    ).toBe(true);
    expect(
      reintentoAutomaticoSeguro({ clase: "servidor", mutacion: false }),
    ).toBe(true);
    expect(
      reintentoAutomaticoSeguro({ clase: "timeout", mutacion: false }),
    ).toBe(true);
    expect(
      reintentoAutomaticoSeguro({ clase: "sesion", mutacion: false }),
    ).toBe(false);
    expect(
      reintentoAutomaticoSeguro({ clase: "desconocido", mutacion: false }),
    ).toBe(false);
  });
});

describe("umbral de esqueleto y espera de reintento", () => {
  it("no dibuja esqueleto por debajo del umbral", () => {
    expect(debeMostrarEsqueleto(0)).toBe(false);
    expect(debeMostrarEsqueleto(MS_UMBRAL_ESQUELETO - 1)).toBe(false);
    expect(debeMostrarEsqueleto(MS_UMBRAL_ESQUELETO)).toBe(true);
    expect(debeMostrarEsqueleto(1_000)).toBe(true);
  });

  it("la espera crece y se topa", () => {
    expect(retrasoReintento(0)).toBe(500);
    expect(retrasoReintento(1)).toBe(1_000);
    expect(retrasoReintento(2)).toBe(2_000);
    expect(retrasoReintento(20)).toBe(8_000);
    expect(retrasoReintento(-3)).toBe(500);
  });
});

describe("copiaFallo", () => {
  it("toda clase tiene texto propio y distinto", () => {
    const titulos = CLASES.map((clase) => copiaFallo(clase).titulo);
    expect(new Set(titulos).size).toBe(CLASES.length);
    for (const clase of CLASES) {
      const copia = copiaFallo(clase);
      expect(copia.titulo.length).toBeGreaterThan(0);
      expect(copia.descripcion.length).toBeGreaterThan(0);
    }
  });

  it("la sesión vencida ofrece entrar, no reintentar", () => {
    expect(copiaFallo("sesion").accion).toBe("Iniciar sesión");
  });
});
