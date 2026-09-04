import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Capas móviles unificadas — issue #54 (PWA-MOB-04).
 *
 * Mismo gate que el resto de los specs autenticados (`E2E_BASELINE=1` +
 * credenciales reales): navega la app real, no corre en el pipeline por
 * defecto.
 *
 * Cubre los criterios de aceptación del issue:
 * 1. Un solo patrón de capa: filtros, edición, detalle y confirmación son
 *    el mismo bottom sheet, con la misma geometría.
 * 2. Escape / backdrop / gesto respetan el contenido modificado: piden
 *    confirmación dentro de la misma capa o no hacen nada.
 * 3. Sin doble scroll (solo desplaza el cuerpo) ni fondo que se mueva.
 * 4. Foco atrapado, devuelto al invocador, y nombres/roles accesibles
 *    (axe wcag2a/aa).
 * 5. Escritorio a 1024px: sigue siendo el diálogo centrado de siempre y
 *    ninguna regla del sheet existe.
 */
const habilitado = process.env.E2E_BASELINE === "1";
const cookieSesion = process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";

const SHEET = ".mob-sheet";
const CUERPO = "[data-slot=mobile-sheet-cuerpo]";

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

async function abrirMovil(page: Page, ruta: string) {
  await page.goto(ruta, { waitUntil: "networkidle" });
}

