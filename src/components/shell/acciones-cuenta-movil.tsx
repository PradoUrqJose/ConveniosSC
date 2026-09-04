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
import { Button } from "@/components/ui/button";
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
 * En escritorio, Perfil ofrece la instalación como acción directa; el sheet
 * se conserva exclusivamente para las acciones de cuenta en móvil.
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
    const esIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // iOS no emite beforeinstallprompt: puede mostrar la guía desde Perfil.
    // En el resto esperamos la señal del banner para no ofrecer un botón que
    // el navegador todavía no puede ejecutar.
    const temporizador = window.setTimeout(
      () => setPuedeInstalar(!instalada && esIOS),
      0,
    );
    const alSerElegible = () => setPuedeInstalar(true);
    window.addEventListener("convenios:instalacion-elegible", alSerElegible);
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener(
        "convenios:instalacion-elegible",
        alSerElegible,
      );
    };
  }, []);

  return (
    <div>
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

      {/* El acceso voluntario también existe en escritorio: Perfil es el
          lugar único para las opciones de cuenta, sin depender del banner. */}
      {puedeInstalar ? (
        <Button
          type="button"
          variant="outline"
          className="hidden lg:inline-flex"
          onClick={() =>
            window.dispatchEvent(new Event("convenios:mostrar-instalacion"))
          }
        >
          <Download className="size-4" />
          Instalar aplicación
        </Button>
      ) : null}
    </div>
  );
}
