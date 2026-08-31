/**
 * Semántica de auditoría (issue #40): traduce enums técnicos (`accion`,
 * `entidad`, campos de diff) a lenguaje humano, con la familia y el tono
 * semántico de cada acción. Módulo puro (sin React ni acceso a datos) para
 * poder reusarse tanto en el filtro server-side como en la UI.
 */
import type { AccionAuditoria } from "./registrar";

export type FamiliaAuditoria =
  "SESION" | "VENTA" | "EMPLEADO" | "USUARIO" | "CONFIGURACION" | "ACCESO";

export type TonoAuditoria = "success" | "warning" | "destructive" | "neutral";

export const FAMILIAS_AUDITORIA: {
  valor: FamiliaAuditoria;
  etiqueta: string;
}[] = [
  { valor: "SESION", etiqueta: "Sesión" },
  { valor: "VENTA", etiqueta: "Venta" },
  { valor: "EMPLEADO", etiqueta: "Empleado" },
  { valor: "USUARIO", etiqueta: "Usuario" },
  { valor: "CONFIGURACION", etiqueta: "Configuración" },
  { valor: "ACCESO", etiqueta: "Acceso" },
];

type MetaAccion = {
  familia: FamiliaAuditoria;
  /** Verbo en pasado, tercera persona: "{actor} {verbo}". */
  verbo: string;
  tono: TonoAuditoria;
};

/**
 * Una entrada por cada valor de `accion_auditoria` (`src/db/schema.ts`). Un
 * test de cobertura (`semantica.test.ts`) falla si el enum crece sin que
 * este mapa se actualice.
 */
const META_ACCION: Record<AccionAuditoria, MetaAccion> = {
  LOGIN_OK: { familia: "SESION", verbo: "inició sesión", tono: "success" },
  LOGIN_FALLIDO: {
    familia: "SESION",
    verbo: "intentó iniciar sesión sin éxito",
    tono: "destructive",
  },
  LOGOUT: { familia: "SESION", verbo: "cerró sesión", tono: "neutral" },
  PASSWORD_CAMBIADA: {
    familia: "ACCESO",
    verbo: "cambió su contraseña",
    tono: "neutral",
  },
  PASSWORD_RESETEADA: {
    familia: "ACCESO",
    verbo: "restableció una contraseña",
    tono: "warning",
  },
  EMPRESA_CREADA: {
    familia: "CONFIGURACION",
    verbo: "creó una empresa",
    tono: "success",
  },
  EMPRESA_ACTUALIZADA: {
    familia: "CONFIGURACION",
    verbo: "actualizó una empresa",
    tono: "neutral",
  },
  SEDE_CREADA: {
    familia: "CONFIGURACION",
    verbo: "creó una sede",
    tono: "success",
  },
  SEDE_ACTUALIZADA: {
    familia: "CONFIGURACION",
    verbo: "actualizó una sede",
    tono: "neutral",
  },
  CONVENIO_CREADO: {
    familia: "CONFIGURACION",
    verbo: "creó un convenio",
    tono: "success",
  },
  CONVENIO_ACTUALIZADO: {
    familia: "CONFIGURACION",
    verbo: "actualizó un convenio",
    tono: "neutral",
  },
  TERMINO_CREADO: {
    familia: "CONFIGURACION",
    verbo: "definió un término de descuento",
    tono: "success",
  },
  TERMINO_CERRADO: {
    familia: "CONFIGURACION",
    verbo: "cerró un término de descuento",
    tono: "neutral",
  },
  USUARIO_CREADO: {
    familia: "USUARIO",
    verbo: "creó un usuario",
    tono: "success",
  },
  USUARIO_ACTUALIZADO: {
    familia: "USUARIO",
    verbo: "actualizó un usuario",
    tono: "neutral",
  },
  USUARIO_DESACTIVADO: {
    familia: "USUARIO",
    verbo: "desactivó un usuario",
    tono: "destructive",
  },
  EMPLEADO_CREADO: {
    familia: "EMPLEADO",
    verbo: "registró un empleado",
    tono: "success",
  },
  EMPLEADO_ACTUALIZADO: {
    familia: "EMPLEADO",
    verbo: "actualizó un empleado",
    tono: "neutral",
  },
  EMPLEADO_VERIFICADO: {
    familia: "EMPLEADO",
    verbo: "verificó un empleado",
    tono: "success",
  },
  EMPLEADO_RECHAZADO: {
    familia: "EMPLEADO",
    verbo: "rechazó un empleado",
    tono: "destructive",
  },
  BUSQUEDA_DNI: {
    familia: "ACCESO",
    verbo: "buscó un DNI",
    tono: "neutral",
  },
  BUSQUEDA_DOCUMENTO: {
    familia: "ACCESO",
    verbo: "buscó un documento",
    tono: "neutral",
  },
  VENTA_CREADA: {
    familia: "VENTA",
    verbo: "registró una venta",
    tono: "success",
  },
  VENTA_ANULADA: {
    familia: "VENTA",
    verbo: "anuló una venta",
    tono: "destructive",
  },
  ADJUNTO_SUBIDO: {
    familia: "VENTA",
    verbo: "subió un adjunto",
    tono: "neutral",
  },
  ADJUNTO_VISTO: {
    familia: "ACCESO",
    verbo: "vio un adjunto",
    tono: "neutral",
  },
  EXPORTACION: {
    familia: "ACCESO",
    verbo: "exportó datos",
    tono: "warning",
  },
};

