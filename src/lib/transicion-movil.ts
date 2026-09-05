/**
 * Transición lateral de navegación — issue #70 (PWA-MOTION-01), doc §11.
 *
 * Usa la View Transitions API nativa del navegador (no el `<ViewTransition>`
 * de React: esta app corre React 19.2.8 estable, no el canary que trae esa
 * API declarativa — ver el comentario en `docs/17-TOKENS-GEOMETRIA-MOVIL.md`
 * sobre no asumir el Next.js de siempre). El estado vive fuera de React por
 * el mismo motivo que `barra-scroll.ts`: es un singleton de módulo, no de
 * componente, porque el "click" que inicia la transición y el "mount" que la
 * resuelve ocurren en pantallas distintas.
 *
 * Flujo:
 * 1. `iniciarTransicionMovil(tipo)` se llama en el `onClick` del enlace que
 *    navega. Toma la foto de la pantalla actual en el mismo frame del clic
 *    y deja la promesa "pendiente" — la nueva pantalla decide cuándo se
 *    toma la segunda foto.
 * 2. La pantalla destino resuelve esa promesa cuando ya terminó su propio
 *    ajuste de layout (p. ej. restaurar scroll): `TransicionMovilResolver`,
 *    montado una sola vez en el shell, lo hace automáticamente tras cada
 *    cambio de ruta.
 *
 * Si la navegación nunca llega a una pantalla que resuelva (error, ruta
 * fuera del shell móvil, `notFound()`), un tope de seguridad libera la
 * transición para que la API no quede señalando "en curso" para siempre.
 */

export type DireccionTransicionMovil = "adelante" | "atras";

/** Tope de vida de una transición sin resolver — ver comentario arriba. */
const ESPERA_MAX_TRANSICION_MS = 1500;

let resolverPendiente: (() => void) | null = null;
let topeSeguridad: ReturnType<typeof setTimeout> | null = null;

function limpiarPendiente() {
  if (topeSeguridad !== null) {
    clearTimeout(topeSeguridad);
    topeSeguridad = null;
  }
  resolverPendiente = null;
}

/**
 * Sólo en móvil (breakpoint aislado del desktop, igual que el resto del
 * sistema `--mob-*`), con soporte del navegador y sin `prefers-reduced-
 * motion`: ahí es donde el movimiento explica algo y no compite con la
 * mano del usuario.
 */
export function puedeTransicionarMovil(): boolean {
  if (typeof document === "undefined") return false;
  if (typeof document.startViewTransition !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  return window.matchMedia("(max-width: 1023.98px)").matches;
}

/**
 * Se llama en el `onClick` del enlace, antes de que la navegación real
 * ocurra: `startViewTransition` captura la pantalla actual de forma
 * síncrona en esta misma llamada.
 */
export function iniciarTransicionMovil(
  direccion: DireccionTransicionMovil,
): void {
  if (!puedeTransicionarMovil()) return;
  // Una transición sin resolver (navegación abortada, doble clic) no debe
  // acumular fotos viejas: se libera antes de empezar la siguiente.
  resolverPendiente?.();
  limpiarPendiente();

  document.documentElement.dataset.mobTransicion = direccion;
  const transicion = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        resolverPendiente = resolve;
        topeSeguridad = setTimeout(() => {
          resolverPendiente = null;
          resolve();
        }, ESPERA_MAX_TRANSICION_MS);
      }),
  );
  void transicion.finished
    .catch(() => {})
    .finally(() => {
      delete document.documentElement.dataset.mobTransicion;
    });
}

/**
 * Libera la transición pendiente, si hay una. Lo llama la pantalla destino
 * una vez que ya aplicó su propio ajuste (p. ej. scroll restaurado), para
 * que la "foto nueva" de la view transition salga correcta. Sin transición
 * pendiente, es un no-op seguro de llamar en cada navegación.
 */
export function resolverTransicionMovilPendiente(): void {
  resolverPendiente?.();
  limpiarPendiente();
}
