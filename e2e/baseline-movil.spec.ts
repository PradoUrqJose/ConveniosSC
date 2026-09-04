import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const habilitado = process.env.E2E_BASELINE === "1";
const cookieSesion = process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";
const redes = [
  { nombre: "wifi", download: -1, upload: -1, latency: 20 },
  {
    nombre: "4g-limitada",
    download: (1_600 * 1024) / 8,
    upload: (750 * 1024) / 8,
    latency: 150,
  },
] as const;
const dispositivos = [
  { nombre: "android-medio-320", width: 320, height: 720, dpr: 2, movil: true },
  { nombre: "android-medio-390", width: 390, height: 844, dpr: 2, movil: true },
  { nombre: "iphone-430", width: 430, height: 932, dpr: 3, movil: true },
] as const;
const escenarios = [
  { rol: "VENDEDOR", ruta: "/", prefijo: "VENDEDOR" },
  { rol: "VENDEDOR", ruta: "/ventas", prefijo: "VENDEDOR" },
  { rol: "ADMIN_EMPRESA", ruta: "/dashboard", prefijo: "ADMIN" },
  { rol: "SUPERADMIN", ruta: "/auditoria", prefijo: "SUPERADMIN" },
] as const;

type Muestra = {
  ruta: string;
  rol: string;
  dispositivo: string;
  red: string;
  tipo: "fria" | "caliente";
  ttfbMs: number;
  fcpMs: number;
  lcpMs: number;
  inpMs: number;
  cls: number;
  shellMs: number;
  datosMs: number;
  rscBytes: number;
  jsBytes: number;
  apiMs: number;
  adjuntoMs: number;
  layoutMs: number;
  scriptMs: number;
};

async function iniciarSesion(page: Page, prefijo: string) {
  const usuario = process.env[`E2E_BASELINE_${prefijo}_USER`];
  const password = process.env[`E2E_BASELINE_${prefijo}_PASSWORD`];
  if (!usuario || !password) throw new Error(`Faltan credenciales ${prefijo}.`);
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

async function instalarObservadores(page: Page) {
  await page.addInitScript(() => {
    const datos = { fcp: 0, lcp: 0, inp: 0, cls: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) datos.fcp = e.startTime;
    }).observe({ type: "paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) datos.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        const x = e as PerformanceEntry & {
          value?: number;
          hadRecentInput?: boolean;
        };
        if (!x.hadRecentInput) datos.cls += x.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        const x = e as PerformanceEntry & { duration?: number };
        datos.inp = Math.max(datos.inp, x.duration ?? 0);
      }
    }).observe({
      type: "event",
      buffered: true,
      durationThreshold: 16,
    } as PerformanceObserverInit);
    Object.defineProperty(window, "__perfMobile", { value: datos });
  });
}

async function medir(
  page: Page,
  ruta: string,
  tipo: Muestra["tipo"],
  datos: Omit<
    Muestra,
    | "tipo"
    | "ttfbMs"
    | "fcpMs"
    | "lcpMs"
    | "inpMs"
    | "cls"
    | "shellMs"
    | "datosMs"
    | "rscBytes"
    | "jsBytes"
    | "apiMs"
    | "adjuntoMs"
    | "layoutMs"
    | "scriptMs"
  >,
): Promise<Muestra> {
  const recursos = { rscBytes: 0, jsBytes: 0, apiMs: 0, adjuntoMs: 0 };
  const alResponder = async (
    respuesta: import("@playwright/test").Response,
  ) => {
    const tipoContenido = respuesta.headers()["content-type"] ?? "";
    const bytes = Number(respuesta.headers()["content-length"] ?? 0);
    if (tipoContenido.includes("text/x-component")) recursos.rscBytes += bytes;
    if (/\/_next\/static\/.*\.js/.test(respuesta.url()))
      recursos.jsBytes += bytes;
    // Playwright no expone timings en Response; las duraciones de API y
    // adjuntos se leen de Resource Timing al finalizar la navegación.
  };
  page.on("response", alResponder);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const inicio = performance.now();
  await page.goto(ruta, { waitUntil: "networkidle" });
  await page.locator("main[data-perf-shell]").waitFor();
  await page.locator("h1").first().waitFor();
  const shellMs = performance.now() - inicio;
  const metricas = (await cdp.send("Performance.getMetrics")) as {
    metrics: Array<{ name: string; value: number }>;
  };
  const navegador = (await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    const recursosCliente = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    return {
      ...(window as unknown as { __perfMobile: object }).__perfMobile,
      ttfb: nav?.responseStart ?? 0,
      apiMs: recursosCliente
        .filter((r) => r.name.includes("/api/"))
        .reduce((total, r) => total + r.duration, 0),
      adjuntoMs: recursosCliente
        .filter((r) => /\.(pdf|png|jpe?g|webp)(?:$|\?)/i.test(r.name))
        .reduce((total, r) => total + r.duration, 0),
    };
  })) as {
    fcp: number;
    lcp: number;
    inp: number;
    cls: number;
    ttfb: number;
    apiMs: number;
    adjuntoMs: number;
  };
  const valor = (nombre: string) =>
    metricas.metrics.find((m) => m.name === nombre)?.value ?? 0;
  page.off("response", alResponder);
  await cdp.detach();
  return {
    ...datos,
    tipo,
    ttfbMs: navegador.ttfb,
    fcpMs: navegador.fcp,
    lcpMs: navegador.lcp,
    inpMs: navegador.inp,
    cls: navegador.cls,
    shellMs,
    datosMs: shellMs,
    ...recursos,
    apiMs: navegador.apiMs,
    adjuntoMs: navegador.adjuntoMs,
    layoutMs: valor("LayoutDuration") * 1000,
    scriptMs: valor("ScriptDuration") * 1000,
  };
}

test.describe("baseline móvil de producción", () => {
  test.skip(!habilitado, "Requiere E2E_BASELINE=1 y una base aislada.");
  test.setTimeout(25 * 60 * 1000);
  test("publica tres frías y cinco calientes por ruta, red y dispositivo", async ({
    browser,
  }, info) => {
    const muestras: Muestra[] = [];
    for (const dispositivo of dispositivos)
      for (const red of redes)
        for (const escenario of escenarios) {
          const context = await browser.newContext({
            viewport: dispositivo,
            deviceScaleFactor: dispositivo.dpr,
            isMobile: dispositivo.movil,
          });
          const page = await context.newPage();
          await instalarObservadores(page);
          const cdp = await context.newCDPSession(page);
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: red.latency,
            downloadThroughput: red.download,
            uploadThroughput: red.upload,
            connectionType: red.nombre === "wifi" ? "wifi" : "cellular4g",
          });
          await iniciarSesion(page, escenario.prefijo);
          for (let i = 0; i < 3; i += 1)
            muestras.push(
              await medir(page, escenario.ruta, "fria", {
                ruta: escenario.ruta,
                rol: escenario.rol,
                dispositivo: dispositivo.nombre,
                red: red.nombre,
              }),
            );
          for (let i = 0; i < 5; i += 1)
            muestras.push(
              await medir(page, escenario.ruta, "caliente", {
                ruta: escenario.ruta,
                rol: escenario.rol,
                dispositivo: dispositivo.nombre,
                red: red.nombre,
              }),
            );
          await cdp.detach();
          await context.close();
        }
    const destino = path.join(
      process.cwd(),
      "artifacts",
      "performance",
      "movil.json",
    );
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, `${JSON.stringify(muestras, null, 2)}\n`);
    await info.attach("baseline-movil", {
      body: JSON.stringify(muestras, null, 2),
      contentType: "application/json",
    });
  });
});
