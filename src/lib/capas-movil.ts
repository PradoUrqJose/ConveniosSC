/**
 * Reglas de las capas móviles — issue #54 (PWA-MOB-04).
 *
 * Vive fuera de React y del DOM, como `barra-scroll.ts` (#53): la decisión
 * de "esto se cierra / esto pide confirmación / esto no se mueve" es la
 * parte del bottom sheet con reglas de verdad, y así se puede probar sin
 * montar un sheet ni un navegador.
 */

/** Motivos de cierre que emite Base UI (`Drawer.Root.ChangeEventReason`). */
export type RazonCierre =
  | "trigger-press"
  | "outside-press"
  | "escape-key"
  | "close-watcher"
  | "close-press"
  | "focus-out"
  | "imperative-action"
  | "swipe"
  | "none";

export type DecisionCierre = "cerrar" | "confirmar" | "bloquear";

/**
 * Qué hacer ante un intento de cierre.
 *
 * - `bloquear`: no pasa nada. Mientras una Server Action está en vuelo el
 *   contenido puede cambiar bajo los pies del usuario; y el toque fuera es
 *   el gesto más accidental de todos, así que con un formulario a medio
 *   llenar tampoco hace nada (doc de diseño §5: "tocar afuera no cierra los
 *   que tienen un formulario a medio llenar").
 * - `confirmar`: hay cambios sin guardar y el gesto fue deliberado (Escape,
 *   la X, arrastrar). Se pregunta *dentro de la misma capa*, sin encadenar
 *   un modal encima.
 * - `cerrar`: no hay nada que perder, o el cierre lo pidió el propio código
 *   (`imperative-action`/`none`) después de guardar.
 */
export function decidirCierre({
  razon,
  hayCambios,
  pendiente,
}: {
  razon: RazonCierre;
  hayCambios: boolean;
  pendiente: boolean;
}): DecisionCierre {
  if (pendiente) return "bloquear";
  if (!hayCambios) return "cerrar";
  if (razon === "imperative-action" || razon === "none") return "cerrar";
  if (razon === "outside-press" || razon === "focus-out") return "bloquear";
  return "confirmar";
}

/** Un grupo de filtros del sheet: una fila que empuja su subpágina. */
export type GrupoFiltro = {
  id: string;
  etiqueta: string;
  /** La primera opción es el valor "sin filtrar" del grupo. */
  opciones: { valor: string; etiqueta: string }[];
};

export type ValoresFiltro = Record<string, string>;

/** Valor neutro de cada grupo: la primera opción. */
export function valoresNeutros(grupos: GrupoFiltro[]): ValoresFiltro {
  return Object.fromEntries(
    grupos.map((grupo) => [grupo.id, grupo.opciones[0]?.valor ?? ""]),
  );
}

/** Cuántos grupos están fuera de su valor neutro (para el punto del icon button). */
export function contarFiltrosActivos(
  grupos: GrupoFiltro[],
  valores: ValoresFiltro,
): number {
  const neutros = valoresNeutros(grupos);
  return grupos.filter((grupo) => valores[grupo.id] !== neutros[grupo.id])
    .length;
}

/** El borrador difiere de lo aplicado: habilita "Aplicar" y protege el cierre. */
export function hayCambiosEnBorrador(
  grupos: GrupoFiltro[],
  aplicados: ValoresFiltro,
  borrador: ValoresFiltro,
): boolean {
  return grupos.some((grupo) => aplicados[grupo.id] !== borrador[grupo.id]);
}

/** Etiqueta que muestra la pill de la fila del grupo. */
export function etiquetaDeValor(grupo: GrupoFiltro, valor: string): string {
  return (
    grupo.opciones.find((opcion) => opcion.valor === valor)?.etiqueta ??
    grupo.opciones[0]?.etiqueta ??
    ""
  );
}
