import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Contrato de release de #62. No usa cuentas personales ni una BD compartida:
 * CI crea el dataset con `src/db/seed.ts` y pasa sus credenciales efímeras.
 * Cada fallo deja ruta + viewport en el mensaje y Playwright adjunta captura,
 * vídeo y trace al artefacto `playwright-qa`.
 */
const habilitado = process.env.E2E_QA_CONTRACT === "1";
const password = process.env.E2E_QA_PASSWORD;
const usuarios = {
  vendedor: process.env.E2E_QA_VENDEDOR_USER,
  admin: process.env.E2E_QA_ADMIN_USER,
  superadmin: process.env.E2E_QA_SUPERADMIN_USER,
} as const;

const moviles = [
  { nombre: "320x568", width: 320, height: 568 },
  { nombre: "390x844", width: 390, height: 844 },
  { nombre: "430x932", width: 430, height: 932 },
] as const;
const escritorios = [
  { nombre: "1024x768", width: 1024, height: 768 },
  { nombre: "1280x800", width: 1280, height: 800 },
  { nombre: "1440x900", width: 1440, height: 900 },
] as const;

type Rol = keyof typeof usuarios;
const rutas: ReadonlyArray<{ ruta: string; rol: Rol }> = [
  { ruta: "/", rol: "vendedor" },
  { ruta: "/dashboard", rol: "admin" },
  { ruta: "/ventas/nueva", rol: "vendedor" },
  { ruta: "/ventas", rol: "vendedor" },
  { ruta: "/empleados", rol: "admin" },
  { ruta: "/sedes", rol: "admin" },
  { ruta: "/admin/empresas", rol: "superadmin" },
  { ruta: "/admin/convenios", rol: "superadmin" },
  { ruta: "/usuarios", rol: "superadmin" },
  { ruta: "/auditoria", rol: "superadmin" },
  { ruta: "/perfil", rol: "superadmin" },
  { ruta: "/perfil/password", rol: "superadmin" },
];

function asegurarCredenciales() {
  if (!password || Object.values(usuarios).some((usuario) => !usuario)) {
    throw new Error(
      "Faltan E2E_QA_{SUPERADMIN,ADMIN,VENDEDOR}_USER o E2E_QA_PASSWORD.",
    );
  }
}

async function iniciarSesion(page: Page, rol: Rol) {
  asegurarCredenciales();
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(usuarios[rol]!);
  await page.getByLabel("Contraseña").fill(password!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page, `login de ${rol}`).not.toHaveURL(/\/login/);
}

async function abrirComo(
  browser: Browser,
  rol: Rol,
  viewport: { width: number; height: number },
  opciones: { colorScheme?: "light" | "dark"; reducedMotion?: "reduce" } = {},
) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 1024,
    hasTouch: viewport.width < 1024,
    ...opciones,
  });
  const page = await context.newPage();
  await iniciarSesion(page, rol);
  return { context, page };
}

async function verificarPantalla(page: Page, etiqueta: string) {
  await expect(page, etiqueta).not.toHaveURL(/\/login/);
  await expect(page.locator("main"), etiqueta).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    `${etiqueta}: overflow horizontal`,
  ).toBe(true);
}

