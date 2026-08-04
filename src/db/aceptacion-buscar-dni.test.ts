import { config } from "dotenv";
config({ path: ".env.local" });
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import pg from "pg";
import { describe, expect, it } from "vitest";

import type { SessionContext } from "@/lib/auth/guardas";
import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { buscarPorDni } from "@/modules/empleados/query";

/**
 * Aceptación de T12 (06-BACKLOG.md): `buscarPorDni` cubre los cinco casos de
 * 02-LOGICA-NEGOCIO.md §4, la respuesta SIN_CONVENIO no incluye nombres ni
 * teléfono, y la búsqueda 21 en un minuto devuelve 429. Solo con
 * `RUN_DB_TESTS=1`; cada caso corre en una transacción que se revierte.
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
    requestId: "test-buscar-dni",
    ip: null,
    userAgent: null,
    ...parcial,
  };
}

async function crearEmpresa(c: pg.Client, ruc: string): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO empresas (ruc, razon_social, nombre_comercial)
     VALUES ($1, $2, $3) RETURNING id`,
    [ruc, `Razon ${ruc}`, `Comercial ${ruc}`],
  );
  return rows[0].id as string;
}

async function crearUsuario(
  c: pg.Client,
  rol: string,
  empresaId: string | null,
): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO usuarios
       (username, password_hash, nombres, apellidos, rol, empresa_id)
     VALUES ($1, 'hash', 'Juan', 'Perez', $2, $3) RETURNING id`,
    [`test-${Math.random().toString(36).slice(2)}`, rol, empresaId],
  );
  return rows[0].id as string;
}

async function crearEmpleado(
  c: pg.Client,
  empresaId: string,
  dni: string,
  estado = "ACTIVO",
): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO empleados (empresa_id, dni, nombres, apellidos, estado)
     VALUES ($1, $2, 'Ana', 'Bruno', $3) RETURNING id`,
    [empresaId, dni, estado],
  );
  return rows[0].id as string;
}

async function crearConvenioVigente(
  c: pg.Client,
  xId: string,
  yId: string,
  bpsX: number,
  bpsY: number,
): Promise<string> {
  const [a, b] = xId < yId ? [xId, yId] : [yId, xId];
  const bpsA = xId < yId ? bpsX : bpsY;
  const bpsB = xId < yId ? bpsY : bpsX;
  const { rows } = await c.query(
    `INSERT INTO convenios (empresa_a_id, empresa_b_id, estado, vigencia_desde)
     VALUES ($1, $2, 'VIGENTE', '2000-01-01') RETURNING id`,
    [a, b],
  );
  const convenioId = rows[0].id as string;
  await c.query(
    `INSERT INTO convenio_terminos
       (convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde)
     VALUES ($1, $2, $3, '2000-01-01'),
            ($1, $4, $5, '2000-01-01')`,
    [convenioId, a, bpsA, b, bpsB],
  );
  return convenioId;
}

describe.skipIf(!ACTIVO)("Aceptación T12 — búsqueda por DNI", () => {
  it("a) DNI inexistente → NO_EXISTE con puedeCrear", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const adminId = await crearUsuario(c, "SUPERADMIN", null);
      const res = await buscarPorDni(
        ctxSesion({ usuarioId: adminId }),
        { dni: "00000000" },
        adaptador(c),
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data).toEqual({
        encontrado: false,
        motivo: "NO_EXISTE",
        puedeCrear: true,
      });
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("b) empleado de mi propia empresa → PROPIA_EMPRESA sin datos", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100077100");
      const adminId = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      await crearEmpleado(c, idA, "11111111");
      const res = await buscarPorDni(
        ctxSesion({ usuarioId: adminId, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        { dni: "11111111" },
        adaptador(c),
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data).toEqual({
        encontrado: false,
        motivo: "PROPIA_EMPRESA",
      });
      expect("nombres" in res.data).toBe(false);
      expect("telefono" in res.data).toBe(false);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("c) empleado de empresa con convenio vigente → encontrado con datos y término", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100077200");
      const idB = await crearEmpresa(c, "20100077300");
      const adminId = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      const empleadoId = await crearEmpleado(c, idB, "22222222");
      await crearConvenioVigente(c, idA, idB, 1500, 900);

      const res = await buscarPorDni(
        ctxSesion({ usuarioId: adminId, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        { dni: "22222222" },
        adaptador(c),
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.encontrado).toBe(true);
      if (!res.data.encontrado) return;
      expect(res.data.empleado).toMatchObject({
        id: empleadoId,
        dni: "22222222",
        nombres: "Ana",
        apellidos: "Bruno",
        empresaId: idB,
        empresaNombre: `Comercial ${"20100077300"}`,
        estado: "ACTIVO",
        tieneFotoDni: false,
        descuentoBps: 1500,
      });
      expect(res.data.empleado.convenioId).toBeTruthy();

      // Con foto del DNI cargada, tieneFotoDni pasa a true.
      await c.query(
        `INSERT INTO adjuntos
           (empleado_id, tipo, blob_path, mime, size_bytes, sha256, subido_por_usuario_id)
         VALUES ($1, 'FOTO_DNI', 'foto-1.jpg', 'image/jpeg', 10, $3, $2)`,
        [empleadoId, adminId, "a".repeat(64)],
      );
      const conFoto = await buscarPorDni(
        ctxSesion({ usuarioId: adminId, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        { dni: "22222222" },
        adaptador(c),
      );
      expect(conFoto.ok).toBe(true);
      if (conFoto.ok && conFoto.data.encontrado) {
        expect(conFoto.data.empleado.tieneFotoDni).toBe(true);
      }
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("d) empleado de empresa sin convenio → SIN_CONVENIO sin nombres ni teléfono", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100077400");
      const idC = await crearEmpresa(c, "20100077500");
      const adminId = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      await crearEmpleado(c, idC, "33333333");
      const res = await buscarPorDni(
        ctxSesion({ usuarioId: adminId, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        { dni: "33333333" },
        adaptador(c),
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.encontrado).toBe(false);
      if (res.data.encontrado) return;
      expect(res.data.motivo).toBe("SIN_CONVENIO");
      if (res.data.motivo !== "SIN_CONVENIO") return;
      expect(res.data.empresaNombre).toBe(`Comercial ${"20100077500"}`);
      expect("nombres" in res.data).toBe(false);
      expect("telefono" in res.data).toBe(false);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("e) empleado RECHAZADO o INACTIVO → NO_HABILITADO", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100077600");
      const idB = await crearEmpresa(c, "20100077700");
      const adminId = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      await crearConvenioVigente(c, idA, idB, 1000, 1000);
      await crearEmpleado(c, idB, "44444444", "RECHAZADO");
      await crearEmpleado(c, idB, "55555555", "INACTIVO");

      const ctx = ctxSesion({
        usuarioId: adminId,
        empresaId: idA,
        rol: "ADMIN_EMPRESA",
      });
      for (const dni of ["44444444", "55555555"]) {
        const res = await buscarPorDni(ctx, { dni }, adaptador(c));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.data).toEqual({
          encontrado: false,
          motivo: "NO_HABILITADO",
        });
      }
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("f) la búsqueda 21 en un minuto devuelve 429 (LIMITE_EXCEDIDO)", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const adminId = await crearUsuario(c, "SUPERADMIN", null);
      const ctx = ctxSesion({ usuarioId: adminId });

      for (let i = 0; i < 20; i++) {
        const res = await buscarPorDni(ctx, { dni: "99999999" }, adaptador(c));
        expect(res.ok).toBe(true);
      }
      const vigesimaPrimera = await buscarPorDni(
        ctx,
        { dni: "99999999" },
        adaptador(c),
      );
      expect(vigesimaPrimera.ok).toBe(false);
      if (!vigesimaPrimera.ok) {
        expect(vigesimaPrimera.codigo).toBe("LIMITE_EXCEDIDO");
      }
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);
});
