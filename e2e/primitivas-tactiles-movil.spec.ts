import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Primitivas táctiles, inputs y movimiento reducido — issue #55 (PWA-MOB-05).
 *
 * Mismo gate que el resto de los specs autenticados (`E2E_BASELINE=1` +
 * credenciales reales): recorre la app de verdad, no corre en el pipeline
 * por defecto.
 *
 * Cubre los criterios de aceptación del issue:
 * 1. Cero targets propios menores de 44x44 en las 15 rutas, a 320/390/430px.
 * 2. Cero campos por debajo de 16px (el umbral exacto a partir del cual
 *    Safari iOS hace zoom al enfocar y descuadra el formulario).
 * 3. Cero avisos de Base UI por semántica de botón en consola.
 * 4. Foco visible y orden lógico con teclado.
 * 5. Reduced motion sin desplazamientos ni shimmer.
 * 6. Escritorio a 1024px sin cambios: ninguna de estas reglas existe ahí.
 */
const habilitado =
  process.env.E2E_BASELINE === "1" || process.env.E2E_QA_CONTRACT === "1";
const cookieSesion = process.env.SESSION_COOKIE_NAME ?? "convenios_sesion";

const viewports = [
  { nombre: "320x720", width: 320, height: 720 },
  { nombre: "390x844", width: 390, height: 844 },
  { nombre: "430x932", width: 430, height: 932 },
] as const;

/** Las 15 rutas de la auditoría (docs/16-AUDITORIA-PWA-MOBILE-2026.html). */
const rutas = [
  "/",
  "/dashboard",
  "/ventas",
  "/ventas/nueva",
  "/empleados",
  "/sedes",
  "/admin/empresas",
  "/admin/convenios",
  "/usuarios",
  "/auditoria",
  "/perfil",
  "/perfil/password",
  "/estilo-movil",
  "/login",
  "/~offline",
] as const;

const TOQUE_MINIMO = 44;

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

/**
 * Mide todo control visible de la página y devuelve el que no llega a
 * 44x44. Se ignoran:
 *
 * - lo invisible (`display:none`, tamaño cero, `visibility`), que no es un
 *   objetivo táctil;
 * - los enlaces dentro de un párrafo, que WCAG 2.2 exenta explícitamente
 *   por estar "en línea con el texto" (1.4.11 nota "inline");
 * - lo marcado con `data-toque="compacto"`, el único escape hatch del
 *   sistema, que es grepeable justamente para poder revisarlo.
 */
async function targetsPequenos(page: Page) {
  return page.evaluate((minimo) => {
    const selector = [
      "button",
      "a[href]",
      "select",
      "summary",
      "input:not([type=hidden])",
      "textarea",
      "[role=button]",
      "[role=tab]",
      "[role=switch]",
      "[role=checkbox]",
      "[role=radio]",
      "[role=menuitem]",
      "[role=option]",
    ].join(",");
    const problemas: {
      etiqueta: string;
      ancho: number;
      alto: number;
      texto: string;
    }[] = [];
    for (const elemento of Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    )) {
      if (elemento.closest("[data-toque='compacto']")) continue;
      const estilo = getComputedStyle(elemento);
      if (estilo.visibility === "hidden" || estilo.display === "none") continue;
      // Enlace en línea con el texto: exención explícita de WCAG 2.2.
      if (
        elemento.tagName === "A" &&
        estilo.display.startsWith("inline") &&
        elemento.closest("p")
      ) {
        continue;
      }
      const caja = elemento.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) continue;
      // El área real incluye el pseudo-elemento con el que checkbox y
      // switch extienden su hit area sin deformar el dibujo.
      const despues = getComputedStyle(elemento, "::after");
      const anchoExtra = Number.parseFloat(despues.width) || 0;
      const altoExtra = Number.parseFloat(despues.height) || 0;
      const ancho = Math.max(caja.width, anchoExtra);
      const alto = Math.max(caja.height, altoExtra);
      if (ancho + 0.5 < minimo || alto + 0.5 < minimo) {
        problemas.push({
          etiqueta: `${elemento.tagName.toLowerCase()}.${elemento.className}`,
          ancho: Math.round(ancho),
          alto: Math.round(alto),
          texto: (elemento.textContent ?? "").trim().slice(0, 40),
        });
      }
    }
    return problemas;
  }, TOQUE_MINIMO);
}

/** Campos con menos de 16px: el umbral del zoom automático de Safari iOS. */
async function camposConZoom(page: Page) {
  return page.evaluate(() => {
    const campos = Array.from(
      document.querySelectorAll<HTMLElement>(
        "input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea",
      ),
    );
    return campos
      .map((campo) => ({
        etiqueta: `${campo.tagName.toLowerCase()}#${campo.id || "(sin id)"}`,
        px: Number.parseFloat(getComputedStyle(campo).fontSize),
      }))
      .filter((campo) => campo.px < 16);
  });
}

