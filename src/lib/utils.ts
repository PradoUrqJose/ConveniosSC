import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CONECTORES_NOMBRE = new Set(["de", "del", "la", "las", "los", "y"]);

/**
 * Normaliza un nombre a capitalización natural (Título Case), en vez de
 * mostrarlo tal cual se tipeó (a veces todo en mayúsculas) o forzarlo con
 * `.toUpperCase()` en la UI. Los conectores comunes de apellidos peruanos
 * ("de", "del", "la"...) quedan en minúscula salvo que abran la palabra.
 */
export function capitalizarNombre(texto: string): string {
  return texto
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((palabra, i) =>
      i > 0 && CONECTORES_NOMBRE.has(palabra)
        ? palabra
        : palabra.charAt(0).toUpperCase() + palabra.slice(1),
    )
    .join(" ");
}
