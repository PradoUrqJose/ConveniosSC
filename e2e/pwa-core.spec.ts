import { expect, test } from "@playwright/test";

/**
 * Contrato de producción de PWA-CORE-01. No requiere una cuenta: comprueba el
 * worker real que recibe el navegador y que sus Cache Storage no contienen
 * rutas que puedan llevar datos de sesión.
 */
test.describe("PWA core (#60)", () => {
  test("el worker tiene alcance, no se cachea por HTTP y no guarda datos privados", async ({
    page,
  }) => {
    const respuesta = await page.request.get("/serwist/sw.js");
    expect(respuesta.ok()).toBe(true);
    expect(respuesta.headers()["service-worker-allowed"]).toBe("/");
    expect(respuesta.headers()["cache-control"]).toContain("no-store");

    await page.goto("/login");
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    );

    const caches = await page.evaluate(async () => {
      const nombres = await window.caches.keys();
      const entradas = await Promise.all(
        nombres.map(async (nombre) => {
          const cache = await window.caches.open(nombre);
          const peticiones = await cache.keys();
          return { nombre, urls: peticiones.map((peticion) => peticion.url) };
        }),
      );
      return entradas;
    });

    for (const cache of caches) {
      expect(cache.nombre).not.toBe("fuentes");
      expect(cache.nombre).not.toBe("iconos");
      for (const url of cache.urls) {
        expect(url).not.toMatch(/\/api\/|_rsc=|\.rsc(?:$|\?)/);
        expect(url).not.toMatch(
          /\/(ventas|empleados|usuarios|auditoria)(?:\/|$)/,
        );
      }
    }
  });

  test("una navegación offline recibe el fallback", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    );
    expect(
      await page.evaluate(async () => Boolean(await caches.match("/~offline"))),
    ).toBe(true);

    await context.setOffline(true);
    // Chromium puede rechazar la promesa de navegación aunque el worker
    // complete el documento con el fallback; lo que importa es el DOM final.
    await page.goto("/ruta-sin-red").catch(() => undefined);
    await expect(
      page.getByRole("heading", { name: "Sin conexión" }),
    ).toBeVisible();
  });
});