/** Título corto por acción, para selects y chips (distinto del verbo de `fraseAuditoria`). */
const ETIQUETA_ACCION: Record<AccionAuditoria, string> = {
  LOGIN_OK: "Inicio de sesión",
  LOGIN_FALLIDO: "Inicio de sesión fallido",
  LOGOUT: "Cierre de sesión",
  PASSWORD_CAMBIADA: "Contraseña cambiada",
  PASSWORD_RESETEADA: "Contraseña restablecida",
  EMPRESA_CREADA: "Empresa creada",
  EMPRESA_ACTUALIZADA: "Empresa actualizada",
  SEDE_CREADA: "Sede creada",
  SEDE_ACTUALIZADA: "Sede actualizada",
  CONVENIO_CREADO: "Convenio creado",
  CONVENIO_ACTUALIZADO: "Convenio actualizado",
  TERMINO_CREADO: "Término creado",
  TERMINO_CERRADO: "Término cerrado",
  USUARIO_CREADO: "Usuario creado",
  USUARIO_ACTUALIZADO: "Usuario actualizado",
  USUARIO_DESACTIVADO: "Usuario desactivado",
  EMPLEADO_CREADO: "Empleado creado",
  EMPLEADO_ACTUALIZADO: "Empleado actualizado",
  EMPLEADO_VERIFICADO: "Empleado verificado",
  EMPLEADO_RECHAZADO: "Empleado rechazado",
  BUSQUEDA_DNI: "Búsqueda de DNI",
  BUSQUEDA_DOCUMENTO: "Búsqueda de documento",
  VENTA_CREADA: "Venta registrada",
  VENTA_ANULADA: "Venta anulada",
  ADJUNTO_SUBIDO: "Adjunto subido",
  ADJUNTO_VISTO: "Adjunto visto",
  EXPORTACION: "Exportación",
};

export function etiquetaAccion(accion: string): string {
  return Object.prototype.hasOwnProperty.call(ETIQUETA_ACCION, accion)
    ? ETIQUETA_ACCION[accion as AccionAuditoria]
    : accion;
}

/** Opciones para el select de acción, agrupadas por familia y ordenadas alfabéticamente. */
export const ACCIONES_AUDITORIA: {
  valor: AccionAuditoria;
  etiqueta: string;
  familia: FamiliaAuditoria;
}[] = (Object.keys(META_ACCION) as AccionAuditoria[])
  .map((valor) => ({
    valor,
    etiqueta: ETIQUETA_ACCION[valor],
    familia: META_ACCION[valor].familia,
  }))
  .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));

