CREATE INDEX "empleados_orden_idx" ON "empleados" USING btree ("apellidos","nombres","id");--> statement-breakpoint
CREATE INDEX "empresas_orden_idx" ON "empresas" USING btree ("nombre_comercial","id");--> statement-breakpoint
CREATE INDEX "usuarios_orden_idx" ON "usuarios" USING btree ("username","id");--> statement-breakpoint
CREATE INDEX "ventas_monto_idx" ON "ventas" USING btree ("monto_final_centimos" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ventas_vendedor_monto_idx" ON "ventas" USING btree ("vendedor_usuario_id","monto_final_centimos" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ventas_vendedora_monto_idx" ON "ventas" USING btree ("empresa_vendedora_id","monto_final_centimos" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ventas_compradora_monto_idx" ON "ventas" USING btree ("empresa_compradora_id","monto_final_centimos" DESC NULLS LAST,"id" DESC NULLS LAST);