/**
 * Aritmética de dinero. Único lugar del proyecto donde se hacen cuentas con importes.
 * Todo importe es SIEMPRE un entero de céntimos. Nunca un float, nunca un string (D17).
 */

export type Centimos = number;
export type Bps = number;

/** Redondeo half-up. Math.round ya es half-up para positivos, y aquí nunca hay negativos. */
export function calcularDescuento(
  bruto: Centimos,
  bps: Bps,
): {
  descuento: Centimos;
  final: Centimos;
} {
  const descuento = Math.round((bruto * bps) / 10_000);
  return { descuento, final: bruto - descuento };
}

const SOLO_DIGITOS = /^\d+$/;
const MONTO_NORMALIZADO = /^\d+(\.\d{1,2})?$/;

/** "1234.5" | "1,234.50" | "1234,50" → 123450 céntimos. Lanza si es inválido. */
export function parsearSoles(entrada: string): Centimos {
  const limpio = entrada.trim();
  if (limpio === "") {
    throw new Error("Monto inválido");
  }

  if (SOLO_DIGITOS.test(limpio)) {
    return Number(limpio) * 100;
  }

  const tieneComa = limpio.includes(",");
  const tienePunto = limpio.includes(".");

  let separadorDecimal: "," | "." | null = null;

  if (tieneComa && tienePunto) {
    separadorDecimal =
      limpio.lastIndexOf(",") > limpio.lastIndexOf(".") ? "," : ".";
  } else if (tieneComa) {
    separadorDecimal = esSeparadorDecimal(limpio, ",") ? "," : null;
  } else if (tienePunto) {
    separadorDecimal = esSeparadorDecimal(limpio, ".") ? "." : null;
  }

  const separadorMiles =
    separadorDecimal === "," ? "." : separadorDecimal === "." ? "," : null;

  let normalizado = separadorMiles
    ? limpio.split(separadorMiles).join("")
    : limpio.replace(/[.,]/g, "");

  if (separadorDecimal) {
    normalizado = normalizado.replace(separadorDecimal, ".");
  }

  if (!MONTO_NORMALIZADO.test(normalizado)) {
    throw new Error("Monto inválido");
  }

  const [enteroTexto, decimalTexto] = normalizado.split(".");
  const entero = Number(enteroTexto ?? "0");
  const decimalPadded = `${decimalTexto ?? ""}00`.slice(0, 2);

  return entero * 100 + Number(decimalPadded);
}

/** Un único separador seguido de 1 o 2 dígitos hasta el final se interpreta como decimal. */
function esSeparadorDecimal(valor: string, separador: "," | "."): boolean {
  const partes = valor.split(separador);
  if (partes.length !== 2) return false;
  const ultima = partes[1] ?? "";
  return ultima.length >= 1 && ultima.length <= 2;
}

/** 123450 → "S/ 1,234.50" */
export function formatearSoles(c: Centimos): string {
  const negativo = c < 0;
  const abs = Math.abs(c);
  const entero = Math.trunc(abs / 100);
  const centavos = abs % 100;
  const enteroFormateado = entero.toLocaleString("en-US");
  const centavosFormateado = centavos.toString().padStart(2, "0");

  return `${negativo ? "-" : ""}S/ ${enteroFormateado}.${centavosFormateado}`;
}
