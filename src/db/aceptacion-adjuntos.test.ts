import { config } from "dotenv";
config({ path: ".env.local" });
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import pg from "pg";
import { describe, expect, it } from "vitest";

import type { SessionContext } from "@/lib/auth/guardas";
import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { leerAdjunto } from "@/modules/adjuntos/lectura";

/**
 * Aceptación de T11 (06-BACKLOG.md): un usuario de la empresa A recibe 404 al
 * pedir un adjunto de la empresa B, cada acceso deja una fila ADJUNTO_VISTO, y
 * el rate limit de lectura (100 / 5 min) responde LIMITE_EXCEDIDO. Solo con
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
    usuarioId: "00000000-0000-0000-0000-000000000002",
    empresaId: null,
    rol: "SUPERADMIN",
    requestId: "test-adjuntos",
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

async function crearEmpleado(
  c: pg.Client,
  empresaId: string,
  dni: string,
  creadoPorUsuarioId: string,
): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO empleados
       (empresa_id, dni, nombres, apellidos, estado, creado_por_usuario_id)
     VALUES ($1, $2, 'Ana', 'Bruno', 'ACTIVO', $3)
     RETURNING id`,
    [empresaId, dni, creadoPorUsuarioId],
  );
  return rows[0].id as string;
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
): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO ventas
       (id, empresa_vendedora_id, empresa_compradora_id, convenio_id,
        termino_id, sede_id, vendedor_usuario_id, empleado_comprador_id,
        monto_bruto_centimos, descuento_bps, monto_descuento_centimos,
        monto_final_centimos, fecha_venta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 10000, 1500, 1500, 8500, CURRENT_DATE)
     RETURNING id`,
    [
      "10000000-0000-0000-0000-00000000000b",
      datos.empresaVendedora,
      datos.empresaCompradora,
      datos.convenioId,
      datos.terminoId,
      datos.sedeId,
      datos.vendedorUsuarioId,
      datos.empleadoCompradorId,
    ],
  );
  return rows[0].id as string;
}

async function crearAdjuntoVenta(
  c: pg.Client,
  ventaId: string,
  subidoPor: string,
): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO adjuntos
       (venta_id, tipo, orden, blob_path, mime, size_bytes, sha256,
        subido_por_usuario_id)
     VALUES ($1, 'DOCUMENTO_VENTA', 0, 'ventas/x/documento/y.jpg', 'image/jpeg',
             100, $2, $3)
     RETURNING id`,
    [ventaId, "a".repeat(64), subidoPor],
  );
  return rows[0].id as string;
}

async function contarAdjuntovisto(
  c: pg.Client,
  adjuntoId: string,
): Promise<number> {
  const { rows } = await c.query(
    `SELECT count(*)::int AS n FROM auditoria
     WHERE accion = 'ADJUNTO_VISTO' AND entidad_id = $1`,
    [adjuntoId],
  );
  return rows[0].n as number;
}

describe.skipIf(!ACTIVO)("Aceptación T11 — adjuntos", () => {
  it("la base de datos rechaza nuevas fotos de identidad", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100068000");
      const adminA = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      const empleado = await crearEmpleado(c, idA, "60000101", adminA);
      await expect(
        c.query(
          `INSERT INTO adjuntos
             (empleado_id, tipo, orden, blob_path, mime, size_bytes, sha256,
              subido_por_usuario_id)
           VALUES ($1, 'FOTO_DNI', 0, 'empleados/x/dni/y.jpg', 'image/jpeg', 100,
                   $2, $3)`,
          [empleado, "a".repeat(64), adminA],
        ),
      ).rejects.toThrow(/adjuntos_sin_nuevas_fotos_identidad_check/i);
    } finally {
      await c.query("ROLLBACK");
      await c.end();
    }
  }, 60_000);

  it("DOCUMENTO_VENTA: solo la empresa vendedora; el vendedor solo las suyas", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100068200");
      const idB = await crearEmpresa(c, "20100068300");
      const vendedorA = await crearUsuario(c, "VENDEDOR", idA);
      const adminB = await crearUsuario(c, "ADMIN_EMPRESA", idB);
      const sede = await crearSede(c, idA);
      const { convenioId, terminoId } = await crearConvenioVigente(c, idA, idB);
      const empleado = await crearEmpleado(c, idB, "60000102", adminB);
      const ventaId = await crearVenta(c, {
        empresaVendedora: idA,
        empresaCompradora: idB,
        convenioId,
        terminoId,
        sedeId: sede,
        vendedorUsuarioId: vendedorA,
        empleadoCompradorId: empleado,
      });
      const adjuntoId = await crearAdjuntoVenta(c, ventaId, vendedorA);

      const compradora = await leerAdjunto(
        adaptador(c),
        ctxSesion({ usuarioId: adminB, empresaId: idB, rol: "ADMIN_EMPRESA" }),
        adjuntoId,
      );
      expect(compradora.ok).toBe(false);
      if (!compradora.ok) {
        expect(compradora.codigo).toBe("NO_ENCONTRADO");
      }

      const vendedor = await leerAdjunto(
        adaptador(c),
        ctxSesion({ usuarioId: vendedorA, empresaId: idA, rol: "VENDEDOR" }),
        adjuntoId,
      );
      expect(vendedor.ok).toBe(true);

      const otroVendedor = await crearUsuario(c, "VENDEDOR", idA);
      const ajena = await leerAdjunto(
        adaptador(c),
        ctxSesion({
          usuarioId: otroVendedor,
          empresaId: idA,
          rol: "VENDEDOR",
        }),
        adjuntoId,
      );
      expect(ajena.ok).toBe(false);
      if (!ajena.ok) {
        expect(ajena.codigo).toBe("NO_ENCONTRADO");
      }

      expect(await contarAdjuntovisto(c, adjuntoId)).toBe(1);
    } finally {
      await c.query("ROLLBACK");
      await c.end();
    }
  }, 60_000);

  it("un adjunto inexistente responde NO_ENCONTRADO", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100068400");
      const adminA = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      const res = await leerAdjunto(
        adaptador(c),
        ctxSesion({ usuarioId: adminA, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        "00000000-0000-0000-0000-0000000000ff",
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.codigo).toBe("NO_ENCONTRADO");
      }
    } finally {
      await c.query("ROLLBACK");
      await c.end();
    }
  }, 60_000);

  it("la lectura 101 en 5 minutos devuelve LIMITE_EXCEDIDO", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100068500");
      const adminA = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      const usuarioId = adminA;
      const adjuntoId = "00000000-0000-0000-0000-0000000000ff";

      await c.query(
        `INSERT INTO rate_limits (clave, ventana_inicio, contador)
         VALUES ('adjunto:' || $1, now(), 100)`,
        [usuarioId],
      );

      const res = await leerAdjunto(
        adaptador(c),
        ctxSesion({ usuarioId, empresaId: idA, rol: "ADMIN_EMPRESA" }),
        adjuntoId,
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.codigo).toBe("LIMITE_EXCEDIDO");
      }
    } finally {
      await c.query("ROLLBACK");
      await c.end();
    }
  }, 60_000);
});
