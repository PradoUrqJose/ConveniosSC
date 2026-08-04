import { sql, type SQL } from "drizzle-orm";

import { registrar } from "@/lib/audit/registrar";
import type { TransaccionAuditada } from "@/lib/audit/registrar";
import { obtenerFilas } from "@/lib/audit/registrar";
import { rateLimit } from "@/lib/rate-limit";

import { hashPassword, verificarPassword } from "./password";
import { crearSesion, generarTokenSesion, type RolUsuario } from "./sesion";

/**
 * Flujo de login de 02-LOGICA-NEGOCIO.md §6. El mensaje de error es siempre el
 * mismo y se cubren los timing attacks con un hash falso. Recibe la BD como
 * parámetro para poder probarse con cualquier driver.
 */

const VENTANA_LOGIN_MS = 15 * 60 * 1000;
const LIMITE_LOGIN_IP = 30;
const MAX_INTENTOS = 5;
/**
 * Duración del bloqueo tras `MAX_INTENTOS` fallos. Es deliberadamente más corta
 * que la ventana del rate limit por IP: el mensaje de error no revela el
 * bloqueo (02 §6), así que una espera larga es indistinguible de una
 * contraseña mal recordada. Un administrador puede desbloquear antes desde
 * `/usuarios`.
 */
const BLOQUEO_MS = 5 * 60 * 1000;

/** Mínimo común de Drizzle (neon-http y node-postgres) que usa el login. */
export type BaseDatos = {
  execute(query: SQL): Promise<unknown>;
  transaction<T>(callback: (tx: TransaccionAuditada) => Promise<T>): Promise<T>;
};

export type ResultadoLogin =
  | {
      ok: true;
      sesion: { token: string; rol: RolUsuario; debeCambiarPassword: boolean };
    }
  | { ok: false; codigo: "VALIDACION" | "LIMITE_EXCEDIDO" };

type FilaUsuario = Record<string, unknown>;

let hashFalsoPendiente: Promise<string> | null = null;
function obtenerHashFalso(): Promise<string> {
  hashFalsoPendiente ??= hashPassword("clave-falsa-para-igualar-tiempo");
  return hashFalsoPendiente;
}

export async function autenticar(
  db: BaseDatos,
  entrada: {
    username: string;
    password: string;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<ResultadoLogin> {
  const ip = entrada.ip ?? "sin-ip";
  const controlIp = await rateLimit(db, `login:ip:${ip}`, {
    limite: LIMITE_LOGIN_IP,
    ventanaMs: VENTANA_LOGIN_MS,
  });
  if (!controlIp.permitido) {
    return { ok: false, codigo: "LIMITE_EXCEDIDO" };
  }

  const filas = obtenerFilas(
    await db.execute(sql`
      SELECT u.id, u.password_hash, u.rol, u.empresa_id, u.activo,
             u.bloqueado_hasta, u.intentos_fallidos, u.debe_cambiar_password,
             e.activo AS empresa_activa
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      WHERE u.username = ${entrada.username}
    `),
  );
  const usuario = filas[0] as FilaUsuario | undefined;

  // Usuario inexistente: mismo trabajo de argon2 para no filtrar existencia.
  if (!usuario || usuario.password_hash === null) {
    await verificarPassword(await obtenerHashFalso(), entrada.password);
    return { ok: false, codigo: "VALIDACION" };
  }

  // Bloqueo temporal: error genérico, no revelar el bloqueo (02 §6 paso 4).
  const bloqueadoHasta = usuario.bloqueado_hasta;
  if (
    bloqueadoHasta !== null &&
    bloqueadoHasta !== undefined &&
    new Date(String(bloqueadoHasta)).getTime() > Date.now()
  ) {
    await verificarPassword(await obtenerHashFalso(), entrada.password);
    return { ok: false, codigo: "VALIDACION" };
  }

  // Empresa desactivada bloquea el login de todos sus usuarios (03 §2). Se
  // responde igual que un fallo genérico, sin contar intentos.
  const empresaActiva = usuario.empresa_activa;
  if (
    usuario.empresa_id !== null &&
    usuario.empresa_id !== undefined &&
    (empresaActiva === null ||
      empresaActiva === undefined ||
      empresaActiva === false)
  ) {
    await verificarPassword(await obtenerHashFalso(), entrada.password);
    return { ok: false, codigo: "VALIDACION" };
  }

  const coincide = await verificarPassword(
    String(usuario.password_hash),
    entrada.password,
  );

  // Usuario desactivado no puede iniciar sesión (01 §8). El hash ya se verificó,
  // así que el tiempo de respuesta no filtra nada.
  if (!coincide || usuario.activo === false) {
    if (usuario.activo !== false) {
      await registrarIntentoFallido(db, usuario, entrada);
    }
    return { ok: false, codigo: "VALIDACION" };
  }

  const id = String(usuario.id);
  const token = generarTokenSesion();

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE usuarios SET
        intentos_fallidos = 0,
        bloqueado_hasta = NULL,
        ultimo_acceso_at = now()
      WHERE id = ${id}
    `);
    await crearSesion(tx, {
      token,
      usuarioId: id,
      ip: entrada.ip,
      userAgent: entrada.userAgent,
    });
    await registrar(tx, {
      accion: "LOGIN_OK",
      entidad: "usuario",
      entidadId: id,
      actor: {
        usuarioId: id,
        empresaId: empresaIdDe(usuario),
        rol: String(usuario.rol) as RolUsuario,
      },
      ip: entrada.ip,
      userAgent: entrada.userAgent,
    });
  });

  return {
    ok: true,
    sesion: {
      token,
      rol: String(usuario.rol) as RolUsuario,
      debeCambiarPassword: usuario.debe_cambiar_password === true,
    },
  };
}

async function registrarIntentoFallido(
  db: BaseDatos,
  usuario: FilaUsuario,
  entrada: { ip: string | null; userAgent: string | null },
): Promise<void> {
  const id = String(usuario.id);
  const nuevos = Number(usuario.intentos_fallidos ?? 0) + 1;
  const bloquear = nuevos >= MAX_INTENTOS;

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE usuarios SET
        intentos_fallidos = ${bloquear ? 0 : nuevos},
        bloqueado_hasta = ${
          bloquear ? new Date(Date.now() + BLOQUEO_MS).toISOString() : null
        }
      WHERE id = ${id}
    `);
    await registrar(tx, {
      accion: "LOGIN_FALLIDO",
      entidad: "usuario",
      entidadId: id,
      actor: {
        usuarioId: id,
        empresaId: empresaIdDe(usuario),
        rol: String(usuario.rol) as RolUsuario,
      },
      ip: entrada.ip,
      userAgent: entrada.userAgent,
    });
  });
}

function empresaIdDe(usuario: FilaUsuario): string | null {
  const valor = usuario.empresa_id;
  return valor === null || valor === undefined ? null : String(valor);
}