test.describe("primitivas táctiles móviles (issue #55)", () => {
  test.skip(
    !habilitado,
    "Se ejecuta explícitamente con E2E_BASELINE=1 en un entorno aislado.",
  );
  test.setTimeout(180_000);

  test("cero targets menores de 44x44 en las 15 rutas", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);

    const fallos: string[] = [];
    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      for (const ruta of rutas) {
        await page.goto(ruta, { waitUntil: "networkidle" });
        for (const problema of await targetsPequenos(page)) {
          fallos.push(
            `${ruta} @${viewport.nombre}: ${problema.ancho}x${problema.alto} — ${problema.texto || problema.etiqueta}`,
          );
        }
      }
    }
    expect(fallos, fallos.join("\n")).toEqual([]);
    await context.close();
  });

  test("ningún campo baja de 16px (sin zoom en Safari iOS)", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);

    const fallos: string[] = [];
    for (const ruta of rutas) {
      await page.goto(ruta, { waitUntil: "networkidle" });
      for (const campo of await camposConZoom(page)) {
        fallos.push(`${ruta}: ${campo.etiqueta} a ${campo.px}px`);
      }
    }
    expect(fallos, fallos.join("\n")).toEqual([]);
    await context.close();
  });

  test("la consola no trae avisos de semántica de Base UI", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const avisos: string[] = [];
    page.on("console", (mensaje) => {
      if (mensaje.type() !== "error" && mensaje.type() !== "warning") return;
      const texto = mensaje.text();
      if (/nativeButton|native button|Base UI/i.test(texto)) {
        avisos.push(texto);
      }
    });
    await iniciarSesionSuperadmin(page);
    for (const ruta of rutas) {
      await page.goto(ruta, { waitUntil: "networkidle" });
    }
    expect(avisos, avisos.join("\n")).toEqual([]);
    await context.close();
  });

  test("axe no encuentra violaciones en las rutas críticas", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);

    for (const ruta of [
      "/empleados",
      "/ventas/nueva",
      "/perfil",
      "/auditoria",
    ]) {
      await page.goto(ruta, { waitUntil: "networkidle" });
      const resultado = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        resultado.violations.map((violacion) => `${ruta}: ${violacion.id}`),
      ).toEqual([]);
    }
    await context.close();
  });

  test("el foco es visible y avanza en orden con el teclado", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/empleados", { waitUntil: "networkidle" });

    // El foco avanza hacia abajo/derecha: el orden de tabulación sigue al
    // orden visual, no al orden en que se montaron los componentes.
    let anterior = -1;
    const recorridos: string[] = [];
    for (let paso = 0; paso < 12; paso += 1) {
      await page.keyboard.press("Tab");
      const foco = await page.evaluate(() => {
        const elemento = document.activeElement as HTMLElement | null;
        if (!elemento || elemento === document.body) return null;
        const caja = elemento.getBoundingClientRect();
        const estilo = getComputedStyle(elemento);
        return {
          etiqueta: elemento.tagName.toLowerCase(),
          top: Math.round(caja.top + window.scrollY),
          alto: caja.height,
          ancho: caja.width,
          // Anillo propio o el que ponga el navegador: cualquiera sirve,
          // lo que no puede pasar es que no haya ninguno.
          anillo:
            estilo.outlineStyle !== "none" &&
            Number.parseFloat(estilo.outlineWidth) > 0,
        };
      });
      if (!foco) break;
      recorridos.push(foco.etiqueta);
      expect(foco.anillo, `sin anillo de foco en <${foco.etiqueta}>`).toBe(
        true,
      );
      expect(Math.min(foco.alto, foco.ancho)).toBeGreaterThanOrEqual(
        TOQUE_MINIMO - 0.5,
      );
      expect(
        foco.top,
        `el foco retrocedió en <${foco.etiqueta}>`,
      ).toBeGreaterThanOrEqual(anterior - 1);
      anterior = foco.top;
    }
    expect(recorridos.length).toBeGreaterThan(3);
    await context.close();
  });

  test("reduced motion apaga desplazamientos y shimmer", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/empleados", { waitUntil: "networkidle" });

    const movimiento = await page.evaluate(() => {
      const elementos = Array.from(
        document.querySelectorAll<HTMLElement>("body *"),
      );
      const enMs = (valor: string) =>
        valor
          .split(",")
          .map((parte) =>
            parte.trim().endsWith("ms")
              ? Number.parseFloat(parte)
              : Number.parseFloat(parte) * 1000,
          );
      let transicionesLargas = 0;
      let animacionesVivas = 0;
      for (const elemento of elementos) {
        const estilo = getComputedStyle(elemento);
        if (enMs(estilo.transitionDuration).some((ms) => ms > 1)) {
          transicionesLargas += 1;
        }
        if (
          estilo.animationName !== "none" &&
          enMs(estilo.animationDuration).some((ms) => ms > 1)
        ) {
          animacionesVivas += 1;
        }
      }
      return { transicionesLargas, animacionesVivas };
    });
    expect(movimiento.transicionesLargas).toBe(0);
    expect(movimiento.animacionesVivas).toBe(0);

    // La barra inferior no se esconde deslizando: sigue en su sitio.
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);
    const barra = page.locator(".mob-barra-inferior");
    if (await barra.count()) {
      const transform = await barra.evaluate(
        (el) => getComputedStyle(el).transform,
      );
      expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
    }
    await context.close();
  });

  test("a 1024px el escritorio no ve ninguna de estas reglas", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
    });
    const page = await context.newPage();
    await iniciarSesionSuperadmin(page);
    await page.goto("/empleados", { waitUntil: "networkidle" });

    // Las acciones de fila del escritorio siguen midiendo lo aprobado
    // (28px, `size="icon-sm"`): si esto crece, la red de seguridad móvil
    // se filtró al escritorio.
    const alto = await page.evaluate(() => {
      const boton = document.querySelector<HTMLElement>(
        "[data-slot=button][data-size='icon-sm']",
      );
      return boton?.getBoundingClientRect().height ?? null;
    });
    if (alto !== null) expect(alto).toBeLessThan(40);

    const fuente = await page.evaluate(() => {
      const campo = document.querySelector<HTMLElement>("[data-slot=input]");
      return campo ? getComputedStyle(campo).fontSize : null;
    });
    if (fuente !== null) expect(fuente).toBe("14px");

    await context.close();
  });
});
