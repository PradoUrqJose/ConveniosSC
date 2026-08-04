export type Resultado<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      codigo: CodigoError;
      mensaje: string;
      campo?: string;
      /** Destino sugerido para el usuario (p. ej. en CONFLICTO). */
      enlace?: string;
    };

export type Pagina<T> = {
  items: T[];
  cursor: string | null; // null = no hay más
  total?: number; // solo en la primera página
};

export type CodigoError =
  | "NO_AUTENTICADO"
  | "SIN_PERMISO"
  | "NO_ENCONTRADO"
  | "VALIDACION"
  | "CONFLICTO"
  | "LIMITE_EXCEDIDO"
  | "REGLA_NEGOCIO"
  | "ERROR_INTERNO";