test.describe("contrato móvil y congelamiento desktop (#62)", () => {
  test.skip(!habilitado, "Solo CI o una BD E2E aislada con E2E_QA_CONTRACT=1.");
  test.setTimeout(180_000);

  test("smoke visual y funcional de todas las rutas críticas en la matriz", async ({
    browser,
  }, testInfo) => {
    for (const viewport of [...moviles, ...escritorios]) {
      for (const escenario of rutas) {
        const { context, page } = await abrirComo(
          browser,
          escenario.rol,
          viewport,
        );
        await page.goto(escenario.ruta, { waitUntil: "networkidle" });
        const etiqueta = `${escenario.ruta} @ ${viewport.nombre}`;
        await verificarPantalla(page, etiqueta);
        await testInfo.attach(
          `${escenario.ruta}-${viewport.nombre}`.replaceAll("/", "-") ||
            "inicio",
          {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          },
        );
        await context.close();
      }
    }
  });

  test("detalle de venta, teclado, temas, reduced motion y landscape conservan la interfaz", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await abrirComo(browser, "vendedor", moviles[1]);
    await page.goto("/ventas", { waitUntil: "networkidle" });
    const detalle = page.getByRole("link", { name: /ver detalle/i }).first();
    await expect(detalle).toBeVisible();
    await detalle.click();
    await expect(page).toHaveURL(/\/ventas\//);
    await verificarPantalla(page, "detalle de venta @390x844");

    // El foco de un campo representa el teclado virtual: la página debe
    // mantener el control visible y no introducir overflow horizontal.
    await page.goto("/ventas/nueva", { waitUntil: "networkidle" });
    const documento = page.getByLabel("Documento del empleado");
    await documento.focus();
    await expect(documento).toBeFocused();
    await verificarPantalla(page, "teclado abierto @390x844");
    await context.close();

    const login = await browser.newContext({
      viewport: moviles[0],
      isMobile: true,
      hasTouch: true,
    });
    const paginaLogin = await login.newPage();
    await paginaLogin.goto("/login");
    await paginaLogin.getByLabel("Usuario").fill("credencial-inexistente");
    await paginaLogin.getByLabel("Contraseña").fill("incorrecta");
    await paginaLogin.getByRole("button", { name: "Ingresar" }).click();
    await expect(paginaLogin.getByRole("alert")).toBeVisible();
    await verificarPantalla(paginaLogin, "estado error login @320x568");
    await login.close();

    for (const opciones of [
      { colorScheme: "dark" as const },
      { reducedMotion: "reduce" as const },
    ]) {
      const prueba = await abrirComo(browser, "admin", moviles[1], opciones);
      await prueba.page.goto("/empleados", { waitUntil: "networkidle" });
      await verificarPantalla(
        prueba.page,
        `empleados ${JSON.stringify(opciones)}`,
      );
      await testInfo.attach(`empleados-${Object.keys(opciones)[0]}`, {
        body: await prueba.page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await prueba.context.close();
    }

    const paisaje = await abrirComo(browser, "admin", {
      width: 844,
      height: 390,
    });
    await paisaje.page.goto("/empleados", { waitUntil: "networkidle" });
    await verificarPantalla(paisaje.page, "empleados landscape 844x390");
    await paisaje.context.close();
  });

  test("a11y: axe, nombres, foco visible y objetivos táctiles", async ({
    browser,
  }) => {
    const { context, page } = await abrirComo(
      browser,
      "superadmin",
      moviles[1],
    );
    for (const ruta of [
      "/empleados",
      "/auditoria",
      "/perfil",
      "/perfil/password",
    ]) {
      await page.goto(ruta, { waitUntil: "networkidle" });
      const resultado = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(resultado.violations, `${ruta}: Axe`).toEqual([]);
      const sinNombre = await page
        .locator("button, a[href], input, select, textarea")
        .evaluateAll((elementos) =>
          elementos
            .filter((elemento) => {
              const estilo = getComputedStyle(elemento);
              return (
                estilo.display !== "none" &&
                estilo.visibility !== "hidden" &&
                elemento.getBoundingClientRect().width > 0
              );
            })
            .filter(
              (elemento) =>
                !elemento.getAttribute("aria-label") &&
                !elemento.getAttribute("aria-labelledby") &&
                !(elemento.textContent ?? "").trim() &&
                !elemento.getAttribute("placeholder") &&
                !Array.from((elemento as HTMLInputElement).labels ?? []).some(
                  (label) => (label.textContent ?? "").trim(),
                ),
            )
            .map((elemento) => elemento.outerHTML.slice(0, 120)),
        );
      expect(sinNombre, `${ruta}: controles sin nombre accesible`).toEqual([]);
    }
    await page.goto("/empleados", { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        document.activeElement?.matches("button, a, input, select, textarea"),
      ),
      "foco inicial",
    ).toBe(true);
    await context.close();
  });
});
