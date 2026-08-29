import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** CITEXT no tiene tipo nativo en Drizzle (01 §16). */
const citext = customType<{ data: string }>({ dataType: () => "citext" });

/** INET (IP del actor en auditoría y sesiones). */
const inet = customType<{ data: string }>({ dataType: () => "inet" });

export const rolUsuario = pgEnum("rol_usuario", [
  "SUPERADMIN",
  "ADMIN_EMPRESA",
  "VENDEDOR",
]);

export const estadoEmpleado = pgEnum("estado_empleado", [
  "PENDIENTE_VERIFICACION",
  "ACTIVO",
  "RECHAZADO",
  "INACTIVO",
]);

export const tipoDocumentoIdentidad = pgEnum("tipo_documento_identidad", [
  "DNI",
  "CARNET_EXTRANJERIA",
]);

export const estadoConvenio = pgEnum("estado_convenio", [
  "BORRADOR",
  "VIGENTE",
  "SUSPENDIDO",
  "TERMINADO",
]);

export const estadoVenta = pgEnum("estado_venta", ["REGISTRADA", "ANULADA"]);

export const tipoAdjunto = pgEnum("tipo_adjunto", [
  "FOTO_DNI",
  "DOCUMENTO_VENTA",
  "EVIDENCIA",
]);

export const accionAuditoria = pgEnum("accion_auditoria", [
  "LOGIN_OK",
  "LOGIN_FALLIDO",
  "LOGOUT",
  "PASSWORD_CAMBIADA",
  "PASSWORD_RESETEADA",
  "EMPRESA_CREADA",
  "EMPRESA_ACTUALIZADA",
  "SEDE_CREADA",
  "SEDE_ACTUALIZADA",
  "CONVENIO_CREADO",
  "CONVENIO_ACTUALIZADO",
  "TERMINO_CREADO",
  "TERMINO_CERRADO",
  "USUARIO_CREADO",
  "USUARIO_ACTUALIZADO",
  "USUARIO_DESACTIVADO",
  "EMPLEADO_CREADO",
  "EMPLEADO_ACTUALIZADO",
  "EMPLEADO_VERIFICADO",
  "EMPLEADO_RECHAZADO",
  "BUSQUEDA_DNI",
  "BUSQUEDA_DOCUMENTO",
  "VENTA_CREADA",
  "VENTA_ANULADA",
  "ADJUNTO_SUBIDO",
  "ADJUNTO_VISTO",
  "EXPORTACION",
]);

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const empresas = pgTable(
  "empresas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruc: text("ruc").notNull(),
    razonSocial: text("razon_social").notNull(),
    nombreComercial: text("nombre_comercial").notNull(),
    logoBlobPath: text("logo_blob_path"),
    topeMontoVentaCentimos: bigint("tope_monto_venta_centimos", {
      mode: "number",
    })
      .notNull()
      .default(5000000),
    requiereEvidenciaEnVenta: boolean("requiere_evidencia_en_venta")
      .notNull()
      .default(false),
    diasRetroactivosVenta: smallint("dias_retroactivos_venta")
      .notNull()
      .default(7),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("empresas_ruc_uk").on(t.ruc),
    index("empresas_activo_idx")
      .on(t.activo)
      .where(sql`${t.activo}`),
    check("empresas_ruc_check", sql`${t.ruc} ~ '^[0-9]{11}$'`),
    check(
      "empresas_razon_social_check",
      sql`length(${t.razonSocial}) between 3 and 200`,
    ),
    check(
      "empresas_nombre_comercial_check",
      sql`length(${t.nombreComercial}) between 2 and 100`,
    ),
    check("empresas_tope_check", sql`${t.topeMontoVentaCentimos} > 0`),
  ],
);

