import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { registrar } from "./registrar";
import { verificarCadena } from "./verificar";

/**
 * Aceptación de T04 (06-BACKLOG.md): la cadena de hash con inserciones
 * concurrentes. Requiere la BD migrada; se ejecuta solo con `RUN_DB_TESTS=1`.
 */
const URL = process.env.DATABASE_URL_UNPOOLED;
const ACTIVO = process.env.RUN_DB_TESTS === "1" && Boolean(URL);

describe.skipIf(!ACTIVO)("Auditoría T04 — cadena de hash en BD", () => {
  let pool: pg.Pool;
  let db: ReturnType<typeof drizzle>;
  let adminId: string;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL, max: 30 });
    db = drizzle(pool);
    await pool.query("TRUNCATE TABLE auditoria RESTART IDENTITY");
    const admin = await pool.query(
      "SELECT id FROM usuarios WHERE username = 'admin'",
    );
    adminId = admin.rows[0].id as string;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("100 inserciones concurrentes dejan ids consecutivos y cadena íntegra", async () => {
    const tareas = Array.from({ length: 100 }, (_, i) =>
      db.transaction(async (tx) => {
        await registrar(tx, {
          accion: "VENTA_CREADA",
          entidad: "venta",
          entidadId: `venta-${i}`,
          actor: { usuarioId: adminId, empresaId: null, rol: "SUPERADMIN" },
          datosDespues: i % 2 === 0 ? { monto_centimos: i } : null,
          requestId: `req-${i}`,
        });
      }),
    );
    await Promise.all(tareas);

    const idsRes = await pool.query("SELECT id FROM auditoria ORDER BY id");
    const ids = idsRes.rows.map((r) => r.id as number);
    expect(ids).toHaveLength(100);
    expect(new Set(ids).size).toBe(100);
    expect(Math.max(...ids) - Math.min(...ids)).toBe(99);

    const resultado = await verificarCadena({}, db);
    expect(resultado).toEqual({ verificadas: 100, rota: false });
  }, 90_000);

  it("redacta password_hash y tokens al escribir", async () => {
    await db.transaction(async (tx) => {
      await registrar(tx, {
        accion: "USUARIO_CREADO",
        entidad: "usuario",
        entidadId: "u-99",
        actor: { usuarioId: adminId, empresaId: null, rol: "SUPERADMIN" },
        datosDespues: {
          username: "jperez",
          password_hash: "secreto",
          token: "abc123",
          nombres: "Juan",
        },
      });
    });

    const { rows } = await pool.query(
      "SELECT datos_despues FROM auditoria ORDER BY id DESC LIMIT 1",
    );
    expect(rows[0].datos_despues).toEqual({
      username: "jperez",
      password_hash: "[REDACTADO]",
      token: "[REDACTADO]",
      nombres: "Juan",
    });

    const resultado = await verificarCadena({}, db);
    expect(resultado.rota).toBe(false);
  }, 30_000);
});
