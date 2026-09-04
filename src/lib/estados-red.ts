/**
 * Clasificación de fallos y umbrales de estado — issue #56 (PWA-MOB-06).
 *
 * Vive fuera de React y del DOM, como `barra-scroll.ts` (#53) y
 * `capas-movil.ts` (#54): decidir «esto es red caída y no un 500», «esto se
 * puede reintentar solo» o «esto todavía no merece un esqueleto» son las
 * reglas de verdad de los estados de carga/error, y así se prueban sin
 * montar un navegador ni tumbar un servidor.
 *
 * Las pantallas solo consumen el resultado: `ErrorRuta`, `ErrorParcial`,
 * `EsqueletoDiferido` y la página `~offline` no repiten ni un `if`.
 */

import type { CodigoError } from "@/lib/tipos";

/**
 * Cómo falló algo. La auditoría pedía separar cuatro casos que hasta ahora
 * se veían iguales ("Ocurrió un error"), porque la salida del usuario es
 * distinta en cada uno:
 *
 * - `offline`: el dispositivo no tiene red. No hay nada que reintentar
 *   hasta que vuelva; se reintenta solo al reconectar.
 * - `servidor`: hay red, pero el servidor no responde o devolvió 5xx.
 *   Reintentar tiene sentido, con espera creciente.
 * - `timeout`: la petición salió y no volvió a tiempo. Igual que `servidor`
 *   para el usuario, pero se cuenta aparte porque en 3G es lo normal y no
 *   debe leerse como "el sistema está caído".
 * - `sesion` (401): reintentar no arregla nada; hay que volver a entrar.
 * - `permiso` (403): tampoco se arregla reintentando, y además no se ofrece
 *   login porque la sesión es válida.
 * - `datos`: 4xx de negocio (validación, conflicto, no encontrado). El
 *   error está en lo que se pidió, no en el transporte.
 */
export type ClaseFallo =
  | "offline"
  | "servidor"
  | "timeout"
  | "sesion"
  | "permiso"
  | "datos"
  | "desconocido";

/** Qué se le ofrece al usuario para salir del estado. */
export type Recuperacion =
  "esperar-red" | "reintentar" | "reautenticar" | "volver" | "ninguna";

/**
 * Umbral antes de dibujar un esqueleto. Por debajo de ~200 ms el esqueleto
 * aparece y desaparece en el mismo parpadeo y se lee como un defecto; por
 * encima, la espera sin nada en pantalla se lee como una app colgada.
 */
export const MS_UMBRAL_ESQUELETO = 200;

/**
 * Tope de espera de una operación de cliente antes de declararla `timeout`.
 * En 3G lento una búsqueda de documento tarda segundos; 12 s deja pasar la
 * cola larga sin dejar al usuario mirando un botón girando para siempre.
 */
export const MS_TIMEOUT_ACCION = 12_000;

/** Cuánto esperar antes del reintento número `intento` (0 = el primero). */
export function retrasoReintento(intento: number): number {
  const base = 500 * 2 ** Math.max(0, intento);
  return Math.min(base, 8_000);
}

/** ¿Ya pasó el umbral y toca mostrar el esqueleto? */
export function debeMostrarEsqueleto(
  msTranscurridos: number,
  umbral = MS_UMBRAL_ESQUELETO,
): boolean {
  return msTranscurridos >= umbral;
}

const POR_CODIGO: Record<CodigoError, ClaseFallo> = {
  NO_AUTENTICADO: "sesion",
  SIN_PERMISO: "permiso",
  NO_ENCONTRADO: "datos",
  VALIDACION: "datos",
  CONFLICTO: "datos",
  LIMITE_EXCEDIDO: "datos",
  REGLA_NEGOCIO: "datos",
  ERROR_INTERNO: "servidor",
};

function esCodigoConocido(valor: unknown): valor is CodigoError {
  return typeof valor === "string" && valor in POR_CODIGO;
}

/** Fallos de transporte de `fetch`, que llegan como `TypeError` sin código. */
function esFalloDeTransporte(mensaje: string): boolean {
  const texto = mensaje.toLowerCase();
  return (
    texto.includes("failed to fetch") ||
    texto.includes("networkerror") ||
    texto.includes("network request failed") ||
    texto.includes("load failed") ||
    texto.includes("connection closed") ||
    texto.includes("fetch failed")
  );
}

function esAborto(nombre: string, mensaje: string): boolean {
  const texto = `${nombre} ${mensaje}`.toLowerCase();
  return (
    texto.includes("aborterror") ||
    texto.includes("timeouterror") ||
    texto.includes("timeout") ||
    texto.includes("timed out")
  );
}

/**
 * Clasifica un fallo con lo que haya disponible. Las señales se leen en
 * orden de confianza: sin red no importa qué dijo el servidor (no dijo
 * nada); luego el código de dominio; luego el HTTP; y solo al final la
 * forma del `Error`, que es la pista más frágil.
 *
 * `enLinea` se pasa desde fuera (`navigator.onLine`) para que la función
 * siga siendo pura y comprobable.
 */
