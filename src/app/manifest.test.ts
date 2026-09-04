import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("manifest de la PWA", () => {
  it("define una app standalone con identidad, colores e iconos instalables", () => {
    const resultado = manifest();

    expect(resultado).toMatchObject({
      name: "Convenios",
      short_name: "Convenios",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#faf8f6",
      theme_color: "#283c73",
    });
    expect(resultado.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icons/192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/icons/512.png", sizes: "512x512" }),
        expect.objectContaining({
          src: "/icons/maskable-512.png",
          purpose: "maskable",
        }),
      ]),
    );
  });

  it("solo publica atajos disponibles para cualquier rol autenticado", () => {
    const resultado = manifest();
    expect(resultado.shortcuts?.map((atajo) => atajo.url)).toEqual([
      "/ventas",
      "/perfil",
    ]);
  });
});
