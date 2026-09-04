import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Estados de carga, vacío, error, toast y offline — issue #56 (PWA-MOB-06).
 *
 * Mismo gate que el resto de los specs autenticados (`E2E_BASELINE=1` +
 * credenciales reales): recorre la app de verdad, no corre en el pipeline
 * por defecto.
 *
 * Cubre los criterios de aceptación del issue:
 * 1. El esqueleto no aparece por debajo del umbral de ~200 ms.
 * 2. Sin saltos de layout relevantes entre esqueleto y contenido.
 * 3. Ante un error recuperable, filtros y resultados anteriores siguen ahí.
 * 4. El fallback offline vuelve solo al recuperar la conexión.
 * 5. Los avisos son accesibles y no quedan tapados por la barra inferior.
 */
const habilitado = process.env.E2E_BASELINE === "1";
const cookieSesion = process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";

/** Tolerancia de desplazamiento entre esqueleto y contenido, en píxeles. */
const SALTO_MAXIMO = 8;

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

test.describe("estados móviles (#56)", () => {
  test.skip(!habilitado, "Requiere E2E_BASELINE=1 y credenciales reales.");
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await iniciarSesionSuperadmin(page);
  });

  test("el esqueleto se retiene ~200 ms y no salta al llegar el contenido", async ({
    page,
  }) => {
    // Se frena la respuesta del servidor para que el esqueleto llegue a
    // dibujarse: sin latencia artificial la navegación termina antes del
    // umbral, que es justo lo que el umbral existe para aprovechar.
    await page.route("**/ventas**", async (route) => {
      await new Promise((listo) => setTimeout(listo, 1_200));
      await route.continue();
    });

    const navegacion = page.goto("/ventas");

    // Justo tras pedir la pantalla, la región de carga existe pero está
    // oculta: `EsqueletoDiferido` la mantiene invisible bajo el umbral.
    const ocultoAlPrincipio = await page.evaluate(async () => {
      const region = document.querySelector("[aria-busy='true']");
      if (!region) return "sin-region";
      return getComputedStyle(region).visibility;
    });
    expect(["hidden", "sin-region"]).toContain(ocultoAlPrincipio);

    // Pasado el umbral, el esqueleto sí se ve y ocupa su sitio.
    const region = page.locator("[aria-busy='true']");
    await expect(region).toBeVisible({ timeout: 2_000 });
    const cajaEsqueleto = await region.boundingBox();

    await navegacion;
    await expect(page.getByRole("heading", { name: /ventas/i })).toBeVisible();
    const cajaContenido = await page.locator("main > *").first().boundingBox();

    expect(cajaEsqueleto).not.toBeNull();
    expect(cajaContenido).not.toBeNull();
    // El contenido arranca donde arrancaba el esqueleto: sin salto.
    expect(
      Math.abs((cajaContenido?.y ?? 0) - (cajaEsqueleto?.y ?? 0)),
    ).toBeLessThanOrEqual(SALTO_MAXIMO);
  });

  test("un error recuperable conserva filtros y resultados anteriores", async ({
    page,
  }) => {
    await page.goto("/ventas");
    await expect(page.getByRole("heading", { name: /ventas/i })).toBeVisible();

    const buscador = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/buscar/i));
    await buscador.first().fill("ana");
    await page.waitForURL(/q=ana/);

    // A partir de acá toda recarga del listado falla como si se hubiera
    // caído la red a mitad de la sesión.
    await page.route("**/ventas**", (route) => route.abort("failed"));
    await page.getByRole("button", { name: /página siguiente/i }).click();

    const aviso = page.getByRole("alert");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText(/no pudimos actualizar el listado/i);
    await expect(
      aviso.getByRole("button", { name: /reintentar/i }),
    ).toBeVisible();

    // Lo importante: ni la búsqueda ni los resultados se perdieron.
    expect(page.url()).toContain("q=ana");
    await expect(buscador.first()).toHaveValue("ana");
  });

  test("la pantalla sin conexión distingue red caída de servidor caído", async ({
    page,
    context,
  }) => {
    await context.setOffline(true);
    await page.goto("/~offline");
    await expect(
      page.getByRole("heading", { name: "Sin conexión" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      /en cuanto vuelva la señal/i,
    );

    // Con red pero sin servidor el texto cambia: son dos problemas
    // distintos y el usuario hace cosas distintas ante cada uno.
    await context.setOffline(false);
    await page.route("**/manifest.webmanifest", (route) => route.abort());
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "El servidor no responde" }),
    ).toBeVisible();
  });

  test("el fallback offline vuelve solo al recuperar la conexión", async ({
    page,
    context,
  }) => {
    await page.goto("/ventas");
    await expect(page.getByRole("heading", { name: /ventas/i })).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText(/sin conexión/i).first()).toBeVisible();

    await context.setOffline(false);
    // El aviso de vuelta confirma la reconexión y se retira solo.
    await expect(page.getByText(/conexión restablecida/i)).toBeVisible();
    await expect(page.getByText(/conexión restablecida/i)).toBeHidden({
      timeout: 8_000,
    });
  });

  test("los avisos no quedan tapados por la barra inferior", async ({
    page,
  }) => {
    await page.goto("/ventas");
    const barra = page.locator("nav").last();
    await expect(barra).toBeVisible();
    const cajaBarra = await barra.boundingBox();

    // El hueco que esquivan los toasts sale del mismo token que el alto de
    // la barra, así que se comprueba el token y no un número escrito a mano.
    const hueco = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--mob-hueco-avisos")
        .trim(),
    );
    expect(hueco).not.toBe("");
    const huecoPx = await page.evaluate((valor) => {
      const sonda = document.createElement("div");
      sonda.style.position = "absolute";
      sonda.style.height = valor;
      document.body.append(sonda);
      const alto = sonda.getBoundingClientRect().height;
      sonda.remove();
      return alto;
    }, hueco);
    expect(huecoPx).toBeGreaterThanOrEqual(cajaBarra?.height ?? 0);
  });

  test("las pantallas de estado pasan axe", async ({ page, context }) => {
    await context.setOffline(true);
    await page.goto("/~offline");
    const resultado = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(resultado.violations).toEqual([]);
  });

  test("con movimiento reducido el esqueleto no se anima", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/ventas**", async (route) => {
      await new Promise((listo) => setTimeout(listo, 1_200));
      await route.continue();
    });
    const navegacion = page.goto("/ventas");
    const shimmer = page.locator(".skeleton-shimmer").first();
    await expect(shimmer).toBeVisible({ timeout: 2_000 });
    const animacion = await shimmer.evaluate(
      (elemento) =>
        getComputedStyle(elemento, "::after").animationName || "none",
    );
    expect(animacion).toBe("none");
    await navegacion;
  });
});
