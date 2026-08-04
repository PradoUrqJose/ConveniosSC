import { config } from "dotenv";
config({ path: ".env.local" });
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import pg from "pg";
import { describe, expect, it } from "vitest";

import {
  crearEmpleadoCore,
  rechazarEmpleadoCore,
} from "@/modules/empleados/acciones";
import {
  contarPendientesVerificacion,
  listarEmpresasParaEmpleado,
} from "@/modules/empleados/query";
import type { SessionContext } from "@/lib/auth/guardas";
import type { TransaccionAuditada } from "@/lib/audit/registrar";

/**
 * Aceptación de T13 (06-BACKLOG.md): un empleado creado por el vendedor de la
 * empresa convenio nace `PENDIENTE_VERIFICACION`; creado por el admin de su
 * propia empresa nace `ACTIVO`; rechazar marca `requiere_revision` en sus
 * ventas registradas; el badge refleja el conteo real. Solo con
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
    requestId: "test-empleados",
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

async function crearSede(c: pg.Client, empresaId: string): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO sedes (empresa_id, nombre) VALUES ($1, 'Principal') RETURNING id`,
    [empresaId],
  );
  return rows[0].id as string;
}

async function crearConvenioVigente(
  c: pg.Client,
  xId: string,
  yId: string,
): Promise<{ convenioId: string; terminoId: string }> {
  const [a, b] = xId < yId ? [xId, yId] : [yId, xId];
  const { rows } = await c.query(
    `INSERT INTO convenios (empresa_a_id, empresa_b_id, estado, vigencia_desde)
     VALUES ($1, $2, 'VIGENTE', '2000-01-01') RETURNING id`,
    [a, b],
  );
  const convenioId = rows[0].id as string;
  const term = await c.query(
    `INSERT INTO convenio_terminos
       (convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde)
     VALUES ($1, $2, 1500, '2000-01-01'),
            ($1, $3, 1000, '2000-01-01')
     RETURNING id`,
    [convenioId, a, b],
  );
  return { convenioId, terminoId: term.rows[0].id as string };
}

async function crearVenta(
  c: pg.Client,
  datos: {
    empresaVendedora: string;
    empresaCompradora: string;
    convenioId: string;
    terminoId: string;
    sedeId: string;
    vendedorUsuarioId: string;
    empleadoCompradorId: string;
  },
): Promise<void> {
  await c.query(
    `INSERT INTO ventas
       (id, empresa_vendedora_id, empresa_compradora_id, convenio_id,
        termino_id, sede_id, vendedor_usuario_id, empleado_comprador_id,
        monto_bruto_centimos, descuento_bps, monto_descuento_centimos,
        monto_final_centimos, fecha_venta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 10000, 1500, 1500, 8500, CURRENT_DATE)`,
    [
      "10000000-0000-0000-0000-00000000000a",
      datos.empresaVendedora,
      datos.empresaCompradora,
      datos.convenioId,
      datos.terminoId,
      datos.sedeId,
      datos.vendedorUsuarioId,
      datos.empleadoCompradorId,
    ],
  );
}

describe.skipIf(!ACTIVO)("Aceptación T13 — empleados", () => {
  it("creado por el admin de su propia empresa nace ACTIVO", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100066100");
      const adminId = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      const res = await crearEmpleadoCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminId, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        {
          empresaId: idA,
          dni: "60000001",
          nombres: "Ana",
          apellidos: "Bruno",
          telefono: "987654321",
          fotoDni: {
            blobPath: "temporal/foto.jpg",
            sha256: "a".repeat(64),
            mime: "image/jpeg",
            sizeBytes: 10,
          },
          consentimiento: true,
        },
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.estado).toBe("ACTIVO");
      const fila = await c.query(`SELECT estado FROM empleados WHERE id = $1`, [
        res.empleadoId,
      ]);
      expect(fila.rows[0].estado).toBe("ACTIVO");
      const adjunto = await c.query(
        `SELECT count(*)::int AS n FROM adjuntos
         WHERE empleado_id = $1 AND tipo = 'FOTO_DNI'`,
        [res.empleadoId],
      );
      expect(adjunto.rows[0].n).toBe(1);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("creado por el vendedor de la empresa convenio nace PENDIENTE_VERIFICACION", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100066200");
      const idB = await crearEmpresa(c, "20100066300");
      await crearConvenioVigente(c, idA, idB);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);

      const res = await crearEmpleadoCore(
        adaptador(c),
        ctxSesion({ usuarioId: vendedorId, empresaId: idA, rol: "VENDEDOR" }),
        {
          empresaId: idB,
          dni: "60000002",
          nombres: "Carla",
          apellidos: "Diaz",
          fotoDni: {
            blobPath: "temporal/foto2.jpg",
            sha256: "b".repeat(64),
            mime: "image/jpeg",
            sizeBytes: 10,
          },
          consentimiento: true,
        },
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.estado).toBe("PENDIENTE_VERIFICACION");

      const pendientes = await contarPendientesVerificacion(
        ctxSesion({
          usuarioId: vendedorId,
          empresaId: idB,
          rol: "ADMIN_EMPRESA",
        }),
        adaptador(c),
      );
      expect(pendientes.total).toBe(1);

      // Sin convenio vigente, el vendedor no puede crear en esa empresa.
      const idC = await crearEmpresa(c, "20100066400");
      const sinConvenio = await crearEmpleadoCore(
        adaptador(c),
        ctxSesion({ usuarioId: vendedorId, empresaId: idA, rol: "VENDEDOR" }),
        {
          empresaId: idC,
          dni: "60000003",
          nombres: "Ernesto",
          apellidos: "Farias",
          fotoDni: {
            blobPath: "temporal/foto3.jpg",
            sha256: "c".repeat(64),
            mime: "image/jpeg",
            sizeBytes: 10,
          },
          consentimiento: true,
        },
      );
      expect(sinConvenio.ok).toBe(false);
      if (!sinConvenio.ok) {
        expect(sinConvenio.codigo).toBe("REGLA_NEGOCIO");
      }
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("rechazar marca requiere_revision en sus ventas registradas", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100066500");
      const idB = await crearEmpresa(c, "20100066600");
      const { convenioId, terminoId } = await crearConvenioVigente(c, idA, idB);
      const sedeId = await crearSede(c, idA);
      const adminA = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      const adminB = await crearUsuario(c, "ADMIN_EMPRESA", idB);

      const res = await crearEmpleadoCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminA, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        {
          empresaId: idB,
          dni: "60000004",
          nombres: "Gina",
          apellidos: "Herrera",
          fotoDni: {
            blobPath: "temporal/foto4.jpg",
            sha256: "d".repeat(64),
            mime: "image/jpeg",
            sizeBytes: 10,
          },
          consentimiento: true,
        },
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      await crearVenta(c, {
        empresaVendedora: idA,
        empresaCompradora: idB,
        convenioId,
        terminoId,
        sedeId,
        vendedorUsuarioId: adminA,
        empleadoCompradorId: res.empleadoId,
      });

      const rechazo = await rechazarEmpleadoCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminB, empresaId: idB, rol: "ADMIN_EMPRESA" }),
        {
          empleadoId: res.empleadoId,
          motivo: "Documento no coincide con el titular",
        },
      );
      expect(rechazo.ok).toBe(true);

      const venta = await c.query(
        `SELECT requiere_revision FROM ventas
         WHERE empleado_comprador_id = $1`,
        [res.empleadoId],
      );
      expect(venta.rows[0].requiere_revision).toBe(true);
      const empleado = await c.query(
        `SELECT estado, motivo_rechazo FROM empleados WHERE id = $1`,
        [res.empleadoId],
      );
      expect(empleado.rows[0].estado).toBe("RECHAZADO");
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("DNI duplicado devuelve CONFLICTO con el nombre de la empresa", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100066700");
      const idB = await crearEmpresa(c, "20100066800");
      await crearConvenioVigente(c, idA, idB);
      const adminId = await crearUsuario(c, "ADMIN_EMPRESA", idA);

      const primero = await crearEmpleadoCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminId, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        {
          empresaId: idB,
          dni: "60000005",
          nombres: "Iris",
          apellidos: "Juarez",
          fotoDni: {
            blobPath: "temporal/foto5.jpg",
            sha256: "e".repeat(64),
            mime: "image/jpeg",
            sizeBytes: 10,
          },
          consentimiento: true,
        },
      );
      expect(primero.ok).toBe(true);

      const duplicado = await crearEmpleadoCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminId, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        {
          empresaId: idB,
          dni: "60000005",
          nombres: "Karla",
          apellidos: "Lopez",
          fotoDni: {
            blobPath: "temporal/foto6.jpg",
            sha256: "f".repeat(64),
            mime: "image/jpeg",
            sizeBytes: 10,
          },
          consentimiento: true,
        },
      );
      expect(duplicado.ok).toBe(false);
      if (!duplicado.ok) {
        expect(duplicado.codigo).toBe("CONFLICTO");
        expect(duplicado.mensaje).toContain("Comercial");
      }
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("listarEmpresasParaEmpleado: convenio vigente + propia; el badge cuenta solo pendientes de la empresa", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100066900");
      const idB = await crearEmpresa(c, "20100067000");
      await crearConvenioVigente(c, idA, idB);
      const adminId = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      const ctx = ctxSesion({
        usuarioId: adminId,
        empresaId: idA,
        rol: "ADMIN_EMPRESA",
      });

      const opciones = await listarEmpresasParaEmpleado(ctx, adaptador(c));
      const nombres = opciones.map((o) => o.nombreComercial);
      expect(nombres).toContain("Comercial 20100066900");
      expect(nombres).toContain("Comercial 20100067000");
      expect(nombres).not.toContain("Comercial 20100067100");

      // Vendedor de A crea un empleado de B (convenio) → PENDIENTE en B.
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      await crearEmpleadoCore(
        adaptador(c),
        ctxSesion({ usuarioId: vendedorId, empresaId: idA, rol: "VENDEDOR" }),
        {
          empresaId: idB,
          dni: "60000006",
          nombres: "Marta",
          apellidos: "Nuñez",
          fotoDni: {
            blobPath: "temporal/foto7.jpg",
            sha256: "1".repeat(64),
            mime: "image/jpeg",
            sizeBytes: 10,
          },
          consentimiento: true,
        },
      );

      // El badge del admin de B lo cuenta; el del admin de A, no.
      const adminB = await crearUsuario(c, "ADMIN_EMPRESA", idB);
      const badgeB = await contarPendientesVerificacion(
        ctxSesion({ usuarioId: adminB, empresaId: idB, rol: "ADMIN_EMPRESA" }),
        adaptador(c),
      );
      expect(badgeB.total).toBe(1);
      const badgeA = await contarPendientesVerificacion(ctx, adaptador(c));
      expect(badgeA.total).toBe(0);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);
});
