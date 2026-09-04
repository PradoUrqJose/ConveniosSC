import { redirect } from "next/navigation";
import {
  Bell,
  Check,
  ChevronRight,
  Copy,
  FileText,
  TriangleAlert,
} from "lucide-react";

import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Referencia viva de los tokens y primitivas móviles definidos para el
 * issue #51 (PWA-MOB-01) — docs/sistema-diseno-mobile (1).md.
 *
 * No es una pantalla de producto: es el material de verificación del
 * sistema de diseño (capturas Playwright, revisión visual). No está
 * enlazada desde ningún menú a propósito — solo `--mob-*` y las clases
 * `.mob-*` de src/app/globals.css, para probar que son reutilizables sin
 * duplicar valores. Solo SUPERADMIN, para no exponerla como producto.
 *
 * A propósito vive *fuera* de `(app)` — el grupo con Sidebar/Header/
 * TabBarMovil. Ese Header es claro y de escritorio-primero; envolver acá
 * el `.mob-shell` (fondo propio del sistema móvil, "sin chrome fijo"
 * por diseño) con
 * ese Header arriba mezclaba los dos temas en la misma pantalla, que es
 * exactamente lo que el principio 1 del doc prohíbe.
 */
export default async function EstiloMovilPage() {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (error) {
    if (error instanceof ErrorAuth) redirect("/login");
    throw error;
  }
  try {
    requireRol(sesion, ["SUPERADMIN"]);
  } catch {
    redirect("/");
  }

  return (
    <div className="mob-shell mob-safe-top px-5 pb-16">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-bold tracking-[0.16em] uppercase opacity-60">
            PWA-MOB-01 · referencia viva
          </p>
          <h1 className="text-2xl font-bold">Tokens y geometría móvil</h1>
          <p className="mt-1 text-sm opacity-70">
            El fondo (--mob-bg) y las superficies (--mob-superficie) salen de la
            misma rampa del mismo modo: en claro, fondo gris azulado con tarjeta
            blanca; en oscuro, fondo azul noche con tarjeta elevada. Nunca se
            mezclan. Usá el botón de la derecha para comparar.
          </p>
        </div>
        <ThemeToggle className="shrink-0" />
      </header>

      <section aria-labelledby="h-anidamiento" className="mb-8">
        <h2
          id="h-anidamiento"
          className="mb-3 text-sm font-semibold opacity-70"
        >
          Anidamiento — tarjeta → bloque interior → fila
        </h2>
        <div className="mob-tarjeta">
          <div className="mob-tarjeta-encabezado">
            <span className="mob-icono mob-icono-acento">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Convenio Salud Total</p>
              <p className="text-xs opacity-60">3 empleados activos</p>
            </div>
            <ChevronRight className="size-5 opacity-40" />
          </div>
          <div className="mob-bloque">
            <div className="mob-fila !min-h-0 justify-between !px-0 py-1.5">
              <span className="text-xs opacity-70">Cuota mensual</span>
              <span className="text-sm font-semibold">S/ 120.00</span>
            </div>
            <div className="mob-fila !min-h-0 justify-between !px-0 py-1.5">
              <span className="text-xs opacity-70">Estado</span>
              <span className="mob-pill mob-pill-ok">
                <Check className="size-3" /> Al día
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-fila" className="mb-8">
        <h2 id="h-fila" className="mb-3 text-sm font-semibold opacity-70">
          Cuándo una tarjeta se convierte en fila
        </h2>
        <p className="mb-3 text-xs opacity-70">
          Un ítem homogéneo dentro de una lista larga (empleados de un convenio,
          movimientos de una venta) es <b>fila</b>, no tarjeta: vive dentro de
          una única tarjeta contenedora y usa el divisor inset, no su propio
          radio de 24px por ítem.
        </p>
        <div className="mob-tarjeta">
          {["Ana Torres", "Luis Vega", "Carla Ríos"].map((nombre, i) => (
            <div key={nombre} className="mob-fila justify-between">
              <div>
                <p className="text-xs opacity-60">Empleado</p>
                <p className="font-semibold">{nombre}</p>
              </div>
              {i === 1 ? (
                <span className="mob-pill mob-pill-atencion">
                  <TriangleAlert className="size-3" /> Pendiente
                </span>
              ) : (
                <ChevronRight className="size-5 opacity-40" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-estados" className="mb-8">
        <h2 id="h-estados" className="mb-3 text-sm font-semibold opacity-70">
          Estados semánticos — solo dentro de pills
        </h2>
        <div className="flex flex-wrap gap-2">
          <span className="mob-pill mob-pill-ok">
            <Check className="size-3" /> Verificado
          </span>
          <span className="mob-pill mob-pill-atencion">
            <TriangleAlert className="size-3" /> Por vencer
          </span>
          <span className="mob-pill mob-pill-error">
            <Bell className="size-3" /> Rechazado
          </span>
        </div>
      </section>

      <section aria-labelledby="h-botones" className="mb-8">
        <h2 id="h-botones" className="mb-3 text-sm font-semibold opacity-70">
          Botones
        </h2>
        <div className="flex flex-col gap-2">
          <button type="button" className="mob-boton mob-boton-primario">
            Registrar venta
          </button>
          <button type="button" className="mob-boton mob-boton-secundario">
            Guardar borrador
          </button>
          <button type="button" className="mob-boton-terciario self-start">
            <Copy className="mr-1.5 size-3.5" /> Copiar código
          </button>
        </div>
      </section>

      <section aria-labelledby="h-squircle">
        <h2 id="h-squircle" className="mb-3 text-sm font-semibold opacity-70">
          Íconos en contenedor squircle
        </h2>
        <div className="flex gap-3">
          <span className="mob-icono">
            <FileText className="size-5" />
          </span>
          <span className="mob-icono mob-icono-acento">
            <Bell className="size-5" />
          </span>
        </div>
      </section>
    </div>
  );
}
