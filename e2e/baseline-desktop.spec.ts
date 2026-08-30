import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const habilitado = process.env.E2E_BASELINE === "1";
const muestrasPorRuta = 11;
const cookieSesion = process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";
const viewports = [
  { nombre: "1024x768", width: 1024, height: 768 },
  { nombre: "1280x800", width: 1280, height: 800 },
  { nombre: "1440x900", width: 1440, height: 900 },
] as const;

type Credenciales = { usuario?: string; password?: string };
type MetricaRuta = {
  ruta: string;
  paginaMs: number[];
  cls: number[];
  layoutMs: number[];
  scriptMs: number[];
  rscBytes: number[];
  jsDashboardBytes: number[];
  axeViolaciones: number;
};

function credenciales(prefijo: string): Credenciales {
  return {
    usuario: process.env[`E2E_BASELINE_${prefijo}_USER`],
    password: process.env[`E2E_BASELINE_${prefijo}_PASSWORD`],
  };
}

async function iniciarSesion(page: Page, datos: Credenciales) {
  if (!datos.usuario || !datos.password) {
    throw new Error(
      "Define E2E_BASELINE_{VENDEDOR,ADMIN,SUPERADMIN}_{USER,PASSWORD}.",
    );
  }
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(datos.usuario);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(datos.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.some((cookie) => cookie.name === cookieSesion);
    })
    .toBe(true);
  // La cookie puede llegar antes de que el efecto cliente cambie de URL (sobre
  // todo durante HMR). Forzamos una navegación de documento para medir siempre
  // la misma sesión autenticada.
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/login/);
}

async function instalarMedidorCls(page: Page) {
  await page.addInitScript(() => {
    let cls = 0;
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) {
        const cambio = entrada as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (!cambio.hadRecentInput) cls += cambio.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
    Object.defineProperty(window, "__baselineCls", {
      get: () => cls,
      configurable: true,
    });
  });
}

async function medirRuta(
  page: Page,
  ruta: string,
): Promise<Omit<MetricaRuta, "ruta" | "axeViolaciones">> {
  let rscBytes = 0;
  let jsDashboardBytes = 0;
  const lecturas: Promise<void>[] = [];
  const respuesta = async (response: import("@playwright/test").Response) => {
    const tipo = response.headers()["content-type"] ?? "";
    const esRsc = tipo.includes("text/x-component");
    const esJsDashboard =
      ruta === "/dashboard" &&
      /\/_next\/static\/.*\.js(?:\?|$)/.test(response.url());
    if (!esRsc && !esJsDashboard) return;
    const cabecera = Number(response.headers()["content-length"] ?? 0);
    // Las redirecciones RSC no exponen cuerpo a Playwright. No cuentan como
    // payload de contenido; sólo medimos la respuesta final de la navegación.
    if (!cabecera && response.status() >= 300 && response.status() < 400)
      return;
    let bytes = cabecera;
    if (!bytes) {
      try {
        bytes = (await response.body()).byteLength;
      } catch {
        // Algunas respuestas se cancelan al cambiar de ruta y no exponen
        // cuerpo; no deben invalidar toda la captura del baseline.
        return;
      }
    }
    if (esRsc) rscBytes += bytes;
    if (esJsDashboard) jsDashboardBytes += bytes;
  };
  const alResponder = (response: import("@playwright/test").Response) =>
    lecturas.push(respuesta(response));
  page.on("response", alResponder);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const inicio = performance.now();
  await page.goto(ruta, { waitUntil: "networkidle" });
  const paginaMs = performance.now() - inicio;
  const metricas = (await cdp.send("Performance.getMetrics")) as {
    metrics: Array<{ name: string; value: number }>;
  };
  await Promise.all(lecturas);
  page.off("response", alResponder);
  await cdp.detach();
  const valor = (nombre: string) =>
    metricas.metrics.find((metrica) => metrica.name === nombre)?.value ?? 0;
  const cls = await page.evaluate(() =>
    Number((window as Window & { __baselineCls?: number }).__baselineCls ?? 0),
  );
  // Una navegación de documento no solicita Flight/RSC. Hacemos además una
  // transición cliente desde una ruta intermedia y medimos su respuesta
  // text/x-component, sin mezclarla con el tiempo de página anterior.
  let rscFlightBytes = 0;
  const rutaIntermedia =
    ruta === "/" || ruta === "/dashboard" ? "/ventas" : "/";
  await page.goto(rutaIntermedia, { waitUntil: "networkidle" });
  const vuelo = async (response: import("@playwright/test").Response) => {
    if (
      !(response.headers()["content-type"] ?? "").includes("text/x-component")
    ) {
      return;
    }
    const cabecera = Number(response.headers()["content-length"] ?? 0);
    try {
      rscFlightBytes += cabecera || (await response.body()).byteLength;
    } catch {
      // Las respuestas RSC redirigidas no tienen cuerpo disponible.
    }
  };
  const vuelos: Promise<void>[] = [];
  const alVolar = (response: import("@playwright/test").Response) => {
    vuelos.push(vuelo(response));
  };
  page.on("response", alVolar);
  await Promise.all([
    page.waitForURL((url) => url.pathname === ruta),
    page.locator(`a[href="${ruta}"]`).first().click(),
  ]);
  await page.waitForLoadState("networkidle");
  await Promise.all(vuelos);
  page.off("response", alVolar);
  return {
    paginaMs: [paginaMs],
    cls: [cls],
    layoutMs: [valor("LayoutDuration") * 1000],
    scriptMs: [valor("ScriptDuration") * 1000],
    rscBytes: [rscFlightBytes || rscBytes],
    jsDashboardBytes: [jsDashboardBytes],
  };
}

