"use client";

import { RefreshCw, ServerCrash, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEnLinea, useSondaServidor } from "@/components/estados";
import { copiaFallo } from "@/lib/estados-red";

/**
 * Pantalla que sirve el service worker cuando una navegación no llega —
 * issue #56.
 *
 * Antes solo ofrecía «Reintentar» y hablaba siempre de falta de internet.
 * Son dos situaciones distintas y con salidas distintas:
 *
 * - **Sin red**: `navigator.onLine` es `false`. No hay nada que reintentar;
 *   se espera al evento `online` y se vuelve **sola**, sin que el usuario
 *   tenga que acordarse de tocar el botón.
 * - **Con red y sin servidor**: `onLine` es `true` pero la navegación
 *   falló igual (wifi de portal cautivo, despliegue en curso, caída). Se
 *   sondea el `manifest.webmanifest` con espera creciente y se vuelve en
 *   cuanto el servidor contesta.
 *
 * El botón sigue estando: la recuperación automática es un extra, nunca la
 * única salida.
 */
export default function PaginaSinConexion() {
  // Esta pantalla se precachea y se sirve cuando una navegación no llegó,
  // así que el HTML sin hidratar debe hablar del caso frecuente (sin red) y
  // no del raro: nada de anunciar "el servidor no responde" y corregirse.
  const enLinea = useEnLinea(false);

  // Con red, la sonda corre sola y recarga apenas el servidor responde.
  //
  // El service worker sirve esta pantalla **en la URL que el usuario pidió**
  // (es un fallback de navegación), así que recargar lo devuelve a su ruta
  // real. La excepción es entrar a `/~offline` a mano —lo hace la suite e2e
  // y el `precache`—: ahí recargar solo repintaría lo mismo en bucle.
  const { intentos, comprobando, vivo } = useSondaServidor({
    activo: enLinea,
    onVivo: () => {
      if (window.location.pathname === "/~offline") return;
      window.location.reload();
    },
  });

  // Tres situaciones, tres textos. `vivo` solo se da al abrir `/~offline`
  // a mano con servicio: en el fallback real la recarga ya se llevó al
  // usuario a su ruta.
  const situacion = !enLinea ? "offline" : vivo ? "recuperado" : "servidor";
  const copia =
    situacion === "recuperado"
      ? {
          titulo: "Ya hay conexión",
          descripcion:
            "El servidor responde con normalidad. Vuelve a la pantalla que estabas usando o reintenta desde aquí.",
        }
      : copiaFallo(situacion);
  const Icono =
    situacion === "offline"
      ? WifiOff
      : situacion === "recuperado"
        ? Wifi
        : ServerCrash;

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-full">
        <Icono className="text-muted-foreground size-6" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">{copia.titulo}</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          {copia.descripcion}
        </p>
        {situacion === "recuperado" ? null : (
          <p className="text-muted-foreground max-w-sm text-sm">
            Los datos de ventas y empleados nunca se guardan en el dispositivo,
            así que necesitas conexión para verlos o registrarlos.
          </p>
        )}
      </div>

      {/* Región viva: el estado de la reconexión se anuncia sin robar el
          foco ni obligar a mirar la pantalla. */}
      <p
        role="status"
        aria-live="polite"
        className="text-muted-foreground text-sm"
      >
        {situacion === "offline"
          ? "Reintentaremos solos en cuanto vuelva la señal."
          : situacion === "recuperado"
            ? "Comprobación correcta: el servidor está disponible."
            : comprobando
              ? "Comprobando si el servidor ya responde…"
              : intentos > 0
                ? `Sin respuesta todavía (intento ${intentos}). Seguimos probando.`
                : "Comprobando la conexión…"}
      </p>

      <Button size="lg" onClick={() => window.location.reload()}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Reintentar ahora
      </Button>
    </main>
  );
}