export const sedes = pgTable(
  "sedes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    nombre: text("nombre").notNull(),
    direccion: text("direccion"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("sedes_empresa_idx")
      .on(t.empresaId)
      .where(sql`${t.activo}`),
    check("sedes_nombre_check", sql`length(${t.nombre}) between 2 and 80`),
    check(
      "sedes_direccion_check",
      sql`${t.direccion} is null or length(${t.direccion}) <= 200`,
    ),
  ],
);

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").references(() => empresas.id),
    username: citext("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    debeCambiarPassword: boolean("debe_cambiar_password")
      .notNull()
      .default(true),
    nombres: text("nombres").notNull(),
    apellidos: text("apellidos").notNull(),
    email: text("email"),
    rol: rolUsuario("rol").notNull(),
    empleadoId: uuid("empleado_id").references((): AnyPgColumn => empleados.id),
    sedePorDefectoId: uuid("sede_por_defecto_id").references(
      (): AnyPgColumn => sedes.id,
    ),
    activo: boolean("activo").notNull().default(true),
    intentosFallidos: smallint("intentos_fallidos").notNull().default(0),
    bloqueadoHasta: timestamptz("bloqueado_hasta"),
    ultimoAccesoAt: timestamptz("ultimo_acceso_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    creadoPorUsuarioId: uuid("creado_por_usuario_id").references(
      (): AnyPgColumn => usuarios.id,
    ),
  },
  (t) => [
    unique("usuarios_username_uk").on(t.username),
    unique("usuarios_empleado_uk").on(t.empleadoId),
    index("usuarios_empresa_idx")
      .on(t.empresaId)
      .where(sql`${t.activo}`),
    check(
      "usuarios_rol_empresa_check",
      sql`(${t.rol} = 'SUPERADMIN' AND ${t.empresaId} IS NULL) OR (${t.rol} <> 'SUPERADMIN' AND ${t.empresaId} IS NOT NULL)`,
    ),
    check(
      "usuarios_username_check",
      sql`${t.username} ~ '^[a-z0-9._-]{3,32}$'`,
    ),
    check("usuarios_nombres_check", sql`length(${t.nombres}) between 2 and 80`),
    check(
      "usuarios_apellidos_check",
      sql`length(${t.apellidos}) between 2 and 80`,
    ),
  ],
);

export const convenios = pgTable(
  "convenios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaAId: uuid("empresa_a_id")
      .notNull()
      .references(() => empresas.id),
    empresaBId: uuid("empresa_b_id")
      .notNull()
      .references(() => empresas.id),
    estado: estadoConvenio("estado").notNull().default("BORRADOR"),
    vigenciaDesde: date("vigencia_desde", { mode: "string" }).notNull(),
    vigenciaHasta: date("vigencia_hasta", { mode: "string" }),
    notas: text("notas"),
    creadoPorUsuarioId: uuid("creado_por_usuario_id").references(
      () => usuarios.id,
    ),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("convenios_par_uk").on(t.empresaAId, t.empresaBId),
    index("convenios_empresa_a_idx").on(t.empresaAId),
    index("convenios_empresa_b_idx").on(t.empresaBId),
    check("convenios_a_b_check", sql`${t.empresaAId} < ${t.empresaBId}`),
    check(
      "convenios_vigencia_check",
      sql`${t.vigenciaHasta} is null or ${t.vigenciaHasta} >= ${t.vigenciaDesde}`,
    ),
    check(
      "convenios_notas_check",
      sql`${t.notas} is null or length(${t.notas}) <= 1000`,
    ),
  ],
);

export const convenioTerminos = pgTable(
  "convenio_terminos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    convenioId: uuid("convenio_id")
      .notNull()
      .references(() => convenios.id, { onDelete: "cascade" }),
    empresaOtorganteId: uuid("empresa_otorgante_id")
      .notNull()
      .references(() => empresas.id),
    descuentoBps: integer("descuento_bps").notNull(),
    topeMensualCentimos: bigint("tope_mensual_centimos", { mode: "number" }),
    topeMensualCantidad: smallint("tope_mensual_cantidad"),
    vigenciaDesde: date("vigencia_desde", { mode: "string" }).notNull(),
    vigenciaHasta: date("vigencia_hasta", { mode: "string" }),
    creadoPorUsuarioId: uuid("creado_por_usuario_id").references(
      () => usuarios.id,
    ),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("convenio_terminos_lookup_idx").on(
      t.convenioId,
      t.empresaOtorganteId,
      t.vigenciaDesde.desc(),
    ),
    check(
      "convenio_terminos_bps_check",
      sql`${t.descuentoBps} between 0 and 10000`,
    ),
  ],
);

export const empleados = pgTable(
  "empleados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    tipoDocumento: tipoDocumentoIdentidad("tipo_documento")
      .notNull()
      .default("DNI"),
    // La columna física conserva `dni` durante la fase de expansión para que
    // versiones anteriores puedan convivir durante un despliegue gradual.
    numeroDocumento: text("dni").notNull(),
    nombres: text("nombres").notNull(),
    apellidos: text("apellidos").notNull(),
    telefono: text("telefono"),
    estado: estadoEmpleado("estado").notNull().default("ACTIVO"),
    creadoPorUsuarioId: uuid("creado_por_usuario_id").references(
      (): AnyPgColumn => usuarios.id,
    ),
    verificadoPorUsuarioId: uuid("verificado_por_usuario_id").references(
      (): AnyPgColumn => usuarios.id,
    ),
    verificadoAt: timestamptz("verificado_at"),
    motivoRechazo: text("motivo_rechazo"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("empleados_documento_uk").on(t.tipoDocumento, t.numeroDocumento),
    index("empleados_empresa_idx").on(t.empresaId),
    index("empleados_estado_idx").on(t.empresaId, t.estado),
    check(
      "empleados_documento_check",
      sql`(${t.tipoDocumento} = 'DNI' AND ${t.numeroDocumento} ~ '^[0-9]{8}$') OR (${t.tipoDocumento} = 'CARNET_EXTRANJERIA' AND ${t.numeroDocumento} ~ '^[A-Z0-9]([A-Z0-9-]{0,10}[A-Z0-9])?$')`,
    ),
    check(
      "empleados_nombres_check",
      sql`length(${t.nombres}) between 2 and 80`,
    ),
    check(
      "empleados_apellidos_check",
      sql`length(${t.apellidos}) between 2 and 80`,
    ),
    check(
      "empleados_telefono_check",
      sql`${t.telefono} is null or ${t.telefono} ~ '^[0-9]{6,15}$'`,
    ),
    check(
      "empleados_motivo_rechazo_check",
      sql`${t.motivoRechazo} is null or length(${t.motivoRechazo}) <= 300`,
    ),
  ],
);

