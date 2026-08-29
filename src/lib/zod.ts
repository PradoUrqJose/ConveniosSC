import { z } from "zod";

import { parsearSoles } from "@/lib/dinero";

export const TIPOS_DOCUMENTO = ["DNI", "CARNET_EXTRANJERIA"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const zTipoDocumento = z.enum(TIPOS_DOCUMENTO);

const zDni = z.string().regex(/^\d{8}$/, "El DNI debe tener 8 dígitos");
const zCarnetExtranjeria = z
  .string()
  .regex(
    /^[A-Z0-9]([A-Z0-9-]{0,10}[A-Z0-9])?$/,
    "El Carné de Extranjería debe tener hasta 12 caracteres alfanuméricos",
  );

/** Identidad normalizada y validada según el tipo de documento. */
export const zDocumentoIdentidad = z
  .object({
    tipoDocumento: zTipoDocumento,
    numeroDocumento: z.string(),
  })
  .transform((documento) => ({
    ...documento,
    numeroDocumento: documento.numeroDocumento.trim().toUpperCase(),
  }))
  .superRefine((documento, ctx) => {
    const esquema =
      documento.tipoDocumento === "DNI" ? zDni : zCarnetExtranjeria;
    const resultado = esquema.safeParse(documento.numeroDocumento);
    if (!resultado.success) {
      ctx.addIssue({
        code: "custom",
        path: ["numeroDocumento"],
        message: resultado.error.issues[0]?.message ?? "Documento inválido",
      });
    }
  });
export const zRuc = z
  .string()
  .regex(/^\d{11}$/, "El RUC debe tener 11 dígitos");
export const zTelefono = z
  .string()
  .regex(/^\d{6,15}$/, "Teléfono inválido")
  .optional();
export const zUuid = z.uuid();
export const zFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
export const zUsername = z
  .string()
  .regex(
    /^[a-z0-9._-]{3,32}$/,
    "Solo minúsculas, números, punto, guion y guion bajo. Entre 3 y 32 caracteres",
  );
export const zPassword = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[a-zA-Z]/, "Debe incluir al menos una letra")
  .regex(/\d/, "Debe incluir al menos un número");
export const zNombre = z.string().trim().min(2).max(80);

/** Monto en soles como texto → céntimos enteros */
export const zMontoSoles = z
  .string()
  .regex(/^\d{1,9}([.,]\d{1,2})?$/, "Monto inválido. Usa hasta 2 decimales")
  .transform(parsearSoles);

/** Checkbox de formulario: `"on"` (o `true`) → `true`; ausente → `false`. */
export const zCheckbox = z
  .preprocess((v) => v === "on" || v === true, z.boolean())
  .default(false);
