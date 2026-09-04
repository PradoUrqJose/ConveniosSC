"use client";

import { ChevronRight, Download, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import {
  MobileSheet,
  MobileSheetAcciones,
  MobileSheetBoton,
  MobileSheetCerrar,
  MobileSheetCuerpo,
  MobileSheetFilaAccion,
  MobileSheetPagina,
} from "@/components/ui/mobile-sheet";
import { cerrarSesion } from "@/modules/auth/actions";

/**
 * Acciones de cuenta del shell móvil — issues #52 (PWA-MOB-02) y #54
 * (PWA-MOB-04).
 *
 * #52 bajó tema, instalación y cierre de sesión desde el menú del avatar
 * —que se fue con el header global— a una lista suelta dentro de `/perfil`.
 * #54 las devuelve a una capa, pero a **la** capa del sistema: un bottom
 * sheet, el mismo mecanismo que usan filtros, edición y confirmación. Así
 * no queda un menú desplegable con su propia geometría y su propio cierre
 * conviviendo con los sheets del resto de la app.
 *
 * El cierre de sesión no dispara nada al tocarlo: empuja una subpágina de
 * confirmación *dentro del mismo sheet* (doc §5, variante decisión), sin
 * encadenar un segundo modal encima.
 *
 * Solo móvil: en escritorio estas acciones siguen en el Sidebar, intacto.
 */
export function AccionesCuentaMovil() {
  const { resolvedTheme, setTheme } = useTheme();
  const [abierto, setAbierto] = useState(false);
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
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="hover:bg-muted flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium"
      >
        <span className="flex-1">Opciones de la cuenta</span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>

      <MobileSheet
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        altura="compacta"
        agarradera
      >
        <MobileSheetPagina id="raiz" titulo="Tu cuenta">
          <MobileSheetCuerpo>
            <MobileSheetFilaAccion
              icono={
                oscuro ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )
              }
              etiqueta={oscuro ? "Usar tema claro" : "Usar tema oscuro"}
              onClick={() => setTheme(oscuro ? "light" : "dark")}
            />
            {puedeInstalar ? (
              <MobileSheetFilaAccion
                icono={<Download className="size-4" />}
                etiqueta="Instalar aplicación"
                onClick={() => {
                  window.dispatchEvent(
                    new Event("convenios:mostrar-instalacion"),
                  );
                  setAbierto(false);
                }}
              />
            ) : null}
            <MobileSheetFilaAccion
              icono={<LogOut className="size-4" />}
              etiqueta="Cerrar sesión"
              tono="destructivo"
              pagina="cerrar-sesion"
            />
          </MobileSheetCuerpo>
        </MobileSheetPagina>

        <MobileSheetPagina
          id="cerrar-sesion"
          titulo="¿Cerrar sesión?"
          descripcion="Tendrás que volver a ingresar tu usuario y tu contraseña."
        >
          <MobileSheetCuerpo />
          {/* `.mob-sheet-acciones` invierte el orden visual: el destructivo
              queda arriba, pero en el DOM manda la salida segura. */}
          <MobileSheetAcciones>
            <MobileSheetCerrar>Seguir en la sesión</MobileSheetCerrar>
            <form action={cerrarSesion}>
              <MobileSheetBoton type="submit" variante="destructivo">
                Cerrar sesión
              </MobileSheetBoton>
            </form>
          </MobileSheetAcciones>
        </MobileSheetPagina>
      </MobileSheet>
    </div>
  );
}
