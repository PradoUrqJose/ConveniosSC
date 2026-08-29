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
    // No depende del seed (`npm run db:seed`, que el workflow de CI no
    // corre): se arma su propio actor, igual que el resto de la suite de
    // aceptación. `actor_usuario_id` en `auditoria` es FK, así que hace
    // falta un usuario real.
    const usuario = await pool.query(
      `INSERT INTO usuarios
         (id, empresa_id, username, password_hash, debe_cambiar_password,
          nombres, apellidos, rol)
       VALUES (gen_random_uuid(), NULL, $1, 'x', false, 'Test', 'Auditoria', 'SUPERADMIN')
       RETURNING id`,
      [`test.auditoria.${Date.now()}`],
    );
    adminId = usuario.rows[0].id as string;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("100 inserciones concurrentes dejan ids consecutivos y cadenas íntegras", async () => {
    const tareas = Array.from({ length: 100 }, (_, i) =>
      db.transaction(async (tx) => {
        await registrar(tx, {
          accion: "VENTA_CREADA",
          entidad: "venta",
          // Diez recursos repetidos prueban que también se preserva el orden
          // dentro de cada cadena, aunque las transacciones sean concurrentes.
          entidadId: `venta-${i % 10}`,
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

  it("no bloquea otra cadena mientras la primera transacción sigue abierta", async () => {
    let liberarPrimera!: () => void;
    const primeraPuedeCerrar = new Promise<void>((resolve) => {
      liberarPrimera = resolve;
    });
    let primeraRegistro!: () => void;
    const primeraRegistroHecho = new Promise<void>((resolve) => {
      primeraRegistro = resolve;
    });

    const primera = db.transaction(async (tx) => {
      await registrar(tx, {
        accion: "VENTA_CREADA",
        entidad: "venta",
        entidadId: "venta-bloqueada",
        actor: { usuarioId: adminId, empresaId: null, rol: "SUPERADMIN" },
      });
      primeraRegistro();
      await primeraPuedeCerrar;
    });
    await primeraRegistroHecho;

    const segunda = db.transaction(async (tx) => {
      await registrar(tx, {
        accion: "VENTA_CREADA",
        entidad: "venta",
        entidadId: "venta-independiente",
        actor: { usuarioId: adminId, empresaId: null, rol: "SUPERADMIN" },
      });
      return "registrada";
    });
    const resultado = await Promise.race([
      segunda,
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 5_000),
      ),
    ]);

    liberarPrimera();
    await primera;
    await segunda;
    expect(resultado).toBe("registrada");
  }, 30_000);

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
