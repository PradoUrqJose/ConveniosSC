"use client";

import { Download, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cerrarSesion } from "@/modules/auth/actions";

/**
 * Acciones de cuenta del shell móvil — issue #52 (PWA-MOB-02).
 *
 * Al quitar el header global de móvil, tema, instalación de la PWA y cierre
 * de sesión se quedaban sin ningún acceso: la barra inferior no tiene
 * pestaña de perfil y el menú de avatar desapareció con el header. En vez de
 * reconstruir ese menú (chrome fijo otra vez), las acciones secundarias
 * bajan a `/perfil`, adonde lleva el avatar de las cabeceras raíz.
 *
 * Solo móvil: en escritorio estas mismas acciones siguen en el Sidebar, que
 * no se toca.
 */
export function AccionesCuentaMovil() {
  const { resolvedTheme, setTheme } = useTheme();
  const [puedeInstalar, setPuedeInstalar] = useState(false);
  const oscuro = resolvedTheme === "dark";

  useEffect(() => {
    // Igual que hacía el header: si ya está instalada, ofrecer instalar
    // confunde. Se difiere un tick para no desincronizar la hidratación.
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean(
          (navigator as Navigator & { standalone?: boolean }).standalone,
        ));
    const temporizador = window.setTimeout(
      () => setPuedeInstalar(!instalada),
      0,
    );
    return () => window.clearTimeout(temporizador);
  }, []);

  return (
    <div className="flex flex-col gap-2 lg:hidden">
      <button
        type="button"
        onClick={() => setTheme(oscuro ? "light" : "dark")}
        className="hover:bg-muted flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium"
      >
        {oscuro ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )}
        {oscuro ? "Usar tema claro" : "Usar tema oscuro"}
      </button>

      {puedeInstalar ? (
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event("convenios:mostrar-instalacion"))
          }
          className="hover:bg-muted flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium"
        >
          <Download className="size-4" aria-hidden="true" />
          Instalar aplicación
        </button>
      ) : null}

      <form action={cerrarSesion}>
        <button
          type="submit"
          className="text-destructive hover:bg-destructive/10 flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
