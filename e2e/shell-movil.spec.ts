import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Shell móvil sin header fijo y cabeceras por pantalla — issue #52
 * (PWA-MOB-02).
 *
 * Mismo gate que `tokens-movil.spec.ts` y `baseline-desktop.spec.ts`
 * (`E2E_BASELINE=1` + credenciales reales): estas pruebas navegan la app
 * autenticada, no corren en el pipeline por defecto.
 *
 * Cubre los criterios de aceptación del issue:
 * 1. Ningún título se trunca a 320/390/430px.
 * 2. No existe header sticky global en móvil.
 * 3. Safe areas: la cabecera reserva el inset superior y no hay overflow
 *    horizontal en portrait ni en landscape.
 * 4. Lectores de pantalla: título, back y acciones tienen nombre accesible
 *    (axe + roles explícitos).
 * 5. Escritorio: a 1024px la cabecera móvil no existe y sigue la de siempre.
 */
const habilitado =
  process.env.E2E_BASELINE === "1" || process.env.E2E_QA_CONTRACT === "1";
const cookieSesion = process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";

const viewportsMovil = [
  { nombre: "320x720", width: 320, height: 720 },
  { nombre: "390x844", width: 390, height: 844 },
  { nombre: "430x932", width: 430, height: 932 },
] as const;

/** Rutas raíz + una secundaria y una de formulario. */
const rutas = ["/dashboard", "/ventas", "/empleados", "/perfil"] as const;

async function iniciarSesionSuperadmin(page: Page) {
  const usuario =
    process.env.E2E_BASELINE_SUPERADMIN_USER ??
    process.env.E2E_QA_SUPERADMIN_USER;
  const password =
    process.env.E2E_BASELINE_SUPERADMIN_PASSWORD ?? process.env.E2E_QA_PASSWORD;
  if (!usuario || !password) {
    throw new Error(
      "Define E2E_BASELINE_* o E2E_QA_{SUPERADMIN_USER,PASSWORD}.",
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

test.describe("shell móvil y cabeceras por pantalla (issue #52)", () => {
  test.skip(
    !habilitado,
    "Se ejecuta explícitamente con E2E_BASELINE=1 en un entorno aislado.",
  );

  test("ningún título se trunca a 320/390/430px", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);

    for (const viewport of viewportsMovil) {
      await page.setViewportSize(viewport);
      for (const ruta of rutas) {
        await page.goto(ruta, { waitUntil: "networkidle" });
        const titulos = page.locator(".mob-cabecera-titulo");
        const total = await titulos.count();
        expect(total, `${ruta} debe traer su propia cabecera`).toBeGreaterThan(
          0,
        );
        for (let i = 0; i < total; i += 1) {
          const medidas = await titulos.nth(i).evaluate((el) => ({
            recortado: el.scrollWidth > el.clientWidth + 1,
            overflow: getComputedStyle(el).textOverflow,
            texto: el.textContent ?? "",
          }));
          expect(
            medidas.recortado,
            `${ruta} @ ${viewport.nombre}: "${medidas.texto}" se recorta`,
          ).toBe(false);
          expect(medidas.overflow).not.toBe("ellipsis");
        }
        const overflowX = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(
          overflowX,
          `${ruta} @ ${viewport.nombre} no debe tener overflow horizontal`,
        ).toBe(false);
      }
    }
    await context.close();
  });

  test("no hay chrome superior fijo en móvil", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);

    // `/ventas/nueva` queda fuera: SUPERADMIN no registra ventas y la ruta
    // redirige (`requireRol`). Su cabecera se revisa a mano con un vendedor.
    for (const ruta of rutas) {
      await page.goto(ruta, { waitUntil: "networkidle" });
      const fijosArriba = await page.evaluate(() =>
        Array.from(document.body.querySelectorAll<HTMLElement>("*"))
          .filter((el) => {
            const estilo = getComputedStyle(el);
            if (estilo.position !== "fixed" && estilo.position !== "sticky") {
              return false;
            }
            if (estilo.visibility === "hidden" || estilo.display === "none") {
              return false;
            }
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              return false;
            }
            // Solo interesa el chrome anclado al borde superior.
            return rect.top < 80;
          })
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
      );
      expect(
        fijosArriba,
        `${ruta} no debe anclar chrome al borde superior`,
      ).toEqual([]);
    }
    await context.close();
  });

  test("la cabecera reserva el safe area superior", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/ventas", { waitUntil: "networkidle" });

    const padding = await page
      .locator(".mob-cabecera")
      .first()
      .evaluate((el) => getComputedStyle(el).paddingTop);
    // Sin notch el `max()` cae en el mínimo del sistema (8px); con notch, en
    // el inset. Lo que se verifica es que la reserva existe y no es 0.
    expect(Number.parseFloat(padding)).toBeGreaterThanOrEqual(8);
    await context.close();
  });

  test("landscape: sin overflow horizontal ni recortes", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);

    for (const ruta of rutas) {
      await page.goto(ruta, { waitUntil: "networkidle" });
      const overflowX = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflowX, `${ruta} en landscape`).toBe(false);
    }
    await context.close();
  });

  test("back y acciones tienen nombre accesible y preservan historial", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);

    await page.goto("/ventas", { waitUntil: "networkidle" });
    // El avatar de la cabecera raíz es la entrada a la cuenta.
    await page
      .getByRole("link", { name: /^Tu cuenta:/ })
      .first()
      .click();
    await page.waitForURL("**/perfil");

    // Pantalla secundaria: back iconográfico anunciado como enlace.
    const back = page.getByRole("link", { name: "Volver" });
    await expect(back).toBeVisible();
    const caja = await back.boundingBox();
    expect(caja?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);

    await back.click();
    // Con historial propio vuelve a la pantalla anterior, no al fallback.
    await page.waitForURL("**/ventas");
    await context.close();
  });

  test("axe sin violaciones en raíz, secundaria y formulario", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);

    for (const ruta of ["/dashboard", "/perfil", "/perfil/password"]) {
      await page.goto(ruta, { waitUntil: "networkidle" });
      const resultado = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        resultado.violations.map((v) => `${ruta}: ${v.id}`),
        `axe en ${ruta}`,
      ).toEqual([]);
    }
    await context.close();
  });

  test("escritorio conserva su cabecera a 1024px", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/ventas", { waitUntil: "networkidle" });

    // Siguen en el DOM (`lg:hidden`), pero no se pintan a 1024px.
    await expect(page.locator(".mob-cabecera").first()).toBeHidden();
    await expect(
      page.getByRole("heading", { level: 1, name: "Ventas" }),
    ).toBeVisible();
    await context.close();
  });
});
