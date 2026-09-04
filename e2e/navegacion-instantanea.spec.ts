import { expect, test, type Page } from "@playwright/test";
import { instant } from "@next/playwright";

const habilitado = process.env.E2E_BASELINE === "1";
const cookieSesion = process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";

async function iniciarSesionAdmin(page: Page) {
  const usuario = process.env.E2E_BASELINE_ADMIN_USER;
  const password = process.env.E2E_BASELINE_ADMIN_PASSWORD;
  if (!usuario || !password)
    throw new Error(
      "Define E2E_BASELINE_ADMIN_USER y E2E_BASELINE_ADMIN_PASSWORD.",
    );
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(usuario);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((c) => c.name === cookieSesion),
    )
    .toBe(true);
}

test.describe("navegación instantánea (issue #58)", () => {
  test.skip(!habilitado, "Requiere credenciales aisladas de E2E_BASELINE=1.");

  test("dashboard → ventas → dashboard muestra el shell antes de los datos", async ({
    page,
  }) => {
    await iniciarSesionAdmin(page);
    await page.goto("/dashboard");

    await instant(page, async () => {
      await page.locator('a[href="/ventas"]').first().click();
      await page.waitForURL("**/ventas");
      await expect(
        page.locator('[data-navigation-shell="ventas"]'),
      ).toBeVisible();
    });
    await expect(page.getByRole("heading", { name: "Ventas" })).toBeVisible();

    await instant(page, async () => {
      await page.locator('a[href="/dashboard"]').first().click();
      await page.waitForURL("**/dashboard");
      await expect(
        page.locator('[data-navigation-shell="dashboard"]'),
      ).toBeVisible();
    });
  });
});