function percentil(valores: number[], p: number) {
  const ordenados = [...valores].sort((a, b) => a - b);
  return (
    ordenados[
      Math.min(ordenados.length - 1, Math.ceil(ordenados.length * p) - 1)
    ] ?? 0
  );
}

async function guardarReporte(info: TestInfo, resultados: MetricaRuta[]) {
  const reporte = resultados.map((resultado) => ({
    ruta: resultado.ruta,
    muestras: resultado.paginaMs.length,
    p50PaginaMs: percentil(resultado.paginaMs, 0.5),
    p95PaginaMs: percentil(resultado.paginaMs, 0.95),
    p50Cls: percentil(resultado.cls, 0.5),
    p95Cls: percentil(resultado.cls, 0.95),
    p50LayoutMs: percentil(resultado.layoutMs, 0.5),
    p50HidratacionScriptMs: percentil(resultado.scriptMs, 0.5),
    rscBytes: Math.max(...resultado.rscBytes),
    jsDashboardBytes: Math.max(...resultado.jsDashboardBytes),
    axeViolaciones: resultado.axeViolaciones,
  }));
  const destino = path.join(
    process.cwd(),
    "artifacts",
    "baseline",
    "antes.json",
  );
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, `${JSON.stringify(reporte, null, 2)}\n`);
  await info.attach("baseline-antes", {
    body: JSON.stringify(reporte, null, 2),
    contentType: "application/json",
  });
}

