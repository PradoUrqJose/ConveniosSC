import { expect, test } from "@playwright/test";

/** Credenciales y datos de prueba creados por el seed de CI, nunca de producción. */
const vendedor = {
  usuario: process.env.E2E_VENDEDOR ?? "vendedor.sc",
  password: process.env.E2E_PASSWORD ?? "Temporal123",
};
const administrador = {
  usuario: process.env.E2E_ADMIN_USER ?? "",
  password: process.env.E2E_ADMIN_PASSWORD ?? vendedor.password,
};

async function iniciarSesion(
  page: import("@playwright/test").Page,
  credenciales = vendedor,
) {
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(credenciales.usuario);
  await page.getByLabel("Contraseña").fill(credenciales.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/login/);
}

test("venta con empleado existente aparece en el listado", async ({ page }) => {
  await iniciarSesion(page);
  await page.goto("/ventas/nueva");
  let solicitudesPost = 0;
  page.on("request", (request) => {
    if (request.method() === "POST") solicitudesPost += 1;
  });
  await page
    .getByLabel("Documento del empleado")
    .fill(process.env.E2E_DNI_EXISTENTE ?? "45678912");
  await page.waitForTimeout(400);
  expect(solicitudesPost).toBe(0);
  await expect(page.getByLabel("Empresa convenio")).toHaveValue("");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect.poll(() => solicitudesPost).toBe(1);
  await expect(page.getByText(/descuento/i)).toBeVisible();
  await page.getByLabel("Monto de venta (S/)").fill("120.00");
  await page
    .getByLabel(/Documento de venta/i)
    .setInputFiles("public/icons/192.png");
  await page.getByRole("button", { name: /guardar venta/i }).click();
  await expect(page.getByText(/venta registrada/i)).toBeVisible();
  await page.goto("/ventas");
  await expect(page.getByText("120.00")).toBeVisible();
});

test("el vendedor no puede crear un empleado desde el punto de venta", async ({
  page,
}) => {
  await iniciarSesion(page);
  await page.goto("/ventas/nueva");
  await page
    .getByLabel("Documento del empleado")
    .fill(process.env.E2E_DNI_NUEVO ?? "87654321");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText(/solicita a un administrador/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /crear empleado/i }),
  ).toHaveCount(0);
});

test("una venta conserva el descuento histórico tras cambiar el convenio", async ({
  page,
}) => {
  test.skip(!process.env.E2E_ADMIN_USER, "Requiere administrador seed de CI.");
  await iniciarSesion(page, administrador);
  await page.goto("/admin/convenios");
  await page
    .getByRole("button", { name: /cambiar descuentos/i })
    .first()
    .click();
  await page
    .getByLabel(/descuento/i)
    .first()
    .fill("12");
  await page.getByRole("button", { name: /guardar/i }).click();
  await page.goto("/ventas/nueva");
  await page
    .getByLabel("Documento del empleado")
    .fill(process.env.E2E_DNI_EXISTENTE ?? "45678912");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText(/12% de descuento/i)).toBeVisible();
  await page.goto("/ventas");
  await page
    .getByRole("link", { name: /ver detalle/i })
    .last()
    .click();
  await expect(page.getByText(/15%|descuento aplicado/i)).toBeVisible();
});
