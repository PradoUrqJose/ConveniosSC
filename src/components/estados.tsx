"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Home,
  LogIn,
  RefreshCw,
  ServerCrash,
  WifiOff,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  clasificarFallo,
  copiaFallo,
  MS_UMBRAL_ESQUELETO,
  recuperacionDe,
  reintentoAutomaticoSeguro,
  retrasoReintento,
  type ClaseFallo,
} from "@/lib/estados-red";
import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════════════════════════════════
   1. Carga — esqueleto diferido
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Retiene el esqueleto los primeros ~200 ms (`MS_UMBRAL_ESQUELETO`).
 *
 * En una navegación rápida —caché de router caliente, red de oficina— el
 * `loading.tsx` de Next se monta y se desmonta en el mismo cuadro: el
 * usuario ve un destello gris que se lee como un defecto. Por encima del
 * umbral la espera sí necesita respuesta visual.
 *
 * Se oculta con `visibility`, no desmontando: el árbol ocupa su alto desde
 * el primer cuadro, así que cuando aparece no empuja nada ni mueve el
 * scroll (criterio «sin saltos de layout»). `display: contents` deja intacta
 * la rejilla de la pantalla; `visibility` se hereda hasta las hojas.
 */
/**
 * ¿Ya hidrató la aplicación alguna vez en esta pestaña?
 *
 * Distingue las dos cargas que parecen la misma. En la **primera** (HTML del
 * servidor, JS todavía descargando en 3G) esconder el esqueleto dejaría la
 * pantalla en blanco durante segundos, que es peor que el destello que
 * queremos evitar: ahí se muestra de inmediato. A partir de la **segunda**
 * —navegación de cliente, con React ya vivo— sí aplica el umbral.
 */
let yaHidrato = false;

