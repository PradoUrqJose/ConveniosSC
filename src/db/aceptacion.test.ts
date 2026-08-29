import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
import { describe, expect, it } from "vitest";

/**
 * Tests de integración de T02 (06-BACKLOG.md): constraints de la BD contra Postgres.
 * Se ejecutan solo con `RUN_DB_TESTS=1` (requieren la BD migrada).
 * Cada caso corre dentro de una transacción que se revierte, sin dejar residuos.
 */
const URL = process.env.DATABASE_URL_UNPOOLED;
const ACTIVO = process.env.RUN_DB_TESTS === "1" && Boolean(URL);

async function conexion(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: URL });
  await c.connect();
  return c;
}

describe.skipIf(!ACTIVO)("Aceptación T02 — constraints en BD", () => {
  it("a) UPDATE auditoria lanza excepción (append-only por trigger)", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      await c.query(
        `INSERT INTO auditoria (accion, entidad, entidad_id, hash)
         VALUES ('LOGIN_OK', 'empresa', 'x', 'abc')`,
      );
      await expect(
        c.query("UPDATE auditoria SET hash = 'yyy'"),
      ).rejects.toThrow(/append-only/i);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("b) dos términos solapados del mismo convenio/dirección son rechazados", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const { rows } = await c.query(
        `INSERT INTO empresas (ruc, razon_social, nombre_comercial)
         VALUES ($1, $2, $3), ($4, $5, $6)
         RETURNING id`,
        [
          "20100099111",
          "Empresa A",
          "Empresa A",
          "20100099222",
          "Empresa B",
          "Empresa B",
        ],
      );
      const ida = rows[0]!.id as string;
      const idb = rows[1]!.id as string;
      const [a, b] = ida < idb ? [ida, idb] : [idb, ida];
      const conv = await c.query(
        `INSERT INTO convenios (empresa_a_id, empresa_b_id, estado, vigencia_desde)
         VALUES ($1, $2, 'VIGENTE', CURRENT_DATE)
         RETURNING id`,
        [a, b],
      );
      const convenioId = conv.rows[0].id as string;
      await c.query(
        `INSERT INTO convenio_terminos
           (convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde)
         VALUES ($1, $2, 1000, CURRENT_DATE)`,
        [convenioId, a],
      );
      await expect(
        c.query(
          `INSERT INTO convenio_terminos
             (convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde)
           VALUES ($1, $2, 900, CURRENT_DATE)`,
          [convenioId, a],
        ),
      ).rejects.toThrow();
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("c) DNI duplicado en empleados es rechazado", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const { rows } = await c.query(
        `INSERT INTO empresas (ruc, razon_social, nombre_comercial)
         VALUES ($1, $2, $3), ($4, $5, $6)
         RETURNING id`,
        [
          "20100000031",
          "Empresa X",
          "Empresa X",
          "20100000032",
          "Empresa Y",
          "Empresa Y",
        ],
      );
      const ex = rows[0]!.id as string;
      const ey = rows[1]!.id as string;
      await c.query(
        `INSERT INTO empleados (empresa_id, dni, nombres, apellidos)
         VALUES ($1, '12345678', 'Ana', 'Bruno')`,
        [ex],
      );
      await expect(
        c.query(
          `INSERT INTO empleados (empresa_id, dni, nombres, apellidos)
           VALUES ($1, '12345678', 'Carla', 'Diaz')`,
          [ey],
        ),
      ).rejects.toThrow(/duplicate|llave|key/i);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("d) migración de identidad conserva DNI y aísla la unicidad por tipo", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const empresa = await c.query(
        `INSERT INTO empresas (ruc, razon_social, nombre_comercial)
         VALUES ('20100000033', 'Empresa Documentos', 'Empresa Documentos')
         RETURNING id`,
      );
      const empresaId = empresa.rows[0]!.id as string;

      const dni = await c.query(
        `INSERT INTO empleados (empresa_id, dni, nombres, apellidos)
         VALUES ($1, '12345678', 'Dina', 'Nacional')
         RETURNING tipo_documento, dni`,
        [empresaId],
      );
      expect(dni.rows[0]).toMatchObject({
        tipo_documento: "DNI",
        dni: "12345678",
      });

      await expect(
        c.query(
          `INSERT INTO empleados
             (empresa_id, tipo_documento, dni, nombres, apellidos)
           VALUES ($1, 'CARNET_EXTRANJERIA', '12345678', 'Celia', 'Extranjera')`,
          [empresaId],
        ),
      ).resolves.toBeDefined();

      await expect(
        c.query(
          `INSERT INTO empleados
             (empresa_id, tipo_documento, dni, nombres, apellidos)
           VALUES ($1, 'CARNET_EXTRANJERIA', 'N-123456', 'Noa', 'Migrante')`,
          [empresaId],
        ),
      ).resolves.toBeDefined();

      await c.query("SAVEPOINT documento_duplicado");
      await expect(
        c.query(
          `INSERT INTO empleados
             (empresa_id, tipo_documento, dni, nombres, apellidos)
           VALUES ($1, 'CARNET_EXTRANJERIA', 'N-123456', 'Otra', 'Persona')`,
          [empresaId],
        ),
      ).rejects.toThrow(/duplicate|llave|key/i);
      await c.query("ROLLBACK TO SAVEPOINT documento_duplicado");

      await expect(
        c.query(
          `INSERT INTO empleados
             (empresa_id, tipo_documento, dni, nombres, apellidos)
           VALUES ($1, 'CARNET_EXTRANJERIA', 'CE/123', 'Formato', 'Inválido')`,
          [empresaId],
        ),
      ).rejects.toThrow(/empleados_documento_check/i);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });
});
