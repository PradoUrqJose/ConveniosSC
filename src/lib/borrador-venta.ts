/**
 * Borrador local del formulario de venta (D08, 04 §4 "Borrador local").
 * Solo funciones puras sobre `localStorage`; el componente decide cuándo
 * leer (al montar), guardar (con debounce) y borrar (al guardar con éxito o
 * descartar). Nunca se llama durante el render de servidor: siempre desde
 * un `useEffect` o un manejador de evento.
 */

export type EvidenciaBorrador = {
  blobPath: string;
  sha256: string;
  mime: string;
  sizeBytes: number;
  descripcion: string;
};

export type EmpleadoBorrador = {
  id: string;
  tipoDocumento: "DNI" | "CARNET_EXTRANJERIA";
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  empresaId: string;
  empresaNombre: string;
  estado: string;
  descuentoBps: number;
};

export type BorradorVenta = {
  ventaId: string;
  empresaConvenioId: string | null;
  empleado: EmpleadoBorrador | null;
  sedeId: string | null;
  fechaVenta: string;
  montoBruto: string;
  observacion: string;
  documento: {
    blobPath: string;
    sha256: string;
    mime: string;
    sizeBytes: number;
  } | null;
  evidencias: EvidenciaBorrador[];
  guardadoEn: number;
};

const VEINTICUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

function claveDe(usuarioId: string): string {
  return `venta-borrador:${usuarioId}`;
}

export function leerBorrador(usuarioId: string): BorradorVenta | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(claveDe(usuarioId));
    if (!bruto) return null;
    return JSON.parse(bruto) as BorradorVenta;
  } catch {
    return null;
  }
}

/** Un borrador solo es relevante para el banner de "continuar" si tiene menos de 24 h. */
export function borradorVigente(borrador: BorradorVenta | null): boolean {
  if (!borrador) return false;
  return Date.now() - borrador.guardadoEn < VEINTICUATRO_HORAS_MS;
}

export function guardarBorrador(
  usuarioId: string,
  datos: Omit<BorradorVenta, "guardadoEn">,
): void {
  if (typeof window === "undefined") return;
  try {
    const completo: BorradorVenta = { ...datos, guardadoEn: Date.now() };
    window.localStorage.setItem(claveDe(usuarioId), JSON.stringify(completo));
  } catch {
    // localStorage lleno o deshabilitado: el borrador es una mejora, no un requisito.
  }
}

export function borrarBorrador(usuarioId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(claveDe(usuarioId));
  } catch {
    // no-op
  }
}