test.describe("baseline desktop antes del rediseño", () => {
  test.skip(
    !habilitado,
    "Se ejecuta explícitamente con E2E_BASELINE=1 en un entorno aislado.",
  );
  test.describe.configure({ mode: "serial" });
  test.setTimeout(10 * 60 * 1_000);

  test("captura rutas, modales, accesibilidad y métricas", async ({
    browser,
  }, testInfo) => {
    const escenarios = [
      {
        rol: "vendedor",
        credenciales: credenciales("VENDEDOR"),
        rutas: ["/", "/ventas/nueva", "/ventas"],
      },
      {
        rol: "admin",
        credenciales: credenciales("ADMIN"),
        rutas: ["/dashboard"],
      },
      {
        rol: "superadmin",
        credenciales: credenciales("SUPERADMIN"),
        rutas: ["/auditoria"],
      },
    ] as const;
    const resultados: MetricaRuta[] = [];

    for (const escenario of escenarios) {
      const context = await browser.newContext({
        viewport: viewports[2],
        colorScheme: "light",
      });
      const page = await context.newPage();
      await instalarMedidorCls(page);
      await iniciarSesion(page, escenario.credenciales);

      for (const ruta of escenario.rutas) {
        const medicion: MetricaRuta = {
          ruta,
          paginaMs: [],
          cls: [],
          layoutMs: [],
          scriptMs: [],
          rscBytes: [],
          jsDashboardBytes: [],
          axeViolaciones: 0,
        };
        for (let i = 0; i < muestrasPorRuta; i += 1) {
          const muestra = await medirRuta(page, ruta);
          Object.assign(
            medicion,
            Object.fromEntries(
              Object.entries(muestra).map(([clave, valores]) => [
                clave,
                [
                  ...medicion[
                    clave as keyof Omit<MetricaRuta, "ruta" | "axeViolaciones">
                  ],
                  ...valores,
                ],
              ]),
            ),
          );
        }
        const axe = await new AxeBuilder({ page }).analyze();
        medicion.axeViolaciones = axe.violations.length;
        resultados.push(medicion);

        for (const viewport of viewports) {
          for (const colorScheme of ["light", "dark"] as const) {
            await page.setViewportSize(viewport);
            await page.emulateMedia({ colorScheme });
            await page.goto(ruta, { waitUntil: "networkidle" });
            await page.screenshot({
              path: testInfo.outputPath(
                `antes-${escenario.rol}-${ruta.replaceAll("/", "-") || "inicio"}-${viewport.nombre}-${colorScheme}.png`,
              ),
              fullPage: true,
            });
          }
        }
      }

      await context.close();
    }
    await guardarReporte(testInfo, resultados);
  });

  async function capturarModal(
    browser: import("@playwright/test").Browser,
    testInfo: TestInfo,
    tipo: "largo" | "destructivo" | "corto" | "password-temporal",
  ) {
    const usuarioTemporal = process.env.E2E_BASELINE_PASSWORD_TARGET;
    if (!usuarioTemporal)
      throw new Error("Define E2E_BASELINE_PASSWORD_TARGET.");
    const context = await browser.newContext({
      viewport: viewports[2],
      colorScheme: "light",
    });
    const page = await context.newPage();
    await iniciarSesion(page, credenciales("SUPERADMIN"));
    await page.goto(`/usuarios?q=${encodeURIComponent(usuarioTemporal)}`, {
      waitUntil: "domcontentloaded",
    });
    const tarjeta = page
      .getByText(`@${usuarioTemporal}`, { exact: true })
      .locator("xpath=ancestor::div[.//button][1]");
    if (tipo === "largo") {
      await page.getByRole("button", { name: "Crear usuario" }).click();
    } else if (tipo === "destructivo") {
      await tarjeta.getByRole("button", { name: "Desactivar" }).click();
    } else {
      await tarjeta.getByRole("button", { name: "Restablecer" }).click();
      if (tipo === "password-temporal") {
        await page
          .getByRole("button", { name: "Restablecer contraseña" })
          .click();
        await expect(page.getByText("Usuario listo")).toBeVisible();
      }
    }
    await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible();
    const axe = await new AxeBuilder({ page }).analyze();
    await testInfo.attach(`axe-modal-${tipo}`, {
      body: JSON.stringify(axe, null, 2),
      contentType: "application/json",
    });
    await page.screenshot({
      path: testInfo.outputPath(`antes-modal-${tipo}.png`),
    });
  }

  for (const tipo of [
    "largo",
    "destructivo",
    "corto",
    "password-temporal",
  ] as const) {
    test(`captura modal ${tipo}`, async ({ browser }, testInfo) => {
      await capturarModal(browser, testInfo, tipo);
    });
  }
});
