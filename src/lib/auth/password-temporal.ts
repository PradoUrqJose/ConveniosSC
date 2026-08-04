import { randomInt } from "node:crypto";

/**
 * Contraseña temporal legible de 3 bloques (02 §6, 03 §5): `palabra-NN-palabra`
 * (ej. `verde-42-lima`). Solo minúsculas sin tildes y un número de dos dígitos,
 * siempre ≥ 8 caracteres y con letras y dígitos (cumple la política de 02 §6).
 * No se persiste en claro: se devuelve una sola vez al crearla o resetearla.
 */
const PALABRAS = [
  "verde",
  "lima",
  "casa",
  "lago",
  "vino",
  "miel",
  "roble",
  "vela",
  "seda",
  "nube",
  "monte",
  "ruta",
  "pino",
  "brazo",
  "cielo",
  "duro",
  "faro",
  "grano",
  "hielo",
  "jade",
  "kiwi",
  "luna",
  "marco",
  "norte",
  "olivo",
  "paso",
  "quima",
  "rama",
  "sol",
  "toro",
  "uva",
  "valle",
  "wira",
  "yema",
  "zorro",
  "alma",
  "brisa",
  "cobre",
  "duna",
  "eco",
  "flor",
  "globo",
  "hoja",
  "isla",
  "jarra",
  "kilo",
  "lomo",
  "muro",
  "nuez",
  "olmo",
  "puma",
  "quena",
  "rosa",
  "sapo",
  "tiza",
  "urna",
  "villa",
  "yate",
  "zafiro",
  "aroma",
] as const;

export function generarPasswordTemporal(): string {
  const a = PALABRAS[randomInt(PALABRAS.length)];
  let b = PALABRAS[randomInt(PALABRAS.length)];
  while (b === a) {
    b = PALABRAS[randomInt(PALABRAS.length)];
  }
  const numero = randomInt(10, 100);
  return `${a}-${numero}-${b}`;
}
