"use client";

import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

export type DireccionVentas = "vendidas" | "compradas";

export type OpcionDireccionVentas = {
  id: DireccionVentas;
  label: string;
  href: string;
};

/**
 * Selector de dirección (p. ej. "Vendí" / "Compraron mis empleados")
 * compartido entre Dashboard y Ventas — issue #27. Reemplaza los pares de
 * `<Link>`/`<button>` casi idénticos que había en cada pantalla por un único
 * componente con:
 *
 * - Estado optimista (`useOptimistic`): el indicador se mueve en el mismo
 *   tick del click, sin esperar al Server Component.
 * - Indicador compartido animado por `transform`, no por reflow.
 * - Semántica `tablist/tab` con `aria-selected` y navegación por flechas
 *   (patrón APG Tabs de activación manual).
 * - Prefetch de la dirección alternativa al montar: es una navegación GET
 *   idempotente, segura de precargar sin que el usuario la haya pedido.
 *
 * El consumidor decide cómo se navega (`onNavegar`, normalmente envuelto en
 * su propio `startTransition` para exponer un `pendiente` y dibujar su
 * propio skeleton) o, si lo omite, navega con `router.push` directamente.
 */
export function SalesDirectionTabs({
  opciones,
  direccion,
  onNavegar,
  className,
  ariaLabel = "Dirección de ventas",
  prefetch = true,
}: {
  opciones: readonly OpcionDireccionVentas[];
  direccion: DireccionVentas;
  onNavegar?: (href: string) => void;
  className?: string;
  ariaLabel?: string;
  /** Desactiva GETs especulativos cuando el consumidor carga por Server Action. */
  prefetch?: boolean;
}) {
  const router = useRouter();
  const [optimista, setOptimista] = useOptimistic(direccion);
  const contenedor = useRef<HTMLDivElement | null>(null);
  const botones = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicador, setIndicador] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const indiceActivo = Math.max(
    0,
    opciones.findIndex((o) => o.id === optimista),
  );

  // El indicador mide el botón activo real (los labels tienen ancho
  // distinto, p. ej. "Vendí" vs "Compraron mis empleados") y se posiciona en
  // píxeles por `transform`, no por reflow. Se remide en cada cambio de
  // pestaña activa y al redimensionar (envolturas de texto en pantallas
  // angostas cambian el ancho de los botones).
  useLayoutEffect(() => {
    const medir = () => {
      const boton = botones.current[indiceActivo];
      if (!boton || !contenedor.current) return;
      setIndicador({
        left: boton.offsetLeft,
        width: boton.offsetWidth,
      });
    };
    medir();
    const observer = new ResizeObserver(medir);
    if (contenedor.current) observer.observe(contenedor.current);
    return () => observer.disconnect();
  }, [indiceActivo]);

  // La navegación puede llegar de fuera (atrás/adelante del navegador): el
  // valor optimista debe ceder ante el `direccion` real cuando cambia.
  useEffect(() => {
    setOptimista(direccion);
  }, [direccion, setOptimista]);

  useEffect(() => {
    if (!prefetch) return;
    for (const opcion of opciones) {
      if (opcion.id !== direccion) router.prefetch(opcion.href);
    }
    // Solo al montar: opciones/href son estables para una misma pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetch]);

  const seleccionar = (opcion: OpcionDireccionVentas) => {
    if (opcion.id === optimista) return;
    startTransition(() => {
      setOptimista(opcion.id);
      if (onNavegar) onNavegar(opcion.href);
      else router.push(opcion.href);
    });
  };

  const moverFoco = (e: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    let siguiente = indice;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      siguiente = (indice + 1) % opciones.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      siguiente = (indice - 1 + opciones.length) % opciones.length;
    } else if (e.key === "Home") {
      siguiente = 0;
    } else if (e.key === "End") {
      siguiente = opciones.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    botones.current[siguiente]?.focus();
    const opcion = opciones[siguiente];
    if (opcion) seleccionar(opcion);
  };

  return (
    <div
      ref={contenedor}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "bg-muted/80 relative flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl p-1.5",
        className,
      )}
    >
      {indicador ? (
        <span
          aria-hidden="true"
          className="bg-card absolute inset-y-1.5 left-0 rounded-lg shadow-sm transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
          style={{
            width: indicador.width,
            transform: `translateX(${indicador.left}px)`,
          }}
        />
      ) : null}
      {opciones.map((opcion, indice) => (
        <button
          key={opcion.id}
          ref={(el) => {
            botones.current[indice] = el;
          }}
          type="button"
          role="tab"
          id={`tab-direccion-${opcion.id}`}
          aria-selected={optimista === opcion.id}
          tabIndex={optimista === opcion.id ? 0 : -1}
          onClick={() => seleccionar(opcion)}
          onKeyDown={(e) => moverFoco(e, indice)}
          className={cn(
            "focus-visible:ring-ring/50 relative z-10 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
            optimista === opcion.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opcion.label}
        </button>
      ))}
    </div>
  );
}
