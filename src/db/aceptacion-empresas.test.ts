import { config } from "dotenv";
config({ path: ".env.local" });
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import pg from "pg";
import { describe, expect, it } from "vitest";

import { crearEmpresaCore } from "@/modules/empresas/acciones";
import { crearSedeCore } from "@/modules/sedes/acciones";
import type { SessionContext } from "@/lib/auth/guardas";
import type { TransaccionAuditada } from "@/lib/audit/registrar";

/**
 * Aceptación de T08 (06-BACKLOG.md): la empresa nace con su sede «Principal» y
 * el `crearSede` de un ADMIN ignora el `empresaId` ajeno (aislamiento).
 * Solo con `RUN_DB_TESTS=1`; cada caso corre en una transacción que se revierte.
 */
const URL = process.env.DATABASE_URL_UNPOOLED;
const ACTIVO = process.env.RUN_DB_TESTS === "1" && Boolean(URL);

async function conexion(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: URL });
  await c.connect();
  return c;
}

/** Adaptador mínimo de Drizzle sobre el `Client` pg, dentro de la transacción del test. */
const dialect = new PgDialect();
function adaptador(c: pg.Client): TransaccionAuditada {
  return {
    async execute(query: SQL) {
      const { sql: texto, params } = dialect.sqlToQuery(query);
      return c.query(texto, params);
    },
  };
}

function ctxSesion(parcial: Partial<SessionContext>): SessionContext {
  return {
    usuarioId: "00000000-0000-0000-0000-000000000001",
    empresaId: null,
    rol: "SUPERADMIN",
    requestId: "test-request",
    ip: null,
    userAgent: null,
    ...parcial,
  };
}

async function crearEmpresa(c: pg.Client, ruc: string): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO empresas (ruc, razon_social, nombre_comercial)
     VALUES ($1, $2, $3) RETURNING id`,
    [ruc, ruc, ruc],
  );
  return rows[0].id as string;
}

async function crearUsuario(
  c: pg.Client,
  rol: "SUPERADMIN" | "ADMIN_EMPRESA",
  empresaId: string | null,
): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO usuarios
       (username, password_hash, nombres, apellidos, rol, empresa_id)
     VALUES ($1, 'hash', $2, $3, $4, $5) RETURNING id`,
    [
      `test-${Math.random().toString(36).slice(2)}`,
      "Juan",
      "Perez",
      rol,
      empresaId,
    ],
  );
  return rows[0].id as string;
}

describe.skipIf(!ACTIVO)("Aceptación T08 — empresas y sedes", () => {
  it("crearEmpresa genera la sede «Principal» en la misma transacción", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const actorId = await crearUsuario(c, "SUPERADMIN", null);
      const empresaId = await crearEmpresaCore(
        adaptador(c),
        ctxSesion({ usuarioId: actorId }),
        {
          ruc: "20100088111",
          razonSocial: "Empresa Nacida",
          nombreComercial: "Empresa Nacida",
          topeCentimos: 5000000,
          requiereEvidencia: false,
          diasRetroactivos: 7,
        },
      );
      const sedes = await c.query(
        `SELECT nombre FROM sedes WHERE empresa_id = $1`,
        [empresaId],
      );
      expect(sedes.rows).toHaveLength(1);
      expect(sedes.rows[0].nombre).toBe("Principal");
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("ADMIN_EMPRESA crea la sede en su propia empresa (ignora el empresaId ajeno)", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100088222");
      const idB = await crearEmpresa(c, "20100088333");
      const adminAId = await crearUsuario(c, "ADMIN_EMPRESA", idA);

      const adminA = ctxSesion({
        usuarioId: adminAId,
        rol: "ADMIN_EMPRESA",
        empresaId: idA,
      });
      const sedeId = await crearSedeCore(adaptador(c), adminA, {
        empresaId: idB, // de otra empresa: debe ignorarse
        nombre: "Sucursal A",
      });

      const fila = await c.query(
        `SELECT empresa_id, nombre FROM sedes WHERE id = $1`,
        [sedeId],
      );
      expect(fila.rows[0].empresa_id).toBe(idA);
      expect(fila.rows[0].nombre).toBe("Sucursal A");
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });
});
