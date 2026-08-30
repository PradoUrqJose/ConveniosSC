-- Migración manual (01-MODELO-DATOS.md §16): lo que drizzle-kit no genera.
-- Idempotente: se puede ejecutar varias veces sin error.

-- Rol de aplicación (se crea una sola vez)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    EXECUTE 'CREATE ROLE app_user';
  END IF;
END $$;

-- Auditoría: append-only por permisos (01 §11 capa 1)
GRANT SELECT ON TABLE auditoria TO app_user;
GRANT INSERT ON TABLE auditoria TO app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM app_user;

-- Índice único por sede con nombre case-insensitive (01 §3)
CREATE UNIQUE INDEX IF NOT EXISTS sedes_empresa_nombre_uk
  ON sedes (empresa_id, lower(nombre));

-- Búsqueda por nombre de empleado (01 §6)
CREATE INDEX IF NOT EXISTS empleados_nombre_trgm_idx
  ON empleados USING gin ((nombres || ' ' || apellidos) gin_trgm_ops);

-- Búsqueda de usuarios y empresas por sus nombres compuestos.
CREATE INDEX IF NOT EXISTS usuarios_busqueda_trgm_idx
  ON usuarios USING gin ((username || ' ' || nombres || ' ' || apellidos) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS empresas_busqueda_trgm_idx
  ON empresas USING gin ((nombre_comercial || ' ' || razon_social) gin_trgm_ops);

-- Las fotos históricas de identidad se conservan por retención, pero desde
-- esta versión ninguna operación puede crear una nueva. NOT VALID evita
-- invalidar las filas antiguas y sí protege INSERT/UPDATE futuros.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'adjuntos_sin_nuevas_fotos_identidad_check'
      AND conrelid = 'adjuntos'::regclass
  ) THEN
    ALTER TABLE adjuntos
      ADD CONSTRAINT adjuntos_sin_nuevas_fotos_identidad_check
      CHECK (tipo <> 'FOTO_DNI') NOT VALID;
  END IF;
END $$;

-- No puede haber dos términos solapados por dirección del mismo convenio (01 §5)
ALTER TABLE convenio_terminos DROP CONSTRAINT IF EXISTS convenio_terminos_sin_solape;
ALTER TABLE convenio_terminos ADD CONSTRAINT convenio_terminos_sin_solape
  EXCLUDE USING gist (
    convenio_id           WITH =,
    empresa_otorgante_id  WITH =,
    daterange(vigencia_desde, COALESCE(vigencia_hasta, 'infinity'::date), '[]') WITH &&
  );

-- Trigger de updated_at (01 §14)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION crear_trigger_updated_at(tabla text) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
     CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
    tabla, tabla, tabla, tabla
  );
END;
$$ LANGUAGE plpgsql;

SELECT crear_trigger_updated_at('empresas');
SELECT crear_trigger_updated_at('sedes');
SELECT crear_trigger_updated_at('convenios');
SELECT crear_trigger_updated_at('empleados');
SELECT crear_trigger_updated_at('usuarios');

DROP FUNCTION IF EXISTS crear_trigger_updated_at(text);

-- Trigger: otorgante debe ser empresa A o B del convenio (01 §5)
CREATE OR REPLACE FUNCTION trg_termino_otorgante_valido() RETURNS trigger AS $$
DECLARE
  empresa_a uuid;
  empresa_b uuid;
BEGIN
  SELECT empresa_a_id, empresa_b_id
    INTO empresa_a, empresa_b
    FROM convenios
   WHERE id = NEW.convenio_id;

  IF empresa_a IS NULL THEN
    RAISE EXCEPTION 'convenio % no existe', NEW.convenio_id;
  END IF;

  IF NEW.empresa_otorgante_id NOT IN (empresa_a, empresa_b) THEN
    RAISE EXCEPTION 'empresa_otorgante_id debe ser la empresa A o B del convenio';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_termino_otorgante_valido ON convenio_terminos;
CREATE TRIGGER trg_termino_otorgante_valido
  BEFORE INSERT OR UPDATE ON convenio_terminos
  FOR EACH ROW EXECUTE FUNCTION trg_termino_otorgante_valido();

-- Trigger: empleado y sede por defecto deben pertenecer a la misma empresa (01 §7)
CREATE OR REPLACE FUNCTION trg_usuario_empleado_misma_empresa() RETURNS trigger AS $$
DECLARE
  emp_empresa uuid;
  sede_empresa uuid;
BEGIN
  IF NEW.empleado_id IS NOT NULL THEN
    SELECT empresa_id INTO emp_empresa FROM empleados WHERE id = NEW.empleado_id;
    IF emp_empresa IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'empleado_id debe pertenecer a la misma empresa del usuario';
    END IF;
  END IF;

  IF NEW.sede_por_defecto_id IS NOT NULL THEN
    SELECT empresa_id INTO sede_empresa FROM sedes WHERE id = NEW.sede_por_defecto_id;
    IF sede_empresa IS DISTINCT FROM NEW.empresa_id THEN
      RAISE EXCEPTION 'sede_por_defecto_id debe pertenecer a la misma empresa del usuario';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuario_empleado_misma_empresa ON usuarios;
CREATE TRIGGER trg_usuario_empleado_misma_empresa
  BEFORE INSERT OR UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION trg_usuario_empleado_misma_empresa();

-- Auditoría: append-only por trigger (01 §11 capa 2)
CREATE OR REPLACE FUNCTION auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'auditoria es append-only: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditoria_inmutable ON auditoria;
CREATE TRIGGER trg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();
