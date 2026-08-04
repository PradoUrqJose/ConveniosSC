import { config } from "dotenv";
config({ path: ".env.local" });
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import pg from "pg";
import { describe, expect, it } from "vitest";

import {
  actualizarUsuarioCore,
  crearUsuarioCore,
  desbloquearUsuarioCore,
  resetearPasswordCore,
} from "@/modules/usuarios/acciones";
import { autenticar } from "@/lib/auth/login";
import { hashPassword, verificarPassword } from "@/lib/auth/password";
import type { RolUsuario } from "@/lib/auth/sesion";
import type { SessionContext } from "@/lib/auth/guardas";
import type { TransaccionAuditada } from "@/lib/audit/registrar";

/**
 * Aceptación de T10 (06-BACKLOG.md): un `ADMIN_EMPRESA` no puede crear un
 * `SUPERADMIN` ni un usuario en otra empresa; desactivar un usuario invalida
 * sus sesiones de inmediato; la contraseña temporal nunca aparece en la BD ni
 * en la auditoría. Solo con `RUN_DB_TESTS=1`; cada caso corre en una
 * transacción que se revierte.
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

/**
 * `autenticar` espera un `BaseDatos` con `transaction`. Dentro del test ya
 * estamos en un `BEGIN` que se revierte al final, así que la «transacción»
 * anidada reutiliza el mismo cliente y no abre otra.
 */
function adaptadorTx(c: pg.Client) {
  const ejecutor = adaptador(c);
  return {
    execute: ejecutor.execute,
    async transaction<T>(cb: (tx: TransaccionAuditada) => Promise<T>) {
      return cb(ejecutor);
    },
  };
}

function ctxSesion(parcial: Partial<SessionContext>): SessionContext {
  return {
    usuarioId: "00000000-0000-0000-0000-000000000001",
    empresaId: null,
    rol: "SUPERADMIN",
    requestId: "test-usuarios",
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
  rol: RolUsuario,
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

describe.skipIf(!ACTIVO)("Aceptación T10 — usuarios", () => {
  it("ADMIN_EMPRESA crea solo en su empresa y no puede crear SUPERADMIN", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100088100");
      const idB = await crearEmpresa(c, "20100088200");
      const adminA = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      const ctx = ctxSesion({
        usuarioId: adminA,
        rol: "ADMIN_EMPRESA",
        empresaId: idA,
      });

      // Empresa ajena: se ignora el empresaId y cae en la empresa del actor.
      const res = await crearUsuarioCore(adaptador(c), ctx, {
        empresaId: idB,
        username: `vend${Math.random().toString(36).slice(2, 6)}`,
        nombres: "Nuevo",
        apellidos: "Vendedor",
        rol: "VENDEDOR",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        const fila = await c.query(
          `SELECT empresa_id FROM usuarios WHERE id = $1`,
          [res.usuarioId],
        );
        expect(fila.rows[0].empresa_id).toBe(idA);
      }

      // Intentar crear un SUPERADMIN: rechazado.
      const prohibido = await crearUsuarioCore(adaptador(c), ctx, {
        empresaId: null,
        username: `admin${Math.random().toString(36).slice(2, 6)}`,
        nombres: "Otro",
        apellidos: "Admin",
        rol: "SUPERADMIN",
      });
      expect(prohibido.ok).toBe(false);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("desactivar revoca las sesiones del usuario en la misma transacción", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100088300");
      const adminId = await crearUsuario(c, "SUPERADMIN", null);
      const victimaId = await crearUsuario(c, "VENDEDOR", idA);

      await c.query(
        `INSERT INTO sesiones (token_hash, usuario_id, expires_at)
         VALUES ($1, $2, now() + interval '1 day')`,
        ["a".repeat(64), victimaId],
      );

      const res = await actualizarUsuarioCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminId }),
        { usuarioId: victimaId, activo: false },
      );
      expect(res.ok).toBe(true);

      const sesiones = await c.query(
        `SELECT count(*)::int AS n FROM sesiones
         WHERE usuario_id = $1 AND revocada_at IS NULL`,
        [victimaId],
      );
      expect(sesiones.rows[0].n).toBe(0);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("la contraseña temporal no queda en claro en la BD ni en la auditoría", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const adminId = await crearUsuario(c, "SUPERADMIN", null);

      const res = await crearUsuarioCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminId }),
        {
          empresaId: null,
          username: `sa${Math.random().toString(36).slice(2, 6)}`,
          nombres: "Temporal",
          apellidos: "Admin",
          rol: "SUPERADMIN",
        },
      );
      expect(res.ok).toBe(true);
      if (!res.ok) {
        return;
      }
      const passwordTemporal = res.passwordTemporal!;

      const fila = await c.query(
        `SELECT password_hash, debe_cambiar_password FROM usuarios WHERE id = $1`,
        [res.usuarioId],
      );
      expect(fila.rows[0].debe_cambiar_password).toBe(true);
      expect(fila.rows[0].password_hash).not.toBe(passwordTemporal);
      // El hash guardado verifica con la temporal (solo recuperable con argon2).
      await expect(
        verificarPassword(fila.rows[0].password_hash, passwordTemporal),
      ).resolves.toBe(true);

      const auditoria = await c.query(
        `SELECT datos_despues FROM auditoria
         WHERE entidad = 'usuario' AND entidad_id = $1`,
        [res.usuarioId],
      );
      for (const filaAud of auditoria.rows) {
        expect(String(filaAud.datos_despues ?? "")).not.toContain(
          passwordTemporal,
        );
      }
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("5 intentos fallidos bloquean, y restablecer la contraseña levanta el bloqueo", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const empresaId = await crearEmpresa(c, "20100088700");
      const adminId = await crearUsuario(c, "SUPERADMIN", null);
      const victimaId = await crearUsuario(c, "VENDEDOR", empresaId);

      const username = `bloq${Math.random().toString(36).slice(2, 8)}`;
      await c.query(
        `UPDATE usuarios SET username = $1, password_hash = $2 WHERE id = $3`,
        [username, await hashPassword("ClaveBuena123"), victimaId],
      );

      const db = adaptadorTx(c);
      for (let i = 0; i < 5; i++) {
        const res = await autenticar(db, {
          username,
          password: "ClaveMala999",
          ip: `10.0.0.${i}`, // IPs distintas: aislamos el bloqueo del rate limit
          userAgent: null,
        });
        expect(res.ok).toBe(false);
      }

      const bloqueado = await c.query(
        `SELECT bloqueado_hasta FROM usuarios WHERE id = $1`,
        [victimaId],
      );
      expect(bloqueado.rows[0].bloqueado_hasta).not.toBeNull();

      // Con la contraseña correcta sigue sin entrar: está bloqueado.
      const durante = await autenticar(db, {
        username,
        password: "ClaveBuena123",
        ip: "10.0.0.99",
        userAgent: null,
      });
      expect(durante.ok).toBe(false);

      // Restablecer la contraseña debe levantar el bloqueo, no solo cambiarla.
      const reset = await resetearPasswordCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminId }),
        victimaId,
      );
      expect(reset.ok).toBe(true);

      const tras = await c.query(
        `SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE id = $1`,
        [victimaId],
      );
      expect(tras.rows[0].bloqueado_hasta).toBeNull();
      expect(tras.rows[0].intentos_fallidos).toBe(0);

      // Y la temporal entra de inmediato, sin esperar a que expire el bloqueo.
      const despues = await autenticar(db, {
        username,
        password: reset.ok ? reset.passwordTemporal! : "",
        ip: "10.0.0.100",
        userAgent: null,
      });
      expect(despues.ok).toBe(true);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
    // El caso encadena 7 operaciones argon2id (19 MiB cada una), muy por
    // encima de los 5 s por defecto de vitest.
  }, 30_000);

  it("desbloquearUsuario levanta el bloqueo sin tocar la contraseña", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const empresaId = await crearEmpresa(c, "20100088800");
      const adminId = await crearUsuario(c, "SUPERADMIN", null);
      const victimaId = await crearUsuario(c, "VENDEDOR", empresaId);

      const username = `desb${Math.random().toString(36).slice(2, 8)}`;
      const hash = await hashPassword("ClaveBuena123");
      await c.query(
        `UPDATE usuarios SET username = $1, password_hash = $2,
           intentos_fallidos = 5, bloqueado_hasta = now() + interval '5 minutes'
         WHERE id = $3`,
        [username, hash, victimaId],
      );

      const res = await desbloquearUsuarioCore(
        adaptador(c),
        ctxSesion({ usuarioId: adminId }),
        victimaId,
      );
      expect(res.ok).toBe(true);

      const fila = await c.query(
        `SELECT intentos_fallidos, bloqueado_hasta, password_hash
         FROM usuarios WHERE id = $1`,
        [victimaId],
      );
      expect(fila.rows[0].bloqueado_hasta).toBeNull();
      expect(fila.rows[0].intentos_fallidos).toBe(0);
      // La contraseña no se toca: el usuario sigue con la suya.
      expect(fila.rows[0].password_hash).toBe(hash);

      const login = await autenticar(adaptadorTx(c), {
        username,
        password: "ClaveBuena123",
        ip: "10.0.1.1",
        userAgent: null,
      });
      expect(login.ok).toBe(true);
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });

  it("un ADMIN_EMPRESA no puede desbloquear a un usuario de otra empresa", async () => {
    const c = await conexion();
    try {
      await c.query("BEGIN");
      const idA = await crearEmpresa(c, "20100088900");
      const idB = await crearEmpresa(c, "20100089000");
      const adminA = await crearUsuario(c, "ADMIN_EMPRESA", idA);
      const ajenoB = await crearUsuario(c, "VENDEDOR", idB);

      await c.query(
        `UPDATE usuarios SET intentos_fallidos = 5,
           bloqueado_hasta = now() + interval '5 minutes' WHERE id = $1`,
        [ajenoB],
      );

      await expect(
        desbloquearUsuarioCore(
          adaptador(c),
          ctxSesion({
            usuarioId: adminA,
            rol: "ADMIN_EMPRESA",
            empresaId: idA,
          }),
          ajenoB,
        ),
      ).rejects.toThrow();

      const fila = await c.query(
        `SELECT bloqueado_hasta FROM usuarios WHERE id = $1`,
        [ajenoB],
      );
      expect(fila.rows[0].bloqueado_hasta).not.toBeNull();
    } finally {
      await c.query("ROLLBACK").catch(() => undefined);
      await c.end();
    }
  });
});
