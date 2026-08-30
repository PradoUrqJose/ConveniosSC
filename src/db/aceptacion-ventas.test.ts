import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
config({ path: ".env.local" });
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import pg from "pg";
import { afterEach, describe, expect, it } from "vitest";

import {
  anularVentaCore,
  crearVentaCore,
  type ArchivoVenta,
} from "@/modules/ventas/acciones";
import { listarVentas, obtenerVenta } from "@/modules/ventas/query";
import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { calcularDescuento } from "@/lib/dinero";
import { hoyLima, sumarDias } from "@/lib/fechas";

/**
 * Aceptación de T14 (06-BACKLOG.md): `crearVenta` con los 12 pasos de
 * `02-LOGICA-NEGOCIO.md §2`. Solo con `RUN_DB_TESTS=1`; cada caso corre en
 * una transacción que se revierte, sin dejar residuos en la BD. El criterio
 * #9 (cronómetro en móvil real) no es automatizable y se deja fuera.
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

type CtxTest = {
  usuarioId: string;
  empresaId: string;
  rol: "SUPERADMIN" | "ADMIN_EMPRESA" | "VENDEDOR";
  requestId: string;
  ip: string | null;
  userAgent: string | null;
};

function ctx(
  usuarioId: string,
  empresaId: string,
  rol: CtxTest["rol"] = "VENDEDOR",
): CtxTest {
  return {
    usuarioId,
    empresaId,
    rol,
    requestId: "test-ventas",
    ip: null,
    userAgent: null,
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

async function crearEmpleadoActivo(
  c: pg.Client,
  empresaId: string,
  dni: string,
): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO empleados (empresa_id, dni, nombres, apellidos, estado)
     VALUES ($1, $2, 'Test', 'Empleado', 'ACTIVO') RETURNING id`,
    [empresaId, dni],
  );
  return rows[0].id as string;
}

/** Convenio VIGENTE de larga data (para no interferir con las ventanas de fecha probadas). */
async function crearConvenio(
  c: pg.Client,
  xId: string,
  yId: string,
): Promise<string> {
  const [a, b] = xId < yId ? [xId, yId] : [yId, xId];
  const { rows } = await c.query(
    `INSERT INTO convenios (empresa_a_id, empresa_b_id, estado, vigencia_desde)
     VALUES ($1, $2, 'VIGENTE', '2000-01-01') RETURNING id`,
    [a, b],
  );
  return rows[0].id as string;
}

async function crearTermino(
  c: pg.Client,
  convenioId: string,
  otorganteId: string,
  bps: number,
  desde: string,
  hasta: string | null,
): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO convenio_terminos
       (convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde, vigencia_hasta)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [convenioId, otorganteId, bps, desde, hasta],
  );
  return rows[0].id as string;
}

/**
 * Fixture directa para los tests de T15 (listado/detalle/anulación): estos no
 * ejercitan el algoritmo de `crearVentaCore` (ya cubierto en T14), así que
 * insertan la fila de `ventas` directo, sin pasar por adjuntos reales.
 */
async function crearVentaDirecta(
  c: pg.Client,
  args: {
    empresaVendedoraId: string;
    empresaCompradoraId: string;
    convenioId: string;
    terminoId: string;
    sedeId: string;
    vendedorId: string;
    empleadoId: string;
    montoBruto: number;
    bps: number;
    fechaVenta: string;
    estado?: "REGISTRADA" | "ANULADA";
  },
): Promise<string> {
  const { descuento, final } = calcularDescuento(args.montoBruto, args.bps);
  const { rows } = await c.query(
    `INSERT INTO ventas
       (id, empresa_vendedora_id, empresa_compradora_id, convenio_id, termino_id,
        sede_id, vendedor_usuario_id, empleado_comprador_id, monto_bruto_centimos,
        descuento_bps, monto_descuento_centimos, monto_final_centimos, fecha_venta, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [
      randomUUID(),
      args.empresaVendedoraId,
      args.empresaCompradoraId,
      args.convenioId,
      args.terminoId,
      args.sedeId,
      args.vendedorId,
      args.empleadoId,
      args.montoBruto,
      args.bps,
      descuento,
      final,
      args.fechaVenta,
      args.estado ?? "REGISTRADA",
    ],
  );
  return rows[0].id as string;
}

/**
 * `crearVentaCore` confirma que un adjunto realmente existe (`blobExiste` en
 * `modules/ventas/acciones.ts`) en vez de confiar en el callback asíncrono
 * `onUploadCompleted` de Vercel Blob. Para no depender de credenciales reales
 * de Blob en los tests, se usa el mismo respaldo local que `subirArchivoLocal`
 * (`public/uploads/...`): se escribe un archivo real y se limpia en `afterEach`.
 */
const ARCHIVOS_TEMPORALES: string[] = [];

async function documentoSubido(sufijo: string): Promise<ArchivoVenta> {
  const nombre = `test-${sufijo}-${randomUUID()}.jpg`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const absoluto = path.join(dir, nombre);
  // JPEG real (magic bytes FF D8 FF) más un relleno único por archivo: el
  // servidor recalcula sha256 y tamaño sobre estos bytes y rechaza la venta si
  // no coinciden con lo declarado, así que la declaración se deriva del mismo
  // contenido en vez de inventarse.
  const bytes = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from(`${sufijo}-${randomUUID()}`),
  ]);
  await writeFile(absoluto, bytes);
  ARCHIVOS_TEMPORALES.push(absoluto);
  return {
    blobPath: `/uploads/${nombre}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    mime: "image/jpeg",
    sizeBytes: bytes.byteLength,
  };
}

