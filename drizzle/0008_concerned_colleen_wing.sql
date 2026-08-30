DROP INDEX "empresas_activo_idx";--> statement-breakpoint
CREATE INDEX "empresas_activas_orden_idx" ON "empresas" USING btree ("nombre_comercial","id") WHERE "empresas"."activo";