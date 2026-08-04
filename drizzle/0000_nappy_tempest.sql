CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."accion_auditoria" AS ENUM('LOGIN_OK', 'LOGIN_FALLIDO', 'LOGOUT', 'PASSWORD_CAMBIADA', 'PASSWORD_RESETEADA', 'EMPRESA_CREADA', 'EMPRESA_ACTUALIZADA', 'SEDE_CREADA', 'SEDE_ACTUALIZADA', 'CONVENIO_CREADO', 'CONVENIO_ACTUALIZADO', 'TERMINO_CREADO', 'TERMINO_CERRADO', 'USUARIO_CREADO', 'USUARIO_ACTUALIZADO', 'USUARIO_DESACTIVADO', 'EMPLEADO_CREADO', 'EMPLEADO_ACTUALIZADO', 'EMPLEADO_VERIFICADO', 'EMPLEADO_RECHAZADO', 'BUSQUEDA_DNI', 'VENTA_CREADA', 'VENTA_ANULADA', 'ADJUNTO_SUBIDO', 'ADJUNTO_VISTO', 'EXPORTACION');--> statement-breakpoint
CREATE TYPE "public"."estado_convenio" AS ENUM('BORRADOR', 'VIGENTE', 'SUSPENDIDO', 'TERMINADO');--> statement-breakpoint
CREATE TYPE "public"."estado_empleado" AS ENUM('PENDIENTE_VERIFICACION', 'ACTIVO', 'RECHAZADO', 'INACTIVO');--> statement-breakpoint
CREATE TYPE "public"."estado_venta" AS ENUM('REGISTRADA', 'ANULADA');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('SUPERADMIN', 'ADMIN_EMPRESA', 'VENDEDOR');--> statement-breakpoint
CREATE TYPE "public"."tipo_adjunto" AS ENUM('FOTO_DNI', 'DOCUMENTO_VENTA', 'EVIDENCIA');--> statement-breakpoint
CREATE TABLE "adjuntos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid,
	"empleado_id" uuid,
	"tipo" "tipo_adjunto" NOT NULL,
	"orden" smallint DEFAULT 0 NOT NULL,
	"descripcion" text,
	"blob_path" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"subido_por_usuario_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adjuntos_blob_path_uk" UNIQUE("blob_path"),
	CONSTRAINT "adjuntos_tipo_dueño_check" CHECK (("adjuntos"."tipo" = 'FOTO_DNI' AND "adjuntos"."empleado_id" IS NOT NULL AND "adjuntos"."venta_id" IS NULL) OR ("adjuntos"."tipo" IN ('DOCUMENTO_VENTA','EVIDENCIA') AND "adjuntos"."venta_id" IS NOT NULL AND "adjuntos"."empleado_id" IS NULL)),
	CONSTRAINT "adjuntos_mime_check" CHECK ("adjuntos"."mime" IN ('image/jpeg','image/png','image/webp','application/pdf')),
	CONSTRAINT "adjuntos_size_check" CHECK ("adjuntos"."size_bytes" between 1 and 10485760),
	CONSTRAINT "adjuntos_sha256_check" CHECK ("adjuntos"."sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "adjuntos_descripcion_check" CHECK ("adjuntos"."descripcion" is null or length("adjuntos"."descripcion") <= 120)
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_usuario_id" uuid,
	"actor_empresa_id" uuid,
	"actor_rol" "rol_usuario",
	"accion" "accion_auditoria" NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text NOT NULL,
	"datos_antes" jsonb,
	"datos_despues" jsonb,
	"ip" "inet",
	"user_agent" text,
	"request_id" text,
	"prev_hash" text,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "convenio_terminos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"convenio_id" uuid NOT NULL,
	"empresa_otorgante_id" uuid NOT NULL,
	"descuento_bps" integer NOT NULL,
	"tope_mensual_centimos" bigint,
	"tope_mensual_cantidad" smallint,
	"vigencia_desde" date NOT NULL,
	"vigencia_hasta" date,
	"creado_por_usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "convenio_terminos_bps_check" CHECK ("convenio_terminos"."descuento_bps" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "convenios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_a_id" uuid NOT NULL,
	"empresa_b_id" uuid NOT NULL,
	"estado" "estado_convenio" DEFAULT 'BORRADOR' NOT NULL,
	"vigencia_desde" date NOT NULL,
	"vigencia_hasta" date,
	"notas" text,
	"creado_por_usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "convenios_par_uk" UNIQUE("empresa_a_id","empresa_b_id"),
	CONSTRAINT "convenios_a_b_check" CHECK ("convenios"."empresa_a_id" < "convenios"."empresa_b_id"),
	CONSTRAINT "convenios_vigencia_check" CHECK ("convenios"."vigencia_hasta" is null or "convenios"."vigencia_hasta" >= "convenios"."vigencia_desde"),
	CONSTRAINT "convenios_notas_check" CHECK ("convenios"."notas" is null or length("convenios"."notas") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "empleados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"dni" text NOT NULL,
	"nombres" text NOT NULL,
	"apellidos" text NOT NULL,
	"telefono" text,
	"estado" "estado_empleado" DEFAULT 'ACTIVO' NOT NULL,
	"creado_por_usuario_id" uuid,
	"verificado_por_usuario_id" uuid,
	"verificado_at" timestamp with time zone,
	"motivo_rechazo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empleados_dni_uk" UNIQUE("dni"),
	CONSTRAINT "empleados_dni_check" CHECK ("empleados"."dni" ~ '^[0-9]{8}$'),
	CONSTRAINT "empleados_nombres_check" CHECK (length("empleados"."nombres") between 2 and 80),
	CONSTRAINT "empleados_apellidos_check" CHECK (length("empleados"."apellidos") between 2 and 80),
	CONSTRAINT "empleados_telefono_check" CHECK ("empleados"."telefono" is null or "empleados"."telefono" ~ '^[0-9]{6,15}$'),
	CONSTRAINT "empleados_motivo_rechazo_check" CHECK ("empleados"."motivo_rechazo" is null or length("empleados"."motivo_rechazo") <= 300)
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ruc" text NOT NULL,
	"razon_social" text NOT NULL,
	"nombre_comercial" text NOT NULL,
	"logo_blob_path" text,
	"tope_monto_venta_centimos" bigint DEFAULT 5000000 NOT NULL,
	"requiere_evidencia_en_venta" boolean DEFAULT false NOT NULL,
	"dias_retroactivos_venta" smallint DEFAULT 7 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresas_ruc_uk" UNIQUE("ruc"),
	CONSTRAINT "empresas_ruc_check" CHECK ("empresas"."ruc" ~ '^[0-9]{11}$'),
	CONSTRAINT "empresas_razon_social_check" CHECK (length("empresas"."razon_social") between 3 and 200),
	CONSTRAINT "empresas_nombre_comercial_check" CHECK (length("empresas"."nombre_comercial") between 2 and 100),
	CONSTRAINT "empresas_tope_check" CHECK ("empresas"."tope_monto_venta_centimos" > 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"clave" text PRIMARY KEY NOT NULL,
	"ventana_inicio" timestamp with time zone NOT NULL,
	"contador" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sedes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sedes_nombre_check" CHECK (length("sedes"."nombre") between 2 and 80),
	CONSTRAINT "sedes_direccion_check" CHECK ("sedes"."direccion" is null or length("sedes"."direccion") <= 200)
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ultimo_uso_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"revocada_at" timestamp with time zone,
	CONSTRAINT "sesiones_token_hash_uk" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"username" "citext" NOT NULL,
	"password_hash" text NOT NULL,
	"debe_cambiar_password" boolean DEFAULT true NOT NULL,
	"nombres" text NOT NULL,
	"apellidos" text NOT NULL,
	"email" text,
	"rol" "rol_usuario" NOT NULL,
	"empleado_id" uuid,
	"sede_por_defecto_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"intentos_fallidos" smallint DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone,
	"ultimo_acceso_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_por_usuario_id" uuid,
	CONSTRAINT "usuarios_username_uk" UNIQUE("username"),
	CONSTRAINT "usuarios_empleado_uk" UNIQUE("empleado_id"),
	CONSTRAINT "usuarios_rol_empresa_check" CHECK (("usuarios"."rol" = 'SUPERADMIN' AND "usuarios"."empresa_id" IS NULL) OR ("usuarios"."rol" <> 'SUPERADMIN' AND "usuarios"."empresa_id" IS NOT NULL)),
	CONSTRAINT "usuarios_username_check" CHECK ("usuarios"."username" ~ '^[a-z0-9._-]{3,32}$'),
	CONSTRAINT "usuarios_nombres_check" CHECK (length("usuarios"."nombres") between 2 and 80),
	CONSTRAINT "usuarios_apellidos_check" CHECK (length("usuarios"."apellidos") between 2 and 80)
);
--> statement-breakpoint
CREATE TABLE "ventas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_vendedora_id" uuid NOT NULL,
	"empresa_compradora_id" uuid NOT NULL,
	"convenio_id" uuid NOT NULL,
	"termino_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"vendedor_usuario_id" uuid NOT NULL,
	"empleado_comprador_id" uuid NOT NULL,
	"monto_bruto_centimos" bigint NOT NULL,
	"descuento_bps" integer NOT NULL,
	"monto_descuento_centimos" bigint NOT NULL,
	"monto_final_centimos" bigint NOT NULL,
	"moneda" text DEFAULT 'PEN' NOT NULL,
	"fecha_venta" date NOT NULL,
	"estado" "estado_venta" DEFAULT 'REGISTRADA' NOT NULL,
	"observacion" text,
	"requiere_revision" boolean DEFAULT false NOT NULL,
	"anulada_por_usuario_id" uuid,
	"anulada_at" timestamp with time zone,
	"motivo_anulacion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ventas_empresas_distintas_check" CHECK ("ventas"."empresa_vendedora_id" <> "ventas"."empresa_compradora_id"),
	CONSTRAINT "ventas_monto_bruto_check" CHECK ("ventas"."monto_bruto_centimos" > 0),
	CONSTRAINT "ventas_bps_check" CHECK ("ventas"."descuento_bps" between 0 and 10000),
	CONSTRAINT "ventas_descuento_check" CHECK ("ventas"."monto_descuento_centimos" >= 0),
	CONSTRAINT "ventas_final_check" CHECK ("ventas"."monto_final_centimos" >= 0),
	CONSTRAINT "ventas_moneda_check" CHECK ("ventas"."moneda" = 'PEN'),
	CONSTRAINT "ventas_anulada_check" CHECK (("ventas"."estado" = 'ANULADA') = ("ventas"."anulada_at" IS NOT NULL)),
	CONSTRAINT "ventas_motivo_check" CHECK (("ventas"."anulada_at" IS NULL) OR ("ventas"."motivo_anulacion" IS NOT NULL AND "ventas"."anulada_por_usuario_id" IS NOT NULL)),
	CONSTRAINT "ventas_observacion_check" CHECK ("ventas"."observacion" is null or length("ventas"."observacion") <= 500),
	CONSTRAINT "ventas_motivo_len_check" CHECK ("ventas"."motivo_anulacion" is null or length("ventas"."motivo_anulacion") between 5 and 300),
	CONSTRAINT "ventas_final_igual_check" CHECK ("ventas"."monto_final_centimos" = "ventas"."monto_bruto_centimos" - "ventas"."monto_descuento_centimos")
);
--> statement-breakpoint
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_subido_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("subido_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_usuario_id_usuarios_id_fk" FOREIGN KEY ("actor_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_empresa_id_empresas_id_fk" FOREIGN KEY ("actor_empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio_terminos" ADD CONSTRAINT "convenio_terminos_convenio_id_convenios_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio_terminos" ADD CONSTRAINT "convenio_terminos_empresa_otorgante_id_empresas_id_fk" FOREIGN KEY ("empresa_otorgante_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio_terminos" ADD CONSTRAINT "convenio_terminos_creado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_empresa_a_id_empresas_id_fk" FOREIGN KEY ("empresa_a_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_empresa_b_id_empresas_id_fk" FOREIGN KEY ("empresa_b_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_creado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_creado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_verificado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("verificado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_sede_por_defecto_id_sedes_id_fk" FOREIGN KEY ("sede_por_defecto_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_creado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empresa_vendedora_id_empresas_id_fk" FOREIGN KEY ("empresa_vendedora_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empresa_compradora_id_empresas_id_fk" FOREIGN KEY ("empresa_compradora_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_convenio_id_convenios_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_termino_id_convenio_terminos_id_fk" FOREIGN KEY ("termino_id") REFERENCES "public"."convenio_terminos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_vendedor_usuario_id_usuarios_id_fk" FOREIGN KEY ("vendedor_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empleado_comprador_id_empleados_id_fk" FOREIGN KEY ("empleado_comprador_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_anulada_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("anulada_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adjuntos_foto_dni_uk" ON "adjuntos" USING btree ("empleado_id") WHERE "adjuntos"."tipo" = 'FOTO_DNI';--> statement-breakpoint
CREATE UNIQUE INDEX "adjuntos_documento_uk" ON "adjuntos" USING btree ("venta_id") WHERE "adjuntos"."tipo" = 'DOCUMENTO_VENTA';--> statement-breakpoint
CREATE INDEX "adjuntos_venta_idx" ON "adjuntos" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "adjuntos_empleado_idx" ON "adjuntos" USING btree ("empleado_id");--> statement-breakpoint
CREATE INDEX "adjuntos_sha256_idx" ON "adjuntos" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "auditoria_ts_idx" ON "auditoria" USING btree ("ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_entidad_idx" ON "auditoria" USING btree ("entidad","entidad_id","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_actor_idx" ON "auditoria" USING btree ("actor_usuario_id","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_empresa_idx" ON "auditoria" USING btree ("actor_empresa_id","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "convenio_terminos_lookup_idx" ON "convenio_terminos" USING btree ("convenio_id","empresa_otorgante_id","vigencia_desde" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "convenios_empresa_a_idx" ON "convenios" USING btree ("empresa_a_id");--> statement-breakpoint
CREATE INDEX "convenios_empresa_b_idx" ON "convenios" USING btree ("empresa_b_id");--> statement-breakpoint
CREATE INDEX "empleados_empresa_idx" ON "empleados" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "empleados_estado_idx" ON "empleados" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX "empresas_activo_idx" ON "empresas" USING btree ("activo") WHERE "empresas"."activo";--> statement-breakpoint
CREATE INDEX "sedes_empresa_idx" ON "sedes" USING btree ("empresa_id") WHERE "sedes"."activo";--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sesiones_expires_idx" ON "sesiones" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "usuarios_empresa_idx" ON "usuarios" USING btree ("empresa_id") WHERE "usuarios"."activo";--> statement-breakpoint
CREATE INDEX "ventas_vendedora_fecha_idx" ON "ventas" USING btree ("empresa_vendedora_id","fecha_venta" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ventas_compradora_fecha_idx" ON "ventas" USING btree ("empresa_compradora_id","fecha_venta" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ventas_vendedor_fecha_idx" ON "ventas" USING btree ("vendedor_usuario_id","fecha_venta" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ventas_empleado_fecha_idx" ON "ventas" USING btree ("empleado_comprador_id","fecha_venta" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ventas_sede_fecha_idx" ON "ventas" USING btree ("sede_id","fecha_venta" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ventas_revision_idx" ON "ventas" USING btree ("empresa_vendedora_id") WHERE "ventas"."requiere_revision";