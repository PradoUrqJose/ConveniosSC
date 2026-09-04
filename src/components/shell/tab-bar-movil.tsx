"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import {
  estadoInicialBarra,
  siguienteEstadoBarra,
  type EstadoBarra,
} from "@/lib/barra-scroll";
import {
  estaActivo,
  navegacionPorRol,
  type DestinoNav,
} from "@/lib/navegacion";
import type { RolUsuario } from "@/lib/auth/sesion";
import { IconoDestino } from "@/components/shell/iconos";

/**
 * Barra inferior flotante — issue #53 (PWA-MOB-03), doc §3.
 *
 * Píldora separada del borde, 3–5 destinos derivados del rol con orden
 * estable, etiqueta siempre visible, indicador activo deslizante y
 * ocultamiento por scroll. La geometría (alto, separación, radio, área
 * táctil) sale de los tokens `--mob-*`; acá vive sólo el comportamiento.
 */

/**
 * Diferencia mínima entre el viewport visual y el de layout para dar el
 * teclado por abierto. Con `interactiveWidget: "resizes-content"` el
 * teclado ya reduce el layout viewport en la mayoría de los casos; esto
 * cubre a los navegadores que sólo achican el visual.
 */
const TECLADO_MIN_PX = 120;

/** Tope de vida del destino "pendiente" si la navegación no llega nunca. */
const ESPERA_MAX_PENDIENTE_MS = 5000;

function useVisibilidadPorScroll(): {
  referencia: RefObject<HTMLElement | null>;
  visible: boolean;
  marcarInteraccion: () => void;
} {
  const referencia = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  // Interacción táctil en curso dentro de la barra: mientras dure, la
  // barra no se mueve aunque el gesto arrastre la página.
  const interactuando = useRef(false);
  const evaluarRef = useRef<() => void>(() => {});

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let estado: EstadoBarra = estadoInicialBarra(window.scrollY);
    let frame = 0;

    const tecladoAbierto = () => {
      const vv = window.visualViewport;
      return vv ? vv.height < window.innerHeight - TECLADO_MIN_PX : false;
    };

    const permitirOcultar = () =>
      !reduceMotion.matches &&
      !tecladoAbierto() &&
      !interactuando.current &&
      !(
        document.activeElement instanceof Node &&
        referencia.current?.contains(document.activeElement)
      );

    const evaluar = () => {
      frame = 0;
      estado = siguienteEstadoBarra(estado, {
        y: window.scrollY,
        alturaViewport: window.innerHeight,
        alturaDocumento: document.documentElement.scrollHeight,
        ahora: Date.now(),
        permitirOcultar: permitirOcultar(),
      });
      setVisible(estado.visible);
    };
    evaluarRef.current = evaluar;

    // Un solo cálculo por frame: el scroll dispara decenas de eventos.
    const programar = () => {
      if (!frame) frame = requestAnimationFrame(evaluar);
    };

    window.addEventListener("scroll", programar, { passive: true });
    window.addEventListener("resize", programar);
    window.visualViewport?.addEventListener("resize", programar);
    document.addEventListener("focusin", programar);
    document.addEventListener("focusout", programar);
    reduceMotion.addEventListener("change", programar);
    evaluar();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", programar);
      window.removeEventListener("resize", programar);
      window.visualViewport?.removeEventListener("resize", programar);
      document.removeEventListener("focusin", programar);
      document.removeEventListener("focusout", programar);
      reduceMotion.removeEventListener("change", programar);
    };
  }, []);

  const marcarInteraccion = useCallback(() => {
    interactuando.current = true;
    setVisible(true);
    const soltar = () => {
      interactuando.current = false;
      evaluarRef.current();
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  }, []);

  return { referencia, visible, marcarInteraccion };
}

