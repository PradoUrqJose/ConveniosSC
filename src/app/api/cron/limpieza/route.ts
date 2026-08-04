import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { obtenerFilas } from "@/lib/audit/registrar";

/**
 * Limpieza periódica de las dos tablas que crecen sin límite y no tienen valor
 * histórico: `sesiones` caducadas o revocadas y ventanas de `rate_limits` ya
 * cerradas. `auditoria` **no** se toca nunca: es inmutable por diseño.
 *
 * La invoca Vercel Cron (ver `vercel.json`). Vercel firma la petición con
 * `CRON_SECRET`; sin ese encabezado la ruta responde 401, así que no es un
 * endpoint abierto.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Las sesiones se conservan 7 días tras caducar o revocarse: sirven para
  // investigar un incidente reciente y después dejan de aportar.
  const sesiones = obtenerFilas(
    await db.execute(sql`
      DELETE FROM sesiones
      WHERE (expires_at < now() - interval '7 days')
         OR (revocada_at IS NOT NULL AND revocada_at < now() - interval '7 days')
      RETURNING 1
    `),
  ).length;

  // Una ventana de rate limit de hace más de un día ya no puede estar activa.
  const limites = obtenerFilas(
    await db.execute(sql`
      DELETE FROM rate_limits
      WHERE ventana_inicio < now() - interval '1 day'
      RETURNING 1
    `),
  ).length;

  return NextResponse.json({ sesiones, limites });
}
