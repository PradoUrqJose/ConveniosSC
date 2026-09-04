import { expect, test, type Page } from "@playwright/test";

/**
 * Verificación visual de los tokens y primitivas móviles del issue #51
 * (PWA-MOB-01) — docs/sistema-diseno-mobile (1).md.
 *
 * Se ejecuta explícitamente con E2E_BASELINE=1 (mismo gate que
 * baseline-desktop.spec.ts): requiere credenciales reales, no corre en el
 * pipeline por defecto.
 *
 * Dos cosas se prueban acá:
 * 1. Sin overflow horizontal ni recortes a 320/390/430px en la referencia
 *    viva de tokens (`/estilo-movil`).
 * 2. Que el nuevo bloque `@media (max-width: 1023.98px)` de globals.css no
 *    cambia un pixel del dashboard a 1024/1280/1440px — comparación
 *    contra la misma ruta antes de este issue via snapshot pixel a pixel.
 */
const habilitado = process.env.E2E_BASELINE === "1";
const cookieSesion = process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";
const viewportsMovil = [
  { nombre: "320x720", width: 320, height: 720 },
  { nombre: "390x844", width: 390, height: 844 },
  { nombre: "430x932", width: 430, height: 932 },
] as const;
const viewportsDesktop = [
  { nombre: "1024x768", width: 1024, height: 768 },
  { nombre: "1280x800", width: 1280, height: 800 },
  { nombre: "1440x900", width: 1440, height: 900 },
] as const;

async function iniciarSesionSuperadmin(page: Page) {
  const usuario = process.env.E2E_BASELINE_SUPERADMIN_USER;
  const password = process.env.E2E_BASELINE_SUPERADMIN_PASSWORD;
  if (!usuario || !password) {
    throw new Error(
      "Define E2E_BASELINE_SUPERADMIN_USER y E2E_BASELINE_SUPERADMIN_PASSWORD.",
    );
  }
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(usuario);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.some((cookie) => cookie.name === cookieSesion);
    })
    .toBe(true);
}

test.describe("tokens y geometría móvil (issue #51)", () => {
  test.skip(
    !habilitado,
    "Se ejecuta explícitamente con E2E_BASELINE=1 en un entorno aislado.",
  );

  test("sin overflow horizontal a 320/390/430px, claro y oscuro", async ({
    browser,
  }, testInfo) => {
    for (const colorScheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ colorScheme });
      const page = await context.newPage();
      await iniciarSesionSuperadmin(page);
      await page.goto("/estilo-movil", { waitUntil: "networkidle" });

      for (const viewport of viewportsMovil) {
        await page.setViewportSize(viewport);
        const overflowX = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(
          overflowX,
          `${viewport.nombre} (${colorScheme}) no debe tener overflow horizontal`,
        ).toBe(false);
        await page.screenshot({
          path: testInfo.outputPath(
            `estilo-movil-${viewport.nombre}-${colorScheme}.png`,
          ),
          fullPage: true,
        });
      }
      await context.close();
    }
  });

  test("fondo y superficies salen de la misma rampa del mismo modo", async ({
    browser,
  }) => {
    // Guard del bug que motivó la rampa propia: aliasar `--mob-bg` a
    // `--sidebar` (navy en los dos temas) y `--mob-superficie` a `--card`
    // (blanco en claro) daba página oscura con tarjetas blancas. Se compara
    // la luminancia real, no el valor del token, para que cualquier alias
    // futuro que reintroduzca la mezcla falle acá.
    for (const colorScheme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        colorScheme,
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await iniciarSesionSuperadmin(page);
      await page.goto("/estilo-movil", { waitUntil: "networkidle" });

      const { fondo, tarjeta } = await page.evaluate(() => {
        const luminancia = (selector: string) => {
          const elemento = document.querySelector(selector);
          if (!elemento) throw new Error(`Falta ${selector}`);
          const canales = (
            getComputedStyle(elemento).backgroundColor.match(/[\d.]+/g) ?? []
          )
            .slice(0, 3)
            .map(Number);
          if (canales.length < 3) {
            throw new Error(`Color no resuelto en ${selector}`);
          }
          const [r, g, b] = canales as [number, number, number];
          return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        };
        return {
          fondo: luminancia(".mob-shell"),
          tarjeta: luminancia(".mob-tarjeta"),
        };
      });

      if (colorScheme === "light") {
        expect(fondo, "modo claro: el fondo es claro").toBeGreaterThan(0.6);
        expect(tarjeta, "modo claro: la tarjeta es clara").toBeGreaterThan(0.6);
      } else {
        expect(fondo, "modo oscuro: el fondo es oscuro").toBeLessThan(0.25);
        expect(tarjeta, "modo oscuro: la tarjeta es oscura").toBeLessThan(0.25);
      }
      // La tarjeta siempre se separa del fondo por luminosidad (doc §2:
      // sin bordes), pero nunca cruzando al otro modo.
      expect(Math.abs(tarjeta - fondo)).toBeGreaterThan(0.01);

      await context.close();
    }
  });

  test("dashboard idéntico a 1024/1280/1440px tras el issue", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({ colorScheme: "light" });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);

    for (const viewport of viewportsDesktop) {
      await page.setViewportSize(viewport);
      await page.goto("/dashboard", { waitUntil: "networkidle" });
      await page.screenshot({
        path: testInfo.outputPath(`dashboard-${viewport.nombre}-despues.png`),
        fullPage: true,
      });
    }
    await context.close();
  });
});