function Pestaña({
  destino,
  activo,
  pendientesEmpleados,
  alElegir,
}: {
  destino: DestinoNav;
  activo: boolean;
  pendientesEmpleados: ReactNode;
  alElegir: (href: string) => void;
}) {
  const mostrarBadge = destino.href === "/empleados";
  const etiqueta = destino.etiquetaCorta ?? destino.etiqueta;

  return (
    <Link
      href={destino.href}
      // La barra siempre está en viewport. El prefetch explícito garantiza
      // que Next prepare el límite `loading.tsx` del destino antes del toque;
      // los datos autenticados siguen llegando solo después de navegar.
      prefetch
      aria-label={destino.etiquetaCorta ? destino.etiqueta : undefined}
      aria-current={activo ? "page" : undefined}
      data-activo={activo ? "true" : "false"}
      data-destacado={destino.destacado ? "true" : undefined}
      className="mob-barra-inferior-tab"
      // El indicador se mueve en el clic, antes de que el servidor
      // responda: el cambio de ruta tiene feedback inmediato. El foco se
      // queda en el enlace (no se mueve ni se hace blur).
      onClick={() => alElegir(destino.href)}
    >
      <span className="mob-barra-inferior-icono">
        <IconoDestino destino={destino} className="size-[1.3rem]" />
        {mostrarBadge ? pendientesEmpleados : null}
      </span>
      <span className="mob-barra-inferior-etiqueta">{etiqueta}</span>
    </Link>
  );
}

export function TabBarMovil({
  rol,
  pendientesEmpleados,
}: {
  rol: RolUsuario;
  pendientesEmpleados: ReactNode;
}) {
  const { tabs } = navegacionPorRol(rol);
  const pathname = usePathname();
  const { referencia, visible, marcarInteraccion } = useVisibilidadPorScroll();
  // El destino tocado se guarda junto a la ruta desde la que se tocó: en
  // cuanto `pathname` cambia, el pendiente deja de aplicar sin necesidad
  // de un efecto que lo limpie.
  const [pendiente, setPendiente] = useState<{
    href: string;
    desde: string;
  } | null>(null);
  const hrefPendiente =
    pendiente && pendiente.desde === pathname ? pendiente.href : null;

  const alElegir = useCallback(
    (href: string) => {
      setPendiente({ href, desde: pathname });
      // Red de seguridad: si la navegación nunca llega (offline, error),
      // el indicador vuelve al destino real en vez de quedarse mintiendo.
      window.setTimeout(() => {
        setPendiente((actual) => (actual?.href === href ? null : actual));
      }, ESPERA_MAX_PENDIENTE_MS);
    },
    [pathname],
  );

  const indiceActivo = tabs.findIndex((destino) =>
    estaActivo(pathname, destino.href),
  );
  const indicePendiente = hrefPendiente
    ? tabs.findIndex((destino) => destino.href === hrefPendiente)
    : -1;
  const indiceIndicador = indicePendiente >= 0 ? indicePendiente : indiceActivo;

  return (
    <nav
      ref={referencia}
      aria-label="Navegación principal"
      className="mob-barra-inferior lg:hidden"
      data-oculta={visible ? "false" : "true"}
      onPointerDown={marcarInteraccion}
    >
      <div className="mob-barra-inferior-pastilla">
        {tabs.map((destino) => (
          <Pestaña
            key={destino.href}
            destino={destino}
            // El pendiente manda sobre el activo: al tocar, la pestaña se
            // enciende en el mismo frame, sin esperar la navegación.
            activo={
              hrefPendiente
                ? destino.href === hrefPendiente
                : estaActivo(pathname, destino.href)
            }
            pendientesEmpleados={pendientesEmpleados}
            alElegir={alElegir}
          />
        ))}
        <span
          aria-hidden="true"
          className="mob-barra-inferior-indicador"
          data-visible={indiceIndicador >= 0 ? "true" : "false"}
          style={
            {
              "--destinos": tabs.length,
              "--indice": Math.max(indiceIndicador, 0),
            } as CSSProperties
          }
        />
      </div>
    </nav>
  );
}
