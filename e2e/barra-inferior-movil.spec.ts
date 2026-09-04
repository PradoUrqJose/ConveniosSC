import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Barra inferior flotante — issue #53 (PWA-MOB-03).
 *
 * Mismo gate que `shell-movil.spec.ts` y `baseline-desktop.spec.ts`
 * (`E2E_BASELINE=1` + credenciales reales): navega la app autenticada, no
 * corre en el pipeline por defecto.
 *
 * Cubre los criterios de aceptación del issue:
 * 1. La barra flota (separada del borde y de los insets) y no se solapa
 *    con el contenido: el final del `<main>` queda por encima de ella.
 * 2. Etiquetas y destino activo son inequívocos a 320px, sin recortes.
 * 3. Ocultamiento por scroll: ~80px hacia abajo la oculta, ~30px hacia
 *    arriba la recupera, y en el tope siempre está visible.
 * 4. No se oculta con el teclado abierto (campo enfocado) ni con
 *    `prefers-reduced-motion`.
 * 5. El cambio de ruta da feedback inmediato (aria-current) y conserva el
 *    foco en la pestaña tocada.
 * 6. Escritorio: a 1024px la barra no se pinta y manda el sidebar.
 */
const habilitado = process.env.E2E_BASELINE === "1";
const cookieSesion = process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";

const BARRA = ".mob-barra-inferior";
const PASTILLA = ".mob-barra-inferior-pastilla";
const TAB = ".mob-barra-inferior-tab";

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

/** `true` cuando la barra está en pantalla (no desplazada hacia abajo). */
async function barraVisible(page: Page) {
  return page.locator(BARRA).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight - 1;
  });
}

async function scrollear(page: Page, delta: number) {
  await page.mouse.wheel(0, delta);
  // Dos frames: uno para el evento y otro para el rAF que evalúa el estado.
  await page.waitForTimeout(250);
}

test.describe("barra inferior flotante (issue #53)", () => {
  test.skip(
    !habilitado,
    "Se ejecuta explícitamente con E2E_BASELINE=1 en un entorno aislado.",
  );

  test("flota separada del borde y no tapa el final del contenido", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/empleados", { waitUntil: "networkidle" });

    const medidas = await page.locator(PASTILLA).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        izquierda: rect.left,
        derecha: window.innerWidth - rect.right,
        abajo: window.innerHeight - rect.bottom,
        alto: rect.height,
      };
    });
    // Píldora, no barra pegada: aire propio abajo y a los lados.
    expect(medidas.abajo).toBeGreaterThanOrEqual(12);
    expect(medidas.izquierda).toBeGreaterThanOrEqual(16);
    expect(medidas.derecha).toBeGreaterThanOrEqual(16);
    // Radio ≈ mitad del alto (píldora).
    const radio = await page
      .locator(PASTILLA)
      .evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).borderTopLeftRadius),
      );
    expect(radio).toBeGreaterThanOrEqual(medidas.alto / 2 - 1);

    // El hueco reservado por el contenido cubre barra + separación.
    const solapa = await page.evaluate(() => {
      const main = document.querySelector("main");
      const barra = document.querySelector(".mob-barra-inferior-pastilla");
      if (!main || !barra) return null;
      const estilo = getComputedStyle(main);
      return (
        Number.parseFloat(estilo.paddingBottom) <
        barra.getBoundingClientRect().height
      );
    });
    expect(solapa).toBe(false);
    await context.close();
  });

  test("a 320px las etiquetas se leen enteras y el activo es inequívoco", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 720 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/empleados", { waitUntil: "networkidle" });

    const tabs = page.locator(TAB);
    const total = await tabs.count();
    expect(total).toBeGreaterThanOrEqual(3);
    expect(total).toBeLessThanOrEqual(5);

    for (let i = 0; i < total; i += 1) {
      const tab = tabs.nth(i);
      const caja = await tab.boundingBox();
      // Área táctil mínima.
      expect(caja?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);

      const etiqueta = tab.locator(".mob-barra-inferior-etiqueta");
      await expect(etiqueta).toBeVisible();
      const recortada = await etiqueta.evaluate(
        (el) => el.scrollWidth > el.clientWidth + 1,
      );
      expect(recortada, `etiqueta ${i} recortada a 320px`).toBe(false);
    }

    // Un único destino activo, y es el de la ruta.
    await expect(page.locator(`${TAB}[aria-current="page"]`)).toHaveCount(1);
    await expect(page.locator(`${TAB}[aria-current="page"]`)).toHaveAttribute(
      "href",
      "/empleados",
    );

    const overflowX = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflowX).toBe(false);

    const resultado = await new AxeBuilder({ page })
      .include(BARRA)
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(resultado.violations.map((v) => v.id)).toEqual([]);
    await context.close();
  });

  test("se oculta con scroll descendente y vuelve al subir", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/empleados", { waitUntil: "networkidle" });

    const hayScroll = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight * 2,
    );
    test.skip(!hayScroll, "La pantalla no tiene scroll suficiente.");

    expect(await barraVisible(page)).toBe(true);

    // Un scroll corto no la mueve; pasado el umbral, se va.
    await scrollear(page, 60);
    await scrollear(page, 40);
    expect(await barraVisible(page)).toBe(true);
    await scrollear(page, 200);
    expect(await barraVisible(page)).toBe(false);

    // 30px hacia arriba la recuperan.
    await scrollear(page, -60);
    expect(await barraVisible(page)).toBe(true);

    // Y en el tope siempre está.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    expect(await barraVisible(page)).toBe(true);
    await context.close();
  });

  test("no se oculta con el teclado abierto ni con reduced motion", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/empleados", { waitUntil: "networkidle" });

    await scrollear(page, 400);
    expect(await barraVisible(page)).toBe(true);
    await context.close();

    const contextoNormal = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const pagina = await contextoNormal.newPage();
    await iniciarSesionSuperadmin(pagina);
    await pagina.goto("/empleados", { waitUntil: "networkidle" });

    // Campo enfocado = teclado abierto en un móvil real.
    const buscador = pagina.getByPlaceholder("Buscar por nombre o documento");
    if (await buscador.isVisible()) {
      await buscador.focus();
      await scrollear(pagina, 400);
      expect(await barraVisible(pagina)).toBe(true);
    }
    await contextoNormal.close();
  });

  test("el cambio de ruta da feedback inmediato y conserva el foco", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/empleados", { waitUntil: "networkidle" });

    const destino = page.locator(`${TAB}[href="/sedes"]`);
    await destino.click();
    // El estado activo se pinta sin esperar a la navegación.
    await expect(destino).toHaveAttribute("data-activo", "true", {
      timeout: 500,
    });
    await page.waitForURL("**/sedes");
    await expect(destino).toHaveAttribute("aria-current", "page");
    // El foco se queda en la pestaña: nadie lo mueve al navegar.
    const enfocado = await page.evaluate(
      () => document.activeElement?.getAttribute("href") ?? null,
    );
    expect(enfocado).toBe("/sedes");
    await context.close();
  });

  test("escritorio: a 1024px manda el sidebar", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/empleados", { waitUntil: "networkidle" });

    await expect(page.locator(BARRA)).toBeHidden();
    // El sidebar de escritorio sigue siendo el que navega.
    await expect(page.locator("aside").first()).toBeVisible();
    await context.close();
  });
});
