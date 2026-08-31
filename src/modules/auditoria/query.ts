import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  obtenerFilas,
  type AccionAuditoria,
  type TransaccionAuditada,
} from "@/lib/audit/registrar";
import { requireRol, type SessionContext } from "@/lib/auth/guardas";
import type { Pagina } from "@/lib/tipos";
export { diffAuditoria } from "@/lib/audit/diff";

export type FiltroAuditoria = {
  desde?: string;
  hasta?: string;
  accion?: AccionAuditoria;
  entidad?: string;
  entidadId?: string;
  actorId?: string;
  cursor?: string;
};
export type FilaAuditoria = {
  id: number;
  ts: string;
  actor: {
    id: string;
    username: string;
    nombres: string;
    apellidos: string;
    rol: string;
  } | null;
  accion: string;
  entidad: string;
  entidadId: string;
  datosAntes: unknown;
  datosDespues: unknown;
  ip: string | null;
};
const POR_PAGINA = 50;

/** El alcance se impone en SQL: ADMIN_EMPRESA nunca puede enumerar otra empresa. */
export async function listarAuditoria(
  ctx: SessionContext,
  entrada: FiltroAuditoria,
  ejecutor: TransaccionAuditada = db,
): Promise<Pagina<FilaAuditoria>> {
  requireRol(ctx, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  const filtros: SQL[] = [];
  // El alcance no depende de parámetros de URL ni de la UI: la empresa del
  // actor se incorpora siempre a la consulta para los administradores.
  if (ctx.rol === "ADMIN_EMPRESA") {
    filtros.push(sql`a.actor_empresa_id = ${ctx.empresaId}`);
  }
  if (entrada.desde) filtros.push(sql`a.ts >= ${entrada.desde}::date`);
  if (entrada.hasta)
    filtros.push(sql`a.ts < (${entrada.hasta}::date + interval '1 day')`);
  if (entrada.accion) filtros.push(sql`a.accion = ${entrada.accion}`);
  if (entrada.entidad) filtros.push(sql`a.entidad = ${entrada.entidad}`);
  if (entrada.entidadId) filtros.push(sql`a.entidad_id = ${entrada.entidadId}`);
  if (entrada.actorId)
    filtros.push(sql`a.actor_usuario_id = ${entrada.actorId}`);
  const cursor = decodificarCursor(entrada.cursor);
  if (cursor)
    filtros.push(sql`(a.ts, a.id) < (${cursor.ts}::timestamptz, ${cursor.id})`);
  const where = filtros.length
    ? sql`WHERE ${sql.join(filtros, sql` AND `)}`
    : sql``;
  const rows = obtenerFilas(
    await ejecutor.execute(
      sql`SELECT a.id,a.ts,a.accion,a.entidad,a.entidad_id,a.datos_antes,a.datos_despues,a.ip,u.id actor_id,u.username,u.nombres,u.apellidos,u.rol FROM auditoria a LEFT JOIN usuarios u ON u.id=a.actor_usuario_id ${where} ORDER BY a.ts DESC, a.id DESC LIMIT ${POR_PAGINA + 1}`,
    ),
  );
  const hasMore = rows.length > POR_PAGINA;
  const items = rows.slice(0, POR_PAGINA).map((f) => ({
    id: Number(f.id),
    ts: String(f.ts),
    accion: String(f.accion),
    entidad: String(f.entidad),
    entidadId: String(f.entidad_id),
    datosAntes: f.datos_antes,
    datosDespues: f.datos_despues,
    ip: f.ip ? String(f.ip) : null,
    actor: f.actor_id
      ? {
          id: String(f.actor_id),
          username: String(f.username),
          nombres: String(f.nombres),
          apellidos: String(f.apellidos),
          rol: String(f.rol),
        }
      : null,
  }));
  const ultimo = rows[POR_PAGINA - 1];
  return {
    items,
    cursor: hasMore && ultimo ? codificarCursor(ultimo) : null,
  };
}

function decodificarCursor(
  cursor: string | undefined,
): { ts: string; id: number } | null {
  if (!cursor) return null;
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof raw.ts === "string" &&
      raw.ts &&
      typeof raw.id === "number" &&
      Number.isSafeInteger(raw.id) &&
      raw.id > 0
    ) {
      return { ts: raw.ts, id: raw.id };
    }
  } catch {
    // Cursor inválido: se ignora y se devuelve la primera página.
  }
  return null;
}

function codificarCursor(fila: Record<string, unknown>): string {
  const ts = fila.ts instanceof Date ? fila.ts.toISOString() : String(fila.ts);
  return Buffer.from(
    JSON.stringify({ ts, id: Number(fila.id) }),
    "utf8",
  ).toString("base64url");
}