export function EsqueletoDiferido({
  children,
  ms = MS_UMBRAL_ESQUELETO,
  inmediato = false,
}: {
  children: React.ReactNode;
  ms?: number;
  /** Los límites de ruta son el feedback del clic: no se difieren. */
  inmediato?: boolean;
}) {
  // En servidor `yaHidrato` es siempre `false` (solo lo enciende un efecto),
  // así que el HTML y la primera hidratación coinciden: sin desajuste.
  const [visible, setVisible] = useState(inmediato || !yaHidrato);

  useEffect(() => {
    yaHidrato = true;
    if (visible) return;
    const id = setTimeout(() => setVisible(true), ms);
    return () => clearTimeout(id);
  }, [visible, ms]);

  return (
    <div className={visible ? "contents" : "invisible contents"}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   2. Observabilidad
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Registro de un fallo de cliente, en una línea JSON como
 * `lib/observabilidad.ts`. Nunca sale del `console`: no hay endpoint de
 * telemetría propio, y el recolector del entorno lo agrupa por `dominio` y
 * `clase`. No se emite el mensaje del error —puede traer un documento o un
 * nombre—, solo el `digest` que Next genera en servidor.
 */
export function registrarFallo(entrada: {
  dominio: string;
  clase: ClaseFallo;
  digest?: string;
}) {
  console.error(
    JSON.stringify({
      esquema: "convenios.error.v1",
      tipo: "fallo-cliente",
      dominio: entrada.dominio,
      clase: entrada.clase,
      ...(entrada.digest ? { digest: entrada.digest } : {}),
    }),
  );
}

const ICONO_CLASE = {
  offline: WifiOff,
  servidor: ServerCrash,
  timeout: ServerCrash,
  sesion: LogIn,
  permiso: AlertTriangle,
  datos: AlertTriangle,
  desconocido: AlertTriangle,
} as const;

/* ══════════════════════════════════════════════════════════════════════
   3. Error total — frontera de ruta (`error.tsx`)
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Pantalla de una ruta que no pudo renderizar. La monta cada `error.tsx` de
 * dominio, así que:
 *
 * - **se queda dentro del layout**: barra inferior, sidebar y safe areas
 *   siguen ahí y la navegación no se bloquea;
 * - **conserva la URL**, y con ella los filtros y la paginación, porque
 *   `reset()` vuelve a renderizar el mismo segmento sin navegar;
 * - **distingue la causa** (sin red / servidor caído / sesión vencida /
 *   sin permiso) en vez del genérico «ocurrió un error»;
 * - **reintenta solo al reconectar** cuando la causa fue la red, que es lo
 *   único que se puede reintentar sin riesgo de repetir una operación.
 */
export function ErrorRuta({
  dominio,
  error,
  reset,
  descripcionExtra,
}: {
  /** Nombre de la pantalla, para el registro y el texto. Ej.: "ventas". */
  dominio: string;
  error: Error & { digest?: string };
  reset: () => void;
  descripcionExtra?: React.ReactNode;
}) {
  // `error.tsx` solo se monta en el cliente, así que `navigator` ya existe
  // en el primer render y no hay un cuadro con el texto equivocado.
  const enLinea = useEnLinea();

  const clase = clasificarFallo({ error, enLinea });
  const copia = copiaFallo(clase);
  const recuperacion = recuperacionDe(clase);
  const Icono = ICONO_CLASE[clase];

  const digest = error.digest;
  useEffect(() => {
    registrarFallo({ dominio, clase, digest });
  }, [dominio, clase, digest]);

  // Reconexión: en cuanto vuelve la señal se reintenta solo. Es una lectura
  // (volver a renderizar el segmento), nunca una mutación.
  useEffect(() => {
    if (!reintentoAutomaticoSeguro({ clase, mutacion: false })) return;
    if (clase !== "offline") return;
    const alVolver = () => reset();
    window.addEventListener("online", alVolver);
    return () => window.removeEventListener("online", alVolver);
  }, [clase, reset]);

  return (
    <section className="page-shell">
      <div
        role="alert"
        aria-live="assertive"
        className="border-border/80 bg-card/60 mx-auto grid min-h-72 w-full max-w-xl place-items-center rounded-[1.5rem] border border-dashed px-6 py-12 text-center"
      >
        <div className="max-w-sm">
          <span className="bg-primary/10 text-primary ring-primary/10 mx-auto grid size-14 place-items-center rounded-[1.25rem] ring-1">
            <Icono className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-base font-bold tracking-tight">
            {copia.titulo}
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm leading-6">
            {copia.descripcion}
          </p>
          {descripcionExtra ? (
            <div className="text-muted-foreground mt-1.5 text-sm leading-6">
              {descripcionExtra}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {recuperacion === "reautenticar" ? (
              // Enlace real, no `Button render={<Link/>}`: Base UI avisa
              // por consola si el botón no es un `<button>` (issue #52).
              <Link href="/login" className={buttonVariants({ size: "lg" })}>
                <LogIn className="size-4" aria-hidden="true" />
                {copia.accion}
              </Link>
            ) : (
              <Button size="lg" onClick={() => reset()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                {recuperacion === "volver" ? "Volver a cargar" : copia.accion}
              </Button>
            )}
            <Link
              href="/"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              <Home className="size-4" aria-hidden="true" />
              Ir al inicio
            </Link>
          </div>
          {digest ? (
            <p className="text-muted-foreground/80 mt-4 font-mono text-[11px]">
              Referencia: {digest}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   4. Error parcial — una sección cae, la pantalla sigue viva
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Panel para el trozo de pantalla que falló (un módulo del dashboard, el
 * detalle de un registro de auditoría). No reemplaza la página: los filtros,
 * el formulario y el resto del contenido siguen donde estaban.
 *
 * `reintentando` deshabilita el botón para no disparar dos veces la misma
 * operación desde un toque doble en móvil.
 */
export function ErrorParcial({
  clase,
  titulo,
  descripcion,
  onReintentar,
  reintentando = false,
  className,
}: {
  clase?: ClaseFallo;
  titulo?: string;
  descripcion?: React.ReactNode;
  onReintentar?: () => void;
  reintentando?: boolean;
  className?: string;
}) {
  const copia = copiaFallo(clase ?? "desconocido");
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/25 bg-destructive/5 flex flex-col gap-3 rounded-[1.25rem] border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle
          className="text-destructive mt-0.5 size-5 shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold">{titulo ?? copia.titulo}</p>
          <div className="text-muted-foreground mt-0.5 text-sm leading-5">
            {descripcion ?? copia.descripcion}
          </div>
        </div>
      </div>
      {onReintentar ? (
        <Button
          size="lg"
          variant="outline"
          className="shrink-0 self-start sm:self-auto"
          disabled={reintentando}
          onClick={onReintentar}
        >
          <RefreshCw
            className={cn(
              "size-4",
              reintentando ? "animate-spin motion-reduce:animate-none" : "",
            )}
            aria-hidden="true"
          />
          {reintentando ? "Reintentando…" : "Reintentar"}
        </Button>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   5. Reconexión
   ══════════════════════════════════════════════════════════════════════ */

function suscribirRed(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * `navigator.onLine` como estado de React. Con `useSyncExternalStore` y no
 * con `useState` + efecto: el valor lo tiene el navegador, no React, y así
 * no hay un cuadro intermedio con el dato equivocado. En servidor se asume
 * "hay red", que es el HTML correcto para la inmensa mayoría de las cargas;
 * la pantalla `~offline` —cuyo HTML se precachea justamente para servirlo
 * cuando la navegación falló— pasa `false` y evita anunciar la causa
 * equivocada hasta que hidrate.
 */
export function useEnLinea(porDefectoEnServidor = true): boolean {
  return useSyncExternalStore(
    suscribirRed,
    () => window.navigator.onLine,
    () => porDefectoEnServidor,
  );
}

/**
 * Comprobación activa de que el servidor contesta, con espera creciente.
 * `navigator.onLine` solo sabe si hay interfaz de red: con wifi de hotel o
 * el servidor caído dice `true` y la app seguiría rota. La usa la pantalla
 * `~offline` para volver sola cuando de verdad hay servicio.
 */
export function useSondaServidor({
  activo,
  onVivo,
}: {
  activo: boolean;
  onVivo: () => void;
}): { intentos: number; comprobando: boolean; vivo: boolean } {
  const [intentos, setIntentos] = useState(0);
  const [comprobando, setComprobando] = useState(false);
  const [vivo, setVivo] = useState(false);
  // El callback se guarda en una ref para que cambiarlo no reinicie la
  // serie de intentos; se sincroniza en un efecto, nunca durante el render.
  const onVivoRef = useRef(onVivo);
  useEffect(() => {
    onVivoRef.current = onVivo;
  }, [onVivo]);

  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    let temporizador: ReturnType<typeof setTimeout>;

    const sondear = async (intento: number) => {
      if (cancelado) return;
      setComprobando(true);
      try {
        // `manifest.webmanifest` es estático y diminuto: confirma que hay
        // servidor sin tocar ninguna ruta autenticada ni consumir datos.
        const respuesta = await fetch("/manifest.webmanifest", {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(6_000),
        });
        if (cancelado) return;
        if (respuesta.ok) {
          setComprobando(false);
          setVivo(true);
          onVivoRef.current();
          return;
        }
        throw new Error(String(respuesta.status));
      } catch {
        if (cancelado) return;
        setComprobando(false);
        setIntentos(intento + 1);
        temporizador = setTimeout(
          () => void sondear(intento + 1),
          retrasoReintento(intento),
        );
      }
    };

    void sondear(0);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
    // `activo` reinicia la serie de intentos; el resto vive en refs.
  }, [activo]);

  return { intentos, comprobando, vivo };
}
