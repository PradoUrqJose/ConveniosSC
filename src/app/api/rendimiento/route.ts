import { NextResponse } from "next/server";

import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { esEventoRum } from "@/lib/rendimiento";

export async function POST(request: Request) {
  if (process.env.RUM_ENABLED !== "1") {
    return new NextResponse(null, { status: 204 });
  }

  let evento: unknown;
  try {
    evento = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  if (!esEventoRum(evento)) {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  }

  try {
    const sesion = await requireSession();
    // El rol llega del servidor, no se confía en el valor enviado por el navegador.
    console.info(
      JSON.stringify({ ...evento, rol: sesion.rol, tipo: "rendimiento-real" }),
    );
  } catch (error) {
    if (error instanceof ErrorAuth)
      return new NextResponse(null, { status: 401 });
    throw error;
  }
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
