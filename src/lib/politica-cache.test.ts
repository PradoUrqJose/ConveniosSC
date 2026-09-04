import { describe, expect, it } from "vitest";

import { politicaDeCache } from "./politica-cache";

const navegar = (url: string) =>
  politicaDeCache({ url, metodo: "GET", modo: "navigate" });

describe("nada autenticado se cachea", () => {
  it("las navegaciones de la app van siempre a la red", () => {
    for (const ruta of [
      "/",
      "/dashboard",
      "/ventas",
      "/ventas/nueva",
      "/ventas/8f0a-1",
      "/empleados",
      "/sedes",
      "/usuarios",
      "/auditoria",
      "/admin/empresas",
      "/admin/convenios",
      "/perfil",
    ]) {
      expect(navegar(`https://convenios.app${ruta}`)).toBe("red-siempre");
    }
  });

  it("la búsqueda por DNI (Server Action) nunca se guarda", () => {
    expect(
      politicaDeCache({
        url: "https://convenios.app/ventas/nueva",
        metodo: "POST",
        esAccionServidor: true,
      }),
    ).toBe("red-siempre");
  });

  it("los documentos de identidad y evidencias van siempre a la red", () => {
    expect(
      politicaDeCache({
        url: "https://convenios.app/api/adjuntos/9c1d",
        metodo: "GET",
      }),
    ).toBe("red-siempre");
    expect(
      politicaDeCache({
        url: "https://convenios.app/api/blob/upload",
        metodo: "POST",
      }),
    ).toBe("red-siempre");
    expect(
      politicaDeCache({
        url: "https://convenios.app/api/empleados/exportar?sede=1",
        metodo: "GET",
      }),
    ).toBe("red-siempre");
  });

  it("el payload RSC de una navegación cliente tampoco se guarda", () => {
    expect(
      politicaDeCache({
        url: "https://convenios.app/ventas.rsc",
        metodo: "GET",
      }),
    ).toBe("red-siempre");
  });

  it("ningún método distinto de GET termina en caché", () => {
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        politicaDeCache({ url: "https://convenios.app/cualquiera", metodo }),
      ).toBe("red-siempre");
    }
  });
});

describe("solo lo estático y sin sesión se guarda", () => {
  it("fuentes e iconos", () => {
    expect(
      politicaDeCache({
        url: "https://convenios.app/_next/static/media/inter.woff2",
        metodo: "GET",
        destino: "font",
      }),
    ).toBe("cache-primero");
    expect(
      politicaDeCache({
        url: "https://convenios.app/icons/192.png",
        metodo: "GET",
      }),
    ).toBe("cache-primero");
    expect(
      politicaDeCache({
        url: "https://convenios.app/favicon.ico",
        metodo: "GET",
      }),
    ).toBe("cache-primero");
  });

  it("los chunks del build los sigue resolviendo el precaché", () => {
    expect(
      politicaDeCache({
        url: "https://convenios.app/_next/static/chunks/main.js",
        metodo: "GET",
        destino: "script",
      }),
    ).toBe("sin-regla");
  });
});
