"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { resolverTransicionMovilPendiente } from "@/lib/transicion-movil";

/**
 * Cierra la transición lateral de navegación — issue #70 (PWA-MOTION-01).
 *
 * Montado una sola vez en el shell (después de `{children}`, ver
 * `(app)/layout.tsx`), por lo que su efecto se dispara después del de la
 * pantalla que acaba de montar: si esa pantalla restaura scroll con su
 * propio `requestAnimationFrame` (p. ej. `VentasClient`), el `rAF` de acá
 * se encola después y corre en el mismo frame, ya con el scroll en su
 * posición final. Ahí recién se toma la segunda foto de la view transition.
 *
 * Sin transición pendiente esto es un no-op: corre en cada cambio de ruta
 * del shell móvil, no sólo en las que participan de una transición.
 */
export function TransicionMovilResolver() {
  const pathname = usePathname();

  useEffect(() => {
    const frame = requestAnimationFrame(resolverTransicionMovilPendiente);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
