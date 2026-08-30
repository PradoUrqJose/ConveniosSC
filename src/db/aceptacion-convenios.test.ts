import { config } from "dotenv";
config({ path: ".env.local" });
import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import pg from "pg";
import { describe, expect, it } from "vitest";

// Las columnas `date` se devuelven como string `YYYY-MM-DD` (igual que el driver de la app).
pg.types.setTypeParser(1082, (s) => s);

import {
  cambiarTerminoCore,
  crearConvenioCore,
} from "@/modules/convenios/acciones";
import { listarConvenios } from "@/modules/convenios/query";
import type { SessionContext } from "@/lib/auth/guardas";
import type { TransaccionAuditada } from "@/lib/audit/registrar";

/**
 * Aceptación de T09 (06-BACKLOG.md): crear un convenio en cualquier orden de
 * empresas produce siempre `empresa_a_id < empresa_b_id`; cambiar un descuento
 * cierra el término anterior y crea el nuevo sin solape; con una fecha pasada
 * se devuelve el término vigente ese día.
 * Solo con `RUN_DB_TESTS=1`; cada caso corre en una transacción que se revierte
 * (la query de término vigente se replica dentro de la misma transacción).
 */
const URL = process.env.DATABASE_URL_UNPOOLED;
const ACTIVO = process.env.RUN_DB_TESTS === "1" && Boolean(URL);

async function conexion(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: URL });
  await c.connect();
  return c;
}

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
    requestId: "test-convenios",
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
  rol: "SUPERADMIN" | "VENDEDOR",
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