export const sesiones = pgTable(
  "sesiones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
    ultimoUsoAt: timestamptz("ultimo_uso_at").notNull().defaultNow(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    revocadaAt: timestamptz("revocada_at"),
  },
  (t) => [
    unique("sesiones_token_hash_uk").on(t.tokenHash),
    index("sesiones_usuario_idx").on(t.usuarioId),
    index("sesiones_expires_idx").on(t.expiresAt),
  ],
);

export const ventas = pgTable(
  "ventas",
  {
    id: uuid("id").primaryKey(),
    empresaVendedoraId: uuid("empresa_vendedora_id")
      .notNull()
      .references(() => empresas.id),
    empresaCompradoraId: uuid("empresa_compradora_id")
      .notNull()
      .references(() => empresas.id),
    convenioId: uuid("convenio_id")
      .notNull()
      .references(() => convenios.id),
    terminoId: uuid("termino_id")
      .notNull()
      .references(() => convenioTerminos.id),
    sedeId: uuid("sede_id")
      .notNull()
      .references(() => sedes.id),
    vendedorUsuarioId: uuid("vendedor_usuario_id")
      .notNull()
      .references(() => usuarios.id),
    empleadoCompradorId: uuid("empleado_comprador_id")
      .notNull()
      .references(() => empleados.id),
    montoBrutoCentimos: bigint("monto_bruto_centimos", {
      mode: "number",
    }).notNull(),
    descuentoBps: integer("descuento_bps").notNull(),
    montoDescuentoCentimos: bigint("monto_descuento_centimos", {
      mode: "number",
    }).notNull(),
    montoFinalCentimos: bigint("monto_final_centimos", {
      mode: "number",
    }).notNull(),
    moneda: text("moneda").notNull().default("PEN"),
    fechaVenta: date("fecha_venta", { mode: "string" }).notNull(),
    estado: estadoVenta("estado").notNull().default("REGISTRADA"),
    observacion: text("observacion"),
    requiereRevision: boolean("requiere_revision").notNull().default(false),
    anuladaPorUsuarioId: uuid("anulada_por_usuario_id").references(
      () => usuarios.id,
    ),
    anuladaAt: timestamptz("anulada_at"),
    motivoAnulacion: text("motivo_anulacion"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ventas_vendedora_fecha_idx").on(
      t.empresaVendedoraId,
      t.fechaVenta.desc(),
    ),
    index("ventas_compradora_fecha_idx").on(
      t.empresaCompradoraId,
      t.fechaVenta.desc(),
    ),
    index("ventas_vendedor_fecha_idx").on(
      t.vendedorUsuarioId,
      t.fechaVenta.desc(),
    ),
    index("ventas_empleado_fecha_idx").on(
      t.empleadoCompradorId,
      t.fechaVenta.desc(),
    ),
    index("ventas_sede_fecha_idx").on(t.sedeId, t.fechaVenta.desc()),
    index("ventas_revision_idx")
      .on(t.empresaVendedoraId)
      .where(sql`${t.requiereRevision}`),
    check(
      "ventas_empresas_distintas_check",
      sql`${t.empresaVendedoraId} <> ${t.empresaCompradoraId}`,
    ),
    check("ventas_monto_bruto_check", sql`${t.montoBrutoCentimos} > 0`),
    check("ventas_bps_check", sql`${t.descuentoBps} between 0 and 10000`),
    check("ventas_descuento_check", sql`${t.montoDescuentoCentimos} >= 0`),
    check("ventas_final_check", sql`${t.montoFinalCentimos} >= 0`),
    check("ventas_moneda_check", sql`${t.moneda} = 'PEN'`),
    check(
      "ventas_anulada_check",
      sql`(${t.estado} = 'ANULADA') = (${t.anuladaAt} IS NOT NULL)`,
    ),
    check(
      "ventas_motivo_check",
      sql`(${t.anuladaAt} IS NULL) OR (${t.motivoAnulacion} IS NOT NULL AND ${t.anuladaPorUsuarioId} IS NOT NULL)`,
    ),
    check(
      "ventas_observacion_check",
      sql`${t.observacion} is null or length(${t.observacion}) <= 500`,
    ),
    check(
      "ventas_motivo_len_check",
      sql`${t.motivoAnulacion} is null or length(${t.motivoAnulacion}) between 5 and 300`,
    ),
    check(
      "ventas_final_igual_check",
      sql`${t.montoFinalCentimos} = ${t.montoBrutoCentimos} - ${t.montoDescuentoCentimos}`,
    ),
  ],
);