export function metaDeAccion(accion: string): MetaAccion | null {
  return Object.prototype.hasOwnProperty.call(META_ACCION, accion)
    ? META_ACCION[accion as AccionAuditoria]
    : null;
}

export function accionesDeFamilia(familia: FamiliaAuditoria): string[] {
  return (Object.keys(META_ACCION) as AccionAuditoria[]).filter(
    (accion) => META_ACCION[accion].familia === familia,
  );
}

export function esFamiliaAuditoria(valor: unknown): valor is FamiliaAuditoria {
  return (
    typeof valor === "string" &&
    FAMILIAS_AUDITORIA.some((familia) => familia.valor === valor)
  );
}

/** Entidades usadas por `registrar()` en todo el código (`grep entidad: "`). */
export const ENTIDADES_AUDITORIA: { valor: string; etiqueta: string }[] = [
  { valor: "usuario", etiqueta: "Usuario" },
  { valor: "sesion", etiqueta: "Sesión" },
  { valor: "empresa", etiqueta: "Empresa" },
  { valor: "sede", etiqueta: "Sede" },
  { valor: "convenio", etiqueta: "Convenio" },
  { valor: "convenio_termino", etiqueta: "Término de convenio" },
  { valor: "empleado", etiqueta: "Empleado" },
  { valor: "venta", etiqueta: "Venta" },
  { valor: "adjunto", etiqueta: "Adjunto" },
];

export function esEntidadAuditoria(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    ENTIDADES_AUDITORIA.some((entidad) => entidad.valor === valor)
  );
}

export function etiquetaEntidad(entidad: string): string {
  return (
    ENTIDADES_AUDITORIA.find((candidata) => candidata.valor === entidad)
      ?.etiqueta ?? entidad
  );
}

/** Nombres de campo con traducción propia; el resto se humaniza automáticamente. */
const ETIQUETAS_CAMPO: Record<string, string> = {
  username: "Usuario",
  nombres: "Nombres",
  apellidos: "Apellidos",
  rol: "Rol",
  activo: "Activo",
  email: "Correo",
  telefono: "Teléfono",
  dni: "DNI",
  ruc: "RUC",
  empresaId: "Empresa",
  empleadoId: "Empleado",
  sedeId: "Sede",
  sedePorDefectoId: "Sede por defecto",
  convenioId: "Convenio",
  terminoId: "Término",
  nombreComercial: "Nombre comercial",
  razonSocial: "Razón social",
  direccion: "Dirección",
  descuentoPorcentaje: "Descuento (%)",
  montoCentimos: "Monto",
  montoFinalCentimos: "Monto final",
  motivo: "Motivo",
  estado: "Estado",
  numeroDocumento: "Número de documento",
  tipoDocumento: "Tipo de documento",
  vigenteDesde: "Vigente desde",
  vigenteHasta: "Vigente hasta",
};

/** Traduce un nombre de campo del diff a un rótulo legible (05 §7, issue #40). */
export function etiquetaCampo(campo: string): string {
  const conocida = ETIQUETAS_CAMPO[campo];
  if (conocida) return conocida;
  const espaciado = campo
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return espaciado.charAt(0).toUpperCase() + espaciado.slice(1);
}

/** Frase humana principal de un evento; IDs y enums quedan como metadata secundaria. */
export function fraseAuditoria(fila: {
  accion: string;
  actor: { nombres: string; apellidos: string } | null;
}): string {
  const actor = fila.actor
    ? `${fila.actor.nombres} ${fila.actor.apellidos}`
    : "El sistema";
  const meta = metaDeAccion(fila.accion);
  return `${actor} ${meta ? meta.verbo : `ejecutó ${fila.accion}`}`;
}