export function clasificarFallo(entrada: {
  error?: unknown;
  estadoHttp?: number | null;
  codigo?: string | null;
  /** `navigator.onLine`. `undefined` = no se sabe (servidor). */
  enLinea?: boolean;
}): ClaseFallo {
  const { error, estadoHttp, codigo, enLinea } = entrada;

  if (enLinea === false) return "offline";

  if (esCodigoConocido(codigo)) return POR_CODIGO[codigo];

  if (typeof estadoHttp === "number" && estadoHttp > 0) {
    if (estadoHttp === 401) return "sesion";
    if (estadoHttp === 403) return "permiso";
    if (estadoHttp === 408 || estadoHttp === 504) return "timeout";
    if (estadoHttp >= 500) return "servidor";
    if (estadoHttp >= 400) return "datos";
    return "desconocido";
  }

  if (error !== null && error !== undefined) {
    const nombre = error instanceof Error ? error.name : "";
    const mensaje =
      error instanceof Error ? error.message : String(error ?? "");
    if (esAborto(nombre, mensaje)) return "timeout";
    // Con red y `fetch` rechazado: el dispositivo está conectado pero el
    // servidor no contesta. Es exactamente el caso que la página offline
    // tenía que dejar de confundir con "no hay internet".
    if (esFalloDeTransporte(mensaje)) return "servidor";
  }

  return "desconocido";
}

/** ¿Tiene sentido volver a intentar lo mismo? */
export function esReintentable(clase: ClaseFallo): boolean {
  return (
    clase === "offline" ||
    clase === "servidor" ||
    clase === "timeout" ||
    clase === "desconocido"
  );
}

/**
 * ¿Puede el código reintentar **por su cuenta**, sin que el usuario toque
 * nada? Solo para lecturas: reenviar una mutación que quizá sí llegó al
 * servidor duplicaría una venta. Ante la duda, se lo preguntamos al usuario.
 */
export function reintentoAutomaticoSeguro({
  clase,
  mutacion,
}: {
  clase: ClaseFallo;
  mutacion: boolean;
}): boolean {
  if (mutacion) return false;
  return clase === "offline" || clase === "servidor" || clase === "timeout";
}

/** Acción principal que ofrece la UI para cada clase. */
export function recuperacionDe(clase: ClaseFallo): Recuperacion {
  if (clase === "offline") return "esperar-red";
  if (clase === "sesion") return "reautenticar";
  if (clase === "permiso" || clase === "datos") return "volver";
  if (esReintentable(clase)) return "reintentar";
  return "ninguna";
}

export type CopiaFallo = {
  titulo: string;
  descripcion: string;
  /** Texto del botón principal; `null` cuando no hay acción que ofrecer. */
  accion: string | null;
};

/**
 * Texto en español, sin jerga y sin culpar al usuario. Se centraliza acá
 * para que la misma caída se lea igual en la página de error de ruta, en un
 * panel parcial y en un toast.
 */
export function copiaFallo(clase: ClaseFallo): CopiaFallo {
  switch (clase) {
    case "offline":
      return {
        titulo: "Sin conexión",
        descripcion:
          "Tu dispositivo no tiene internet. Lo que escribiste sigue acá; en cuanto vuelva la señal reintentamos solos.",
        accion: "Reintentar",
      };
    case "servidor":
      return {
        titulo: "El servidor no responde",
        descripcion:
          "Tienes internet, pero no pudimos comunicarnos con Convenios. Suele ser pasajero: vuelve a intentar en unos segundos.",
        accion: "Reintentar",
      };
    case "timeout":
      return {
        titulo: "La conexión está lenta",
        descripcion:
          "La respuesta demoró más de lo normal. Si estás en una zona con poca señal, reintenta sin salir de la pantalla.",
        accion: "Reintentar",
      };
    case "sesion":
      return {
        titulo: "Tu sesión venció",
        descripcion:
          "Por seguridad cerramos la sesión tras un tiempo sin uso. Vuelve a entrar y te devolvemos a esta pantalla.",
        accion: "Iniciar sesión",
      };
    case "permiso":
      return {
        titulo: "No tienes acceso a esto",
        descripcion:
          "Tu usuario no tiene permiso sobre esta información. Si crees que es un error, escríbele al administrador de tu empresa.",
        accion: "Volver",
      };
    case "datos":
      return {
        titulo: "No pudimos mostrar esta información",
        descripcion:
          "Los datos pedidos no son válidos o ya no existen. Revisa los filtros o vuelve a la pantalla anterior.",
        accion: "Volver",
      };
    default:
      return {
        titulo: "Algo salió mal",
        descripcion:
          "No pudimos completar la operación. Reintenta; si vuelve a pasar, avísale al administrador con la hora exacta.",
        accion: "Reintentar",
      };
  }
}
