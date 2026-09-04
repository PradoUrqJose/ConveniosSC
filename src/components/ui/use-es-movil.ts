"use client";

import { useSyncExternalStore } from "react";

/**
 * `true` por debajo de 1024px — el mismo corte que aísla todo el sistema
 * móvil en `globals.css` (`@media (max-width: 1023.98px)`, issue #51).
 *
 * Se lee con `useSyncExternalStore` en vez de `useEffect` + estado para que
 * React no pinte nunca un frame con el valor viejo al rotar el dispositivo
 * o al cambiar el tamaño de la ventana. El snapshot de servidor es `false`:
 * las capas se montan siempre después de una interacción, así que ese valor
 * no llega a pintarse, y si algún día se renderizara en el servidor caería
 * del lado del escritorio, que es el que no debe cambiar.
 */
export const CONSULTA_MOVIL = "(max-width: 1023.98px)";

function suscribir(alCambiar: () => void) {
  const consulta = window.matchMedia(CONSULTA_MOVIL);
  consulta.addEventListener("change", alCambiar);
  return () => consulta.removeEventListener("change", alCambiar);
}

export function useEsMovil(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA_MOVIL).matches,
    () => false,
  );
}