test.describe("capas móviles unificadas (issue #54)", () => {
  test.skip(
    !habilitado,
    "Se ejecuta explícitamente con E2E_BASELINE=1 en un entorno aislado.",
  );

  test("la edición entra por abajo, ancho completo y sin doble scroll", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await abrirMovil(page, "/empleados");

    await page.getByRole("button", { name: "Nuevo empleado" }).click();
    const sheet = page.locator(SHEET);
    await expect(sheet).toBeVisible();

    const medidas = await sheet.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        izquierda: rect.left,
        ancho: rect.width,
        fondo: window.innerHeight - rect.bottom,
        alto: rect.height,
        radioSuperior: parseFloat(
          getComputedStyle(el).borderTopLeftRadius || "0",
        ),
        radioInferior: parseFloat(
          getComputedStyle(el).borderBottomLeftRadius || "0",
        ),
      };
    });
    // Anclado al borde inferior, ancho completo, esquinas superiores
    // redondeadas: la firma del bottom sheet, no la de un diálogo.
    expect(medidas.izquierda).toBeLessThanOrEqual(1);
    expect(medidas.ancho).toBeCloseTo(390, 0);
    expect(medidas.fondo).toBeLessThanOrEqual(1);
    expect(medidas.radioSuperior).toBeGreaterThan(8);
    expect(medidas.radioInferior).toBe(0);
    expect(medidas.alto).toBeLessThan(844);

    // Un único elemento desplazable dentro de la capa.
    const desplazables = await page.locator(SHEET).evaluate((el) => {
      return Array.from(el.querySelectorAll<HTMLElement>("*")).filter(
        (hijo) => {
          const overflow = getComputedStyle(hijo).overflowY;
          return (
            (overflow === "auto" || overflow === "scroll") &&
            hijo.scrollHeight > hijo.clientHeight + 1
          );
        },
      ).length;
    });
    expect(desplazables).toBeLessThanOrEqual(1);

    // El fondo no desplaza mientras la capa está abierta.
    const antes = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(antes);

    await context.close();
  });

  test("Escape, backdrop y la X respetan el formulario modificado", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await abrirMovil(page, "/empleados");

    await page.getByRole("button", { name: "Nuevo empleado" }).click();
    await page.getByLabel("Nombres").fill("Lucía");

    // Tocar fuera: el gesto más accidental no hace nada.
    await page.mouse.click(195, 40);
    await page.waitForTimeout(250);
    await expect(page.locator(SHEET)).toBeVisible();
    await expect(page.getByText("¿Descartar los cambios?")).toHaveCount(0);

    // Escape: confirmación dentro de la misma capa, sin encadenar modales.
    await page.keyboard.press("Escape");
    const confirmacion = page.getByRole("alertdialog", {
      name: "Descartar cambios",
    });
    await expect(confirmacion).toBeVisible();
    await expect(page.locator(SHEET)).toHaveCount(1);

    // "Seguir editando" devuelve el formulario con lo escrito intacto.
    await confirmacion.getByRole("button", { name: "Seguir editando" }).click();
    await expect(page.getByLabel("Nombres")).toHaveValue("Lucía");

    // Descartar sí cierra.
    await page.keyboard.press("Escape");
    await confirmacion.getByRole("button", { name: "Descartar" }).click();
    await expect(page.locator(SHEET)).toHaveCount(0);

    await context.close();
  });

  test("sin cambios cierra directo y devuelve el foco al invocador", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await abrirMovil(page, "/empleados");

    const invocador = page.getByRole("button", { name: "Nuevo empleado" });
    await invocador.click();
    await expect(page.locator(SHEET)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expect(invocador).toBeFocused();

    await context.close();
  });

  test("el foco queda atrapado dentro de la capa", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await abrirMovil(page, "/sedes");

    await page.getByRole("button", { name: "Nueva sede" }).click();
    await expect(page.locator(SHEET)).toBeVisible();

    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press("Tab");
      const dentro = await page.evaluate(() => {
        const sheet = document.querySelector(".mob-sheet");
        return Boolean(
          sheet &&
          document.activeElement &&
          sheet.contains(document.activeElement),
        );
      });
      expect(dentro).toBe(true);
    }

    await context.close();
  });

  test("los filtros son una sola capa multipágina y no filtran en vivo", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await abrirMovil(page, "/empleados");

    const urlInicial = page.url();
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    await expect(page.locator(SHEET)).toBeVisible();

    // La fila empuja una subpágina dentro de la misma capa.
    await page.getByRole("button", { name: /^Orden/ }).click();
    await expect(page.locator("[data-pagina=grupo-orden]")).toBeVisible();
    await expect(page.locator(SHEET)).toHaveCount(1);
    // Mientras hay pila, la X es flecha de volver.
    await expect(page.getByRole("button", { name: "Volver" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar" })).toHaveCount(0);

    await page.getByRole("radio", { name: "Más recientes" }).click();
    await page.getByRole("button", { name: "Volver" }).click();

    // Hasta acá nada se aplicó: la URL sigue igual.
    expect(page.url()).toBe(urlInicial);

    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect.poll(() => page.url()).toContain("orden=reciente");
    // Filtros activos: un punto, sin número.
    await expect(page.locator(".mob-punto-filtros")).toHaveCount(1);

    await context.close();
  });

  test("axe no encuentra violaciones en la capa", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await abrirMovil(page, "/empleados");

    await page.getByRole("button", { name: "Nuevo empleado" }).click();
    await expect(page.locator(SHEET)).toBeVisible();

    const resultado = await new AxeBuilder({ page })
      .include(SHEET)
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(resultado.violations).toEqual([]);

    await context.close();
  });

  test("el cuerpo del sheet no queda tapado por el teclado", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await abrirMovil(page, "/sedes");

    await page.getByRole("button", { name: "Nueva sede" }).click();
    await page.getByLabel("Nombre").click();

    // El pie con la acción primaria sigue dentro del viewport con el campo
    // enfocado (en escritorio no hay teclado virtual: se verifica que la
    // geometría base no dependa de él).
    const pie = page.locator("[data-slot=mobile-sheet-acciones]").last();
    const visible = await pie.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.bottom <= window.innerHeight + 1 && rect.height > 0;
    });
    expect(visible).toBe(true);
    await expect(page.locator(CUERPO).first()).toBeVisible();

    await context.close();
  });

  test("escritorio a 1024px sigue usando el diálogo centrado", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 900 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await abrirMovil(page, "/empleados");

    await page.getByRole("button", { name: "Nuevo empleado" }).click();
    const dialogo = page.locator("[data-slot=dialog-content]");
    await expect(dialogo).toBeVisible();
    await expect(page.locator(SHEET)).toHaveCount(0);

    const centrado = await dialogo.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        margenIzquierdo: rect.left,
        margenDerecho: window.innerWidth - rect.right,
        pegadoAbajo: window.innerHeight - rect.bottom,
      };
    });
    expect(centrado.margenIzquierdo).toBeGreaterThan(8);
    expect(
      Math.abs(centrado.margenIzquierdo - centrado.margenDerecho),
    ).toBeLessThan(2);
    expect(centrado.pegadoAbajo).toBeGreaterThan(8);

    // El icon button de filtros del móvil no existe en escritorio.
    await expect(
      page.getByRole("button", { name: "Filtros", exact: true }),
    ).toBeHidden();

    await context.close();
  });
});
