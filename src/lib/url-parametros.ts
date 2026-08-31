import { esFechaValida } from "@/lib/fechas";
import { zUuid } from "@/lib/zod";

export type ParametrosUrl = Record<string, string | string[] | undefined>;

export function textoUrl(valor: unknown, maximo = 200): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpio = valor.trim();
  return limpio && limpio.length <= maximo ? limpio : undefined;
}

export function fechaUrl(valor: unknown): string | undefined {
  const candidato = textoUrl(valor, 10);
  return candidato && esFechaValida(candidato) ? candidato : undefined;
}

export function uuidUrl(valor: unknown): string | undefined {
  const candidato = textoUrl(valor, 100);
  return candidato && zUuid.safeParse(candidato).success
    ? candidato
    : undefined;
}

/** Descarta el rango completo si sus extremos válidos están invertidos. */
export function rangoFechasUrl(
  desde: unknown,
  hasta: unknown,
): { desde?: string; hasta?: string } {
  const inicio = fechaUrl(desde);
  const fin = fechaUrl(hasta);
  return inicio && fin && inicio > fin ? {} : { desde: inicio, hasta: fin };
}

export function parametrosUrlCanonicos(
  entrada: ParametrosUrl,
  salida: URLSearchParams,
): boolean {
  const actual = new URLSearchParams();
  for (const [clave, valor] of Object.entries(entrada)) {
    if (typeof valor === "string") actual.append(clave, valor);
    else if (Array.isArray(valor)) {
      for (const item of valor) actual.append(clave, item);
    }
  }
  return actual.toString() === salida.toString();
}