afterEach(async () => {
  while (ARCHIVOS_TEMPORALES.length > 0) {
    const archivo = ARCHIVOS_TEMPORALES.pop();
    if (archivo) await unlink(archivo).catch(() => undefined);
  }
});

const HOY = hoyLima();

describe.skipIf(!ACTIVO)("Aceptación T14 — crearVenta", () => {
  it("doble envío del mismo ventaId crea una sola venta (idempotencia)", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070001");
      const idB = await crearEmpresa(c, "20100070002");
      const convenioId = await crearConvenio(c, idA, idB);
      await crearTermino(c, convenioId, idA, 1500, "2000-01-01", null);
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoId = await crearEmpleadoActivo(c, idB, "70000001");
      const contexto = ctx(vendedorId, idA);
      const ventaId = randomUUID();

      const datos = {
        ventaId,
        empleadoCompradorId: empleadoId,
        sedeId,
        montoBrutoCentimos: 10_000,
        fechaVenta: HOY,
        documento: await documentoSubido("a"),
        evidencias: [],
      };

      const primera = await crearVentaCore(adaptador(c), contexto, datos);
      expect(primera.ok).toBe(true);
      if (!primera.ok) return;
      expect(primera.data.yaExistia).toBe(false);

      const segunda = await crearVentaCore(adaptador(c), contexto, datos);
      expect(segunda.ok).toBe(true);
      if (!segunda.ok) return;
      expect(segunda.data.yaExistia).toBe(true);
      expect(segunda.data.ventaId).toBe(ventaId);

      const filas = await c.query(
        `SELECT count(*)::int AS n FROM ventas WHERE id = $1`,
        [ventaId],
      );
      expect(filas.rows[0].n).toBe(1);

      // Otro usuario reenviando el mismo ventaId: conflicto, no lo adopta.
      const otroVendedor = await crearUsuario(c, "VENDEDOR", idA);
      const conflicto = await crearVentaCore(
        adaptador(c),
        ctx(otroVendedor, idA),
        datos,
      );
      expect(conflicto.ok).toBe(false);
      if (!conflicto.ok) expect(conflicto.codigo).toBe("CONFLICTO");
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("el servidor recalcula siempre desde el bps vigente, en céntimos exactos", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070003");
      const idB = await crearEmpresa(c, "20100070004");
      const convenioId = await crearConvenio(c, idA, idB);
      await crearTermino(c, convenioId, idA, 1500, "2000-01-01", null);
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoId = await crearEmpleadoActivo(c, idB, "70000002");

      const res = await crearVentaCore(adaptador(c), ctx(vendedorId, idA), {
        ventaId: randomUUID(),
        empleadoCompradorId: empleadoId,
        sedeId,
        montoBrutoCentimos: 3333,
        fechaVenta: HOY,
        documento: await documentoSubido("b"),
        evidencias: [],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      // 3333 * 1500 / 10000 = 499.95 → 500 (half-up), igual que dinero.test.ts.
      expect(res.data.descuentoBps).toBe(1500);
      expect(res.data.montoDescuentoCentimos).toBe(500);
      expect(res.data.montoFinalCentimos).toBe(2833);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("una venta a 30 días es rechazada (límite 7)", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070005");
      const idB = await crearEmpresa(c, "20100070006");
      const convenioId = await crearConvenio(c, idA, idB);
      await crearTermino(c, convenioId, idA, 1500, "2000-01-01", null);
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoId = await crearEmpleadoActivo(c, idB, "70000003");

      const res = await crearVentaCore(adaptador(c), ctx(vendedorId, idA), {
        ventaId: randomUUID(),
        empleadoCompradorId: empleadoId,
        sedeId,
        montoBrutoCentimos: 10_000,
        fechaVenta: sumarDias(HOY, -30),
        documento: await documentoSubido("c"),
        evidencias: [],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.codigo).toBe("VALIDACION");
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("una venta retroactiva usa el descuento_bps vigente en esa fecha, no el de hoy", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070009");
      const idB = await crearEmpresa(c, "20100070010");
      const convenioId = await crearConvenio(c, idA, idB);
      const ayer = sumarDias(HOY, -1);
      const anteayer = sumarDias(HOY, -2);
      // Término "viejo" vigente hasta anteayer, término "nuevo" desde ayer.
      await crearTermino(c, convenioId, idA, 1000, "2000-01-01", anteayer);
      await crearTermino(c, convenioId, idA, 2500, ayer, null);
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoId = await crearEmpleadoActivo(c, idB, "70000005");

      // Venta de ayer: debe tomar el término nuevo (2500 bps), vigente desde ayer.
      const res = await crearVentaCore(adaptador(c), ctx(vendedorId, idA), {
        ventaId: randomUUID(),
        empleadoCompradorId: empleadoId,
        sedeId,
        montoBrutoCentimos: 10_000,
        fechaVenta: ayer,
        documento: await documentoSubido("e"),
        evidencias: [],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.descuentoBps).toBe(2500);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("cambiar el descuento del convenio después no altera la venta ya guardada", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070011");
      const idB = await crearEmpresa(c, "20100070012");
      const convenioId = await crearConvenio(c, idA, idB);
      await crearTermino(c, convenioId, idA, 1500, "2000-01-01", null);
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoId = await crearEmpleadoActivo(c, idB, "70000006");

      const res = await crearVentaCore(adaptador(c), ctx(vendedorId, idA), {
        ventaId: randomUUID(),
        empleadoCompradorId: empleadoId,
        sedeId,
        montoBrutoCentimos: 10_000,
        fechaVenta: HOY,
        documento: await documentoSubido("f"),
        evidencias: [],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.descuentoBps).toBe(1500);

      // Se cierra el término viejo y se abre uno nuevo con otro descuento, como
      // haría `cambiarTermino` en `modules/convenios`.
      await c.query(
        `UPDATE convenio_terminos SET vigencia_hasta = $1
         WHERE convenio_id = $2 AND empresa_otorgante_id = $3 AND vigencia_hasta IS NULL`,
        [sumarDias(HOY, -1), convenioId, idA],
      );
      await crearTermino(c, convenioId, idA, 3000, HOY, null);

      const relectura = await c.query(
        `SELECT descuento_bps, monto_descuento_centimos FROM ventas WHERE id = $1`,
        [res.data.ventaId],
      );
      expect(relectura.rows[0].descuento_bps).toBe(1500);
      expect(relectura.rows[0].monto_descuento_centimos).toBe("1500");
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("vender a un empleado de la propia empresa es rechazado", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070013");
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoPropio = await crearEmpleadoActivo(c, idA, "70000007");

      const res = await crearVentaCore(adaptador(c), ctx(vendedorId, idA), {
        ventaId: randomUUID(),
        empleadoCompradorId: empleadoPropio,
        sedeId,
        montoBrutoCentimos: 10_000,
        fechaVenta: HOY,
        documento: await documentoSubido("g"),
        evidencias: [],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.codigo).toBe("REGLA_NEGOCIO");
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("un documento que no existe realmente es rechazado", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070014");
      const idB = await crearEmpresa(c, "20100070015");
      const convenioId = await crearConvenio(c, idA, idB);
      await crearTermino(c, convenioId, idA, 1500, "2000-01-01", null);
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoId = await crearEmpleadoActivo(c, idB, "70000008");

      const res = await crearVentaCore(adaptador(c), ctx(vendedorId, idA), {
        ventaId: randomUUID(),
        empleadoCompradorId: empleadoId,
        sedeId,
        montoBrutoCentimos: 10_000,
        fechaVenta: HOY,
        // Nunca se escribió este archivo: ni en Blob ni en el respaldo local.
        documento: {
          blobPath: `/uploads/no-existe-${randomUUID()}.jpg`,
          sha256: "9".repeat(64),
          mime: "image/jpeg",
          sizeBytes: 1000,
        },
        evidencias: [],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.codigo).toBe("REGLA_NEGOCIO");

      const filas = await c.query(
        `SELECT count(*)::int AS n FROM ventas WHERE empleado_comprador_id = $1`,
        [empleadoId],
      );
      expect(filas.rows[0].n).toBe(0);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("rechaza un adjunto cuyo sha256 declarado no es el del archivo", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070020");
      const idB = await crearEmpresa(c, "20100070021");
      const convenioId = await crearConvenio(c, idA, idB);
      await crearTermino(c, convenioId, idA, 1500, "2000-01-01", null);
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoId = await crearEmpleadoActivo(c, idB, "70000011");

      const documento = await documentoSubido("j");
      const res = await crearVentaCore(adaptador(c), ctx(vendedorId, idA), {
        ventaId: randomUUID(),
        empleadoCompradorId: empleadoId,
        sedeId,
        montoBrutoCentimos: 10_000,
        fechaVenta: HOY,
        // El archivo existe, pero el cliente miente sobre su contenido.
        documento: { ...documento, sha256: "a".repeat(64), sizeBytes: 999 },
        evidencias: [],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.codigo).toBe("VALIDACION");

      const filas = await c.query(
        `SELECT count(*)::int AS n FROM ventas WHERE empleado_comprador_id = $1`,
        [empleadoId],
      );
      expect(filas.rows[0].n).toBe(0);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("guarda el mime, tamaño y sha256 que calculó el servidor", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070022");
      const idB = await crearEmpresa(c, "20100070023");
      const convenioId = await crearConvenio(c, idA, idB);
      await crearTermino(c, convenioId, idA, 1500, "2000-01-01", null);
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoId = await crearEmpleadoActivo(c, idB, "70000012");

      const documento = await documentoSubido("k");
      const res = await crearVentaCore(adaptador(c), ctx(vendedorId, idA), {
        ventaId: randomUUID(),
        empleadoCompradorId: empleadoId,
        sedeId,
        montoBrutoCentimos: 10_000,
        fechaVenta: HOY,
        documento,
        evidencias: [],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const adjunto = await c.query(
        `SELECT mime, size_bytes, sha256 FROM adjuntos WHERE venta_id = $1`,
        [res.data.ventaId],
      );
      expect(adjunto.rows[0]).toMatchObject({
        mime: "image/jpeg",
        size_bytes: documento.sizeBytes,
        sha256: documento.sha256,
      });
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);

  it("la venta, sus adjuntos y su auditoría se crean juntos", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100070016");
      const idB = await crearEmpresa(c, "20100070017");
      const convenioId = await crearConvenio(c, idA, idB);
      await crearTermino(c, convenioId, idA, 1500, "2000-01-01", null);
      const sedeId = await crearSede(c, idA);
      const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
      const empleadoId = await crearEmpleadoActivo(c, idB, "70000009");

      const res = await crearVentaCore(adaptador(c), ctx(vendedorId, idA), {
        ventaId: randomUUID(),
        empleadoCompradorId: empleadoId,
        sedeId,
        montoBrutoCentimos: 10_000,
        fechaVenta: HOY,
        documento: await documentoSubido("h"),
        evidencias: [await documentoSubido("i")],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const adjuntos = await c.query(
        `SELECT tipo FROM adjuntos WHERE venta_id = $1 ORDER BY orden`,
        [res.data.ventaId],
      );
      expect(adjuntos.rows.map((r: { tipo: string }) => r.tipo)).toEqual([
        "DOCUMENTO_VENTA",
        "EVIDENCIA",
      ]);

      const auditoria = await c.query(
        `SELECT count(*)::int AS n FROM auditoria
         WHERE accion = 'VENTA_CREADA' AND entidad_id = $1`,
        [res.data.ventaId],
      );
      expect(auditoria.rows[0].n).toBe(1);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  }, 60_000);
});

/**
 * Aceptación de T15 (06-BACKLOG.md): `listarVentas`, `obtenerVenta` y
 * `anularVenta`. Mismo patrón que T14: solo con `RUN_DB_TESTS=1`, cada caso
 * en una transacción que se revierte.
 */
describe.skipIf(!ACTIVO)(
  "Aceptación T15 — listado, detalle y anulación",
  () => {
    it("un VENDEDOR que manda vendedorId de otro usuario sigue viendo solo sus ventas", async () => {
      const c = await conexion();
      try {
        await c.query("BEGIN");
        const idA = await crearEmpresa(c, "20100080001");
        const idB = await crearEmpresa(c, "20100080002");
        const convenioId = await crearConvenio(c, idA, idB);
        const terminoId = await crearTermino(
          c,
          convenioId,
          idA,
          1500,
          "2000-01-01",
          null,
        );
        const sedeId = await crearSede(c, idA);
        const vendedor1 = await crearUsuario(c, "VENDEDOR", idA);
        const vendedor2 = await crearUsuario(c, "VENDEDOR", idA);
        const empleadoId = await crearEmpleadoActivo(c, idB, "80000001");

        await crearVentaDirecta(c, {
          empresaVendedoraId: idA,
          empresaCompradoraId: idB,
          convenioId,
          terminoId,
          sedeId,
          vendedorId: vendedor1,
          empleadoId,
          montoBruto: 10_000,
          bps: 1500,
          fechaVenta: HOY,
        });
        await crearVentaDirecta(c, {
          empresaVendedoraId: idA,
          empresaCompradoraId: idB,
          convenioId,
          terminoId,
          sedeId,
          vendedorId: vendedor2,
          empleadoId,
          montoBruto: 20_000,
          bps: 1500,
          fechaVenta: HOY,
        });

        const pagina = await listarVentas(
          ctx(vendedor1, idA, "VENDEDOR"),
          { vendedorId: vendedor2 },
          adaptador(c),
        );
        expect(pagina.items).toHaveLength(1);
        expect(pagina.items[0]?.vendedor.id).toBe(vendedor1);
        expect(pagina.resumen.cantidad).toBe(1);
      } finally {
        await c.query("ROLLBACK").catch(() => undefined);
        await c.end();
      }
    }, 60_000);

    it("un ADMIN_EMPRESA ve «compraron mis empleados» con montos pero sin poder abrir los adjuntos", async () => {
      const c = await conexion();
      try {
        await c.query("BEGIN");
        const idA = await crearEmpresa(c, "20100080003");
        const idB = await crearEmpresa(c, "20100080004");
        const convenioId = await crearConvenio(c, idA, idB);
        const terminoId = await crearTermino(
          c,
          convenioId,
          idA,
          1500,
          "2000-01-01",
          null,
        );
        const sedeId = await crearSede(c, idA);
        const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
        const adminB = await crearUsuario(c, "ADMIN_EMPRESA", idB);
        const empleadoId = await crearEmpleadoActivo(c, idB, "80000002");

        const ventaId = await crearVentaDirecta(c, {
          empresaVendedoraId: idA,
          empresaCompradoraId: idB,
          convenioId,
          terminoId,
          sedeId,
          vendedorId,
          empleadoId,
          montoBruto: 10_000,
          bps: 1500,
          fechaVenta: HOY,
        });
        await c.query(
          `INSERT INTO adjuntos
           (venta_id, tipo, orden, blob_path, mime, size_bytes, sha256, subido_por_usuario_id)
         VALUES ($1, 'DOCUMENTO_VENTA', 0, $2, 'image/jpeg', 1000, $3, $4)`,
          [
            ventaId,
            `/uploads/test-${randomUUID()}.jpg`,
            randomUUID().replace(/-/g, "").repeat(2),
            vendedorId,
          ],
        );

        const ctxAdminB = ctx(adminB, idB, "ADMIN_EMPRESA");

        const listado = await listarVentas(
          ctxAdminB,
          { direccion: "compradas" },
          adaptador(c),
        );
        const fila = listado.items.find((i) => i.id === ventaId);
        expect(fila).toBeDefined();
        expect(fila?.montoFinalCentimos).toBeGreaterThan(0);

        const detalle = await obtenerVenta(ctxAdminB, ventaId, adaptador(c));
        expect(detalle.ok).toBe(true);
        if (!detalle.ok) return;
        expect(detalle.data.adjuntos.length).toBeGreaterThan(0);
        expect(detalle.data.adjuntos.every((a) => a.puedeVer === false)).toBe(
          true,
        );
      } finally {
        await c.query("ROLLBACK").catch(() => undefined);
        await c.end();
      }
    }, 60_000);

    it("el resumen corresponde al filtro completo y los cursores recorren cada orden sin repetir ventas", async () => {
      const c = await conexion();
      try {
        await c.query("BEGIN");
        const idA = await crearEmpresa(c, "20100080005");
        const idB = await crearEmpresa(c, "20100080006");
        const convenioId = await crearConvenio(c, idA, idB);
        const terminoId = await crearTermino(
          c,
          convenioId,
          idA,
          1500,
          "2000-01-01",
          null,
        );
        const sedeId = await crearSede(c, idA);
        const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
        const empleadoId = await crearEmpleadoActivo(c, idB, "80000003");

        for (let i = 0; i < 26; i++) {
          await crearVentaDirecta(c, {
            empresaVendedoraId: idA,
            empresaCompradoraId: idB,
            convenioId,
            terminoId,
            sedeId,
            vendedorId,
            empleadoId,
            montoBruto: 1000 + i,
            bps: 1500,
            fechaVenta: sumarDias(HOY, -i),
          });
        }

        const ctxVendedor = ctx(vendedorId, idA, "VENDEDOR");
        for (const orden of [
          "fecha_desc",
          "fecha_asc",
          "monto_desc",
          "monto_asc",
        ] as const) {
          const pagina1 = await listarVentas(
            ctxVendedor,
            { orden },
            adaptador(c),
          );
          expect(pagina1.items).toHaveLength(25);
          expect(pagina1.resumen.cantidad).toBe(26);
          expect(pagina1.total).toBe(26);
          expect(pagina1.cursor).not.toBeNull();

          const pagina2 = await listarVentas(
            ctxVendedor,
            { orden, cursor: pagina1.cursor ?? undefined },
            adaptador(c),
          );
          expect(pagina2.items).toHaveLength(1);
          expect(pagina2.cursor).toBeNull();
          // El resumen es del filtro completo, no de la página: igual en ambas.
          expect(pagina2.resumen.cantidad).toBe(26);
          expect(pagina2.total).toBeUndefined();
          expect(
            new Set(
              [...pagina1.items, ...pagina2.items].map((venta) => venta.id),
            ),
          ).toHaveLength(26);
        }
      } finally {
        await c.query("ROLLBACK").catch(() => undefined);
        await c.end();
      }
    }, 60_000);

    it("anular fuera de la ventana permitida devuelve SIN_PERMISO", async () => {
      const c = await conexion();
      try {
        await c.query("BEGIN");
        const idA = await crearEmpresa(c, "20100080007");
        const idB = await crearEmpresa(c, "20100080008");
        const convenioId = await crearConvenio(c, idA, idB);
        const terminoId = await crearTermino(
          c,
          convenioId,
          idA,
          1500,
          "2000-01-01",
          null,
        );
        const sedeId = await crearSede(c, idA);
        const vendedorId = await crearUsuario(c, "VENDEDOR", idA);
        const adminA = await crearUsuario(c, "ADMIN_EMPRESA", idA);
        const empleadoId = await crearEmpleadoActivo(c, idB, "80000004");

        const ventaId = await crearVentaDirecta(c, {
          empresaVendedoraId: idA,
          empresaCompradoraId: idB,
          convenioId,
          terminoId,
          sedeId,
          vendedorId,
          empleadoId,
          montoBruto: 10_000,
          bps: 1500,
          fechaVenta: HOY,
        });
        // La venta se registró "ayer" (hora Lima): fuera de la ventana del VENDEDOR.
        await c.query(
          `UPDATE ventas SET created_at = now() - interval '2 days' WHERE id = $1`,
          [ventaId],
        );

        const intentoVendedor = await anularVentaCore(
          adaptador(c),
          ctx(vendedorId, idA, "VENDEDOR"),
          { ventaId, motivo: "Motivo de prueba con suficiente longitud" },
        );
        expect(intentoVendedor.ok).toBe(false);
        if (!intentoVendedor.ok)
          expect(intentoVendedor.codigo).toBe("SIN_PERMISO");

        // El ADMIN_EMPRESA de la vendedora sí puede, sin límite de tiempo.
        const intentoAdmin = await anularVentaCore(
          adaptador(c),
          ctx(adminA, idA, "ADMIN_EMPRESA"),
          { ventaId, motivo: "Motivo de prueba con suficiente longitud" },
        );
        expect(intentoAdmin.ok).toBe(true);

        const relectura = await c.query(
          `SELECT estado, motivo_anulacion FROM ventas WHERE id = $1`,
          [ventaId],
        );
        expect(relectura.rows[0].estado).toBe("ANULADA");
      } finally {
        await c.query("ROLLBACK").catch(() => undefined);
        await c.end();
      }
    }, 60_000);
  },
);