export const adjuntos = pgTable(
  "adjuntos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventaId: uuid("venta_id").references(() => ventas.id, {
      onDelete: "restrict",
    }),
    empleadoId: uuid("empleado_id").references(() => empleados.id, {
      onDelete: "restrict",
    }),
    tipo: tipoAdjunto("tipo").notNull(),
    orden: smallint("orden").notNull().default(0),
    descripcion: text("descripcion"),
    blobPath: text("blob_path").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    subidoPorUsuarioId: uuid("subido_por_usuario_id")
      .notNull()
      .references(() => usuarios.id),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("adjuntos_blob_path_uk").on(t.blobPath),
    uniqueIndex("adjuntos_foto_dni_uk")
      .on(t.empleadoId)
      .where(sql`${t.tipo} = 'FOTO_DNI'`),
    uniqueIndex("adjuntos_documento_uk")
      .on(t.ventaId)
      .where(sql`${t.tipo} = 'DOCUMENTO_VENTA'`),
    index("adjuntos_venta_idx").on(t.ventaId),
    index("adjuntos_empleado_idx").on(t.empleadoId),
    index("adjuntos_sha256_idx").on(t.sha256),
    check(
      "adjuntos_tipo_dueño_check",
      sql`(${t.tipo} = 'FOTO_DNI' AND ${t.empleadoId} IS NOT NULL AND ${t.ventaId} IS NULL) OR (${t.tipo} IN ('DOCUMENTO_VENTA','EVIDENCIA') AND ${t.ventaId} IS NOT NULL AND ${t.empleadoId} IS NULL)`,
    ),
    check(
      "adjuntos_mime_check",
      sql`${t.mime} IN ('image/jpeg','image/png','image/webp','application/pdf')`,
    ),
    check("adjuntos_size_check", sql`${t.sizeBytes} between 1 and 10485760`),
    check("adjuntos_sha256_check", sql`${t.sha256} ~ '^[a-f0-9]{64}$'`),
    check(
      "adjuntos_descripcion_check",
      sql`${t.descripcion} is null or length(${t.descripcion}) <= 120`,
    ),
  ],
);

export const auditoria = pgTable(
  "auditoria",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ts: timestamptz("ts").notNull().defaultNow(),
    actorUsuarioId: uuid("actor_usuario_id").references(() => usuarios.id),
    actorEmpresaId: uuid("actor_empresa_id").references(() => empresas.id),
    actorRol: rolUsuario("actor_rol"),
    accion: accionAuditoria("accion").notNull(),
    entidad: text("entidad").notNull(),
    entidadId: text("entidad_id").notNull(),
    datosAntes: jsonb("datos_antes"),
    datosDespues: jsonb("datos_despues"),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    prevHash: text("prev_hash"),
    hash: text("hash").notNull(),
  },
  (t) => [
    index("auditoria_ts_idx").on(t.ts.desc()),
    index("auditoria_entidad_idx").on(t.entidad, t.entidadId, t.ts.desc()),
    index("auditoria_actor_idx").on(t.actorUsuarioId, t.ts.desc()),
    index("auditoria_empresa_idx").on(t.actorEmpresaId, t.ts.desc()),
  ],
);

export const rateLimits = pgTable("rate_limits", {
  clave: text("clave").primaryKey(),
  ventanaInicio: timestamptz("ventana_inicio").notNull(),
  contador: integer("contador").notNull(),
});

export type Empresa = typeof empresas.$inferSelect;
export type Sede = typeof sedes.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
export type Convenio = typeof convenios.$inferSelect;
export type ConvenioTermino = typeof convenioTerminos.$inferSelect;
export type Empleado = typeof empleados.$inferSelect;
export type Sesion = typeof sesiones.$inferSelect;
export type Venta = typeof ventas.$inferSelect;
export type Adjunto = typeof adjuntos.$inferSelect;
export type Auditoria = typeof auditoria.$inferSelect;
export type RateLimit = typeof rateLimits.$inferSelect;