describe.skipIf(!ACTIVO)("Aceptación T09 — convenios y términos", () => {
  it("crearConvenio ordena las empresas: empresa_a_id < empresa_b_id", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100088444");
      const idB = await crearEmpresa(c, "20100088555");
      const [menor, mayor] = idA < idB ? [idA, idB] : [idB, idA];
      const actorId = await crearUsuario(c, "SUPERADMIN", null);

      // Se pasan en orden invertido a propósito; el core debe normalizar.
      const convenioId = await crearConvenioCore(
        adaptador(c),
        ctxSesion({ usuarioId: actorId }),
        {
          empresaXId: mayor,
          empresaYId: menor,
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          descuentoXotorgaBps: 1000,
          descuentoYotorgaBps: 2000,
          activarInmediatamente: true,
        },
      );

      const convenio = await c.query(
        `SELECT empresa_a_id, empresa_b_id FROM convenios WHERE id = $1`,
        [convenioId],
      );
      expect(convenio.rows[0].empresa_a_id).toBe(menor);
      expect(convenio.rows[0].empresa_b_id).toBe(mayor);

      const terminos = await c.query(
        `SELECT empresa_otorgante_id, descuento_bps FROM convenio_terminos
         WHERE convenio_id = $1`,
        [convenioId],
      );
      expect(terminos.rows).toHaveLength(2);
      const porOtorgante = Object.fromEntries(
        terminos.rows.map((r) => [r.empresa_otorgante_id, r.descuento_bps]),
      );
      expect(porOtorgante[menor]).toBe(2000);
      expect(porOtorgante[mayor]).toBe(1000);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("cambiarTermino cierra el anterior y crea el nuevo sin solape", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100088666");
      const idB = await crearEmpresa(c, "20100088777");
      const [menor, mayor] = idA < idB ? [idA, idB] : [idB, idA];
      const actorId = await crearUsuario(c, "SUPERADMIN", null);

      const convenioId = await crearConvenioCore(
        adaptador(c),
        ctxSesion({ usuarioId: actorId }),
        {
          empresaXId: menor,
          empresaYId: mayor,
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          descuentoXotorgaBps: 1500,
          descuentoYotorgaBps: 1000,
          activarInmediatamente: true,
        },
      );

      const res = await cambiarTerminoCore(
        adaptador(c),
        ctxSesion({ usuarioId: actorId }),
        {
          convenioId,
          empresaOtorganteId: menor,
          nuevoDescuentoBps: 1800,
          vigenteDesde: "2026-02-01",
        },
      );
      expect(res.ok).toBe(true);

      const terminos = await c.query(
        `SELECT descuento_bps, vigencia_desde, vigencia_hasta
         FROM convenio_terminos WHERE convenio_id = $1
           AND empresa_otorgante_id = $2
         ORDER BY vigencia_desde`,
        [convenioId, menor],
      );
      expect(terminos.rows).toHaveLength(2);
      const [viejo, nuevo] = terminos.rows;
      expect(viejo.descuento_bps).toBe(1500);
      expect(viejo.vigencia_hasta).toBe("2026-01-31");
      expect(nuevo.descuento_bps).toBe(1800);
      expect(nuevo.vigencia_desde).toBe("2026-02-01");
      expect(nuevo.vigencia_hasta).toBeNull();
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("misConveniosVigentes devuelve el término vigente en una fecha pasada", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const vendedora = await crearEmpresa(c, "20100088888");
      const beneficiaria = await crearEmpresa(c, "20100088999");
      const [menor, mayor] =
        vendedora < beneficiaria
          ? [vendedora, beneficiaria]
          : [beneficiaria, vendedora];
      const adminId = await crearUsuario(c, "SUPERADMIN", null);

      // El descuento inicial de la vendedora depende del lado que ocupe tras el orden canónico.
      const bpsInicialVendedora = vendedora === menor ? 1500 : 1000;

      const convenioId = await crearConvenioCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminId }),
        {
          empresaXId: menor,
          empresaYId: mayor,
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          descuentoXotorgaBps: 1500,
          descuentoYotorgaBps: 1000,
          activarInmediatamente: true,
        },
      );
      await cambiarTerminoCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminId }),
        {
          convenioId,
          empresaOtorganteId: vendedora,
          nuevoDescuentoBps: 1800,
          vigenteDesde: "2026-02-01",
        },
      );

      // Réplica de misConveniosVigentes dentro de la transacción del test.
      const ejecutar = async (aFecha: string) => {
        const filas = await adaptador(c).execute(sql`
          SELECT c.id AS convenio_id,
            CASE WHEN ct.empresa_otorgante_id = c.empresa_a_id
                 THEN c.empresa_b_id ELSE c.empresa_a_id END AS empresa_id,
            ct.descuento_bps, ct.id AS termino_id
          FROM convenios c
          JOIN convenio_terminos ct
            ON ct.convenio_id = c.id
           AND ct.empresa_otorgante_id = ${vendedora}
          WHERE c.estado = 'VIGENTE'
            AND ${aFecha} >= c.vigencia_desde
            AND (c.vigencia_hasta IS NULL OR ${aFecha} <= c.vigencia_hasta)
            AND ct.vigencia_desde <= ${aFecha}
            AND (ct.vigencia_hasta IS NULL OR ct.vigencia_hasta >= ${aFecha})
        `);
        const filasNorm = (filas as unknown as { rows: unknown[] }).rows;
        return filasNorm as Record<string, unknown>[];
      };

      const antes = await ejecutar("2026-01-15");
      expect(antes).toHaveLength(1);
      expect(antes[0]!.empresa_id).toBe(beneficiaria);
      expect(antes[0]!.descuento_bps).toBe(bpsInicialVendedora);

      const despues = await ejecutar("2026-02-15");
      expect(despues).toHaveLength(1);
      expect(despues[0]!.descuento_bps).toBe(1800);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("listarConvenios pagina sin repetir filas y conserva los términos vigentes de ambas direcciones", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const descuentos = new Map<string, { a: number; b: number }>();

      for (let i = 0; i < 21; i++) {
        const empresaX = await crearEmpresa(c, String(27900090000 + i * 2));
        const empresaY = await crearEmpresa(c, String(27900090001 + i * 2));
        const [empresaA, empresaB] =
          empresaX < empresaY ? [empresaX, empresaY] : [empresaY, empresaX];
        const { rows } = await c.query(
          `INSERT INTO convenios
             (empresa_a_id, empresa_b_id, estado, vigencia_desde, created_at)
           VALUES ($1, $2, 'VIGENTE', '2020-01-01', now() - ($3 * interval '1 minute'))
           RETURNING id`,
          [empresaA, empresaB, i],
        );
        const convenioId = rows[0].id as string;
        const descuentoA = 1000 + i;
        const descuentoB = 2000 + i;
        descuentos.set(convenioId, { a: descuentoA, b: descuentoB });
        await c.query(
          `INSERT INTO convenio_terminos
             (convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde)
           VALUES ($1, $2, $3, '2020-01-01'), ($1, $4, $5, '2020-01-01')`,
          [convenioId, empresaA, descuentoA, empresaB, descuentoB],
        );
      }

      const pagina1 = await listarConvenios(ctxSesion({}), {}, adaptador(c));
      expect(pagina1.items).toHaveLength(20);
      expect(pagina1.cursor).not.toBeNull();

      const pagina2 = await listarConvenios(
        ctxSesion({}),
        { cursor: pagina1.cursor ?? undefined },
        adaptador(c),
      );
      const propios = [...pagina1.items, ...pagina2.items].filter((convenio) =>
        descuentos.has(convenio.id),
      );
      expect(propios).toHaveLength(21);
      expect(new Set(propios.map((convenio) => convenio.id))).toHaveLength(21);

      for (const convenio of propios) {
        expect(convenio.terminoAotorga?.bps).toBe(
          descuentos.get(convenio.id)?.a,
        );
        expect(convenio.terminoBotorga?.bps).toBe(
          descuentos.get(convenio.id)?.b,
        );
      }
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);
});
