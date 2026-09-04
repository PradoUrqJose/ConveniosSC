/**
 * Ocultamiento por scroll de la barra inferior móvil — issue #53
 * (PWA-MOB-03), doc §3.
 *
 * La regla vive acá, fuera de React y del DOM, por dos motivos: es la
 * parte con estado real (histéresis + bloqueo antiparpadeo) y es la única
 * que se puede probar sin navegador (`barra-scroll.test.ts`). El
 * componente sólo le pasa medidas y aplica `visible`.
 */

/** Scroll descendente acumulado que oculta la barra. */
export const UMBRAL_OCULTAR = 80;
/** Scroll ascendente acumulado que la devuelve. Más corto: recuperar es barato. */
export const UMBRAL_MOSTRAR = 30;
/** Bloqueo entre cambios de estado, para que un rebote no la haga parpadear. */
export const BLOQUEO_MS = 150;
/** Zona superior en la que la barra está siempre visible. */
export const ZONA_SUPERIOR = UMBRAL_OCULTAR;
/** Tolerancia para dar el scroll por terminado (redondeos de zoom/iOS). */
const TOLERANCIA_FONDO = 2;

export type EstadoBarra = {
  visible: boolean;
  /** Posición desde la que se mide el desplazamiento acumulado. */
  ancla: number;
  /** Último scroll observado; da la dirección. */
  ultimaY: number;
  /** Instante hasta el que no se admite otro cambio de estado. */
  bloqueadaHasta: number;
};

export type MedidasScroll = {
  y: number;
  alturaViewport: number;
  alturaDocumento: number;
  ahora: number;
  /**
   * `false` congela la barra visible: foco dentro de ella, teclado
   * abierto, interacción en curso o `prefers-reduced-motion`.
   */
  permitirOcultar: boolean;
};

export function estadoInicialBarra(y = 0): EstadoBarra {
  return { visible: true, ancla: y, ultimaY: y, bloqueadaHasta: 0 };
}

/**
 * Rebote de iOS incluido: `y` puede ser negativo arriba o pasarse del
 * fondo. En los dos extremos la barra se queda visible en vez de
 * interpretar el rebote como intención de scroll.
 */
export function siguienteEstadoBarra(
  estado: EstadoBarra,
  medidas: MedidasScroll,
): EstadoBarra {
  const { y, alturaViewport, alturaDocumento, ahora, permitirOcultar } =
    medidas;

  if (!permitirOcultar) {
    return { visible: true, ancla: y, ultimaY: y, bloqueadaHasta: 0 };
  }

  const enTope = y <= ZONA_SUPERIOR;
  const enFondo = y + alturaViewport >= alturaDocumento - TOLERANCIA_FONDO;
  if (enTope || enFondo) {
    return { ...estado, visible: true, ancla: y, ultimaY: y };
  }

  const bajando = y > estado.ultimaY;
  const subiendo = y < estado.ultimaY;
  // Al cambiar de dirección el acumulado se mide desde el punto de giro:
  // 80px hacia abajo se cuentan seguidos, no repartidos entre idas y vueltas.
  const cambioDeDireccion =
    (bajando && y < estado.ancla) || (subiendo && y > estado.ancla);
  const ancla = cambioDeDireccion ? estado.ultimaY : estado.ancla;
  const base = { ...estado, ancla, ultimaY: y };

  if (ahora < estado.bloqueadaHasta) {
    return base;
  }

  const recorrido = y - ancla;
  if (estado.visible && recorrido >= UMBRAL_OCULTAR) {
    return {
      visible: false,
      ancla: y,
      ultimaY: y,
      bloqueadaHasta: ahora + BLOQUEO_MS,
    };
  }
  if (!estado.visible && -recorrido >= UMBRAL_MOSTRAR) {
    return {
      visible: true,
      ancla: y,
      ultimaY: y,
      bloqueadaHasta: ahora + BLOQUEO_MS,
    };
  }
  return base;
}
