CREATE TYPE "public"."tipo_documento_identidad" AS ENUM('DNI', 'CARNET_EXTRANJERIA');--> statement-breakpoint
ALTER TABLE "empleados" DROP CONSTRAINT "empleados_dni_uk";--> statement-breakpoint
ALTER TABLE "empleados" DROP CONSTRAINT "empleados_dni_check";--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN "tipo_documento" "tipo_documento_identidad" DEFAULT 'DNI' NOT NULL;--> statement-breakpoint
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_documento_uk" UNIQUE("tipo_documento","dni");--> statement-breakpoint
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_documento_check" CHECK (("empleados"."tipo_documento" = 'DNI' AND "empleados"."dni" ~ '^[0-9]{8}$') OR ("empleados"."tipo_documento" = 'CARNET_EXTRANJERIA' AND "empleados"."dni" ~ '^[A-Z0-9]([A-Z0-9-]{0,10}[A-Z0-9])?$'));
