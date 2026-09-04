"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { PerfilNav } from "@/lib/auth/perfil";
import type { RolUsuario } from "@/lib/auth/sesion";

export type CuentaMovil = { perfil: PerfilNav; rol: RolUsuario };

const ContextoCuentaMovil = createContext<CuentaMovil | null>(null);

/**
 * Perfil y rol de la sesión, disponibles para las cabeceras móviles —
 * issue #52 (PWA-MOB-02).
 *
 * En móvil ya no hay header global: cada ruta dibuja su propia cabecera
 * dentro del contenido, y varias de esas rutas son componentes cliente que
 * no reciben la sesión por props (`empleados-client`, `ventas-client`, …).
 * En vez de enhebrar `perfil`/`rol` por cada pantalla, el layout del grupo
 * `(app)` —que ya los tiene resueltos en el servidor— los publica una sola
 * vez acá. Son datos de presentación (nombre, empresa, rol): la
 * autorización real sigue siendo server-side en `requireSession`/`requireRol`.
 */
export function ProveedorCuentaMovil({
  perfil,
  rol,
  children,
}: {
  perfil: PerfilNav;
  rol: RolUsuario;
  children: ReactNode;
}) {
  const valor = useMemo(() => ({ perfil, rol }), [perfil, rol]);
  return (
    <ContextoCuentaMovil.Provider value={valor}>
      {children}
    </ContextoCuentaMovil.Provider>
  );
}

/** `null` fuera del grupo `(app)` (login, `/estilo-movil`, tests aislados). */
export function useCuentaMovil(): CuentaMovil | null {
  return useContext(ContextoCuentaMovil);
}
