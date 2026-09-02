import { NextRequest, after } from "next/server";

import { db, dbTx } from "@/db";
import { registrar } from "@/lib/audit/registrar";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { hoyLima } from "@/lib/fechas";
import { normalizarParametrosEmpleados } from "@/modules/empleados/filtros";
import {
  exportarEmpleados,
  type FilaEmpleado,
} from "@/modules/empleados/query";

const TEXTO_ESTADO: Record<FilaEmpleado["estado"], string> = {
  ACTIVO: "Activo",
  PENDIENTE_VERIFICACION: "Pendiente",
  RECHAZADO: "Rechazado",
  INACTIVO: "Inactivo",
};

const TEXTO_TAB: Record<string, string> = {
  todos: "Todos",
  pendientes: "Pendientes",
  activos: "Activos",
  inactivos: "Inactivos",
  rechazados: "Rechazados",
};

const TEXTO_ACTIVIDAD: Record<string, string> = {
  con_compras: "Con compras en los últimos 30 días",
  sin_compras: "Sin compras en los últimos 30 días",
};

const TEXTO_ORDEN: Record<string, string> = {
  nombre_asc: "Nombre A–Z",
  nombre_desc: "Nombre Z–A",
  monto_desc: "Mayor compra (30 días)",
  reciente: "Más recientes",
};

function celdaCsv(valor: string | number): string {
  return `"${String(valor).replaceAll('"', '""')}"`;
}

function filaCsv(valores: (string | number)[]): string {
  return valores.map(celdaCsv).join(",");
}

/**
 * `GET /api/empleados/exportar` (issue #41): CSV del padrón filtrado
 * completo (mismos filtros que /empleados, sin cursor/antes — esos son solo
 * navegación de página). La primera fila declara el alcance exacto para que
 * quien abre el archivo sepa qué universo representa, sin depender de que el
 * nombre del archivo se conserve.
 */
export async function GET(req: NextRequest): Promise<Response> {
  let sesion;
  try {
    sesion = await requireSession();
    requireRol(sesion, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  } catch (error) {
    if (error instanceof ErrorAuth) {
      const status = error.codigo === "NO_AUTENTICADO" ? 401 : 403;
      return new Response("No autorizado.", { status });
    }
    throw error;
  }

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { tab, estado, q, orden, actividad } =
    normalizarParametrosEmpleados(sp);

  const { filas, total, truncado } = await exportarEmpleados(sesion, {
    estado,
    q,
    orden,
    actividad,
  });

  const alcance = [
    `Tab: ${TEXTO_TAB[tab] ?? tab}`,
    q ? `Búsqueda: "${q}"` : null,
    actividad ? `Actividad: ${TEXTO_ACTIVIDAD[actividad]}` : null,
    `Orden: ${TEXTO_ORDEN[orden]}`,
    `Total: ${total} empleado${total === 1 ? "" : "s"}`,
    truncado ? `Truncado a los primeros ${filas.length} registros` : null,
  ]
    .filter((parte): parte is string => Boolean(parte))
    .join(" · ");

  const encabezados = [
    "Nombre",
    "Documento",
    "Teléfono",
    ...(sesion.rol === "SUPERADMIN" ? ["Empresa"] : []),
    "Compras (30 días)",
    "Monto (30 días)",
    "Estado",
    "Registrado",
  ];

  const lineas = [
    filaCsv([`Alcance de esta exportación: ${alcance}`]),
    "",
    filaCsv(encabezados),
    ...filas.map((empleado) =>
      filaCsv([
        `${empleado.nombres} ${empleado.apellidos}`,
        `${empleado.tipoDocumento === "DNI" ? "DNI" : "CE"} ${empleado.numeroDocumento}`,
        empleado.telefono ?? "",
        ...(sesion.rol === "SUPERADMIN" ? [empleado.empresaNombre] : []),
        empleado.comprasUltimos30d,
        (empleado.montoUltimos30d / 100).toFixed(2),
        TEXTO_ESTADO[empleado.estado],
        empleado.createdAt.slice(0, 10),
      ]),
    ),
  ];
  // BOM: Excel abre el UTF-8 sin él como Latin-1 y rompe tildes/ñ.
  const csv = "﻿" + lineas.join("\r\n") + "\r\n";

  // Auditoría de una exportación masiva de datos personales (accion
  // "EXPORTACION", reservada para esto). No es condición para servir el
  // archivo, así que corre después de responder (`after`) — mismo patrón que
  // `buscarPorDocumento` en `modules/empleados/query.ts`: va en una
  // transacción real (`dbTx`), no en la conexión HTTP, porque el advisory
  // lock que protege la cadena de hashes solo dura lo que dura la
  // transacción y sobre neon-http cada sentencia es la suya propia.
  const entradaAuditoria = {
    accion: "EXPORTACION" as const,
    entidad: "empleado",
    entidadId: `padron:${sesion.empresaId ?? "todas"}`,
    actor: {
      usuarioId: sesion.usuarioId,
      empresaId: sesion.empresaId,
      rol: sesion.rol,
    },
    datosDespues: {
      tab,
      q: q ?? null,
      orden,
      actividad: actividad ?? null,
      total,
    },
    ip: sesion.ip,
    userAgent: sesion.userAgent,
    requestId: sesion.requestId,
  };
  after(async () => {
    try {
      await dbTx().transaction((tx) => registrar(tx, entradaAuditoria));
    } catch (error) {
      console.error("[auditoria] EXPORTACION vía dbTx", error);
      try {
        await registrar(db, entradaAuditoria);
      } catch (error2) {
        console.error("[auditoria] EXPORTACION perdida", error2);
      }
    }
  });

  const fecha = hoyLima();
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="empleados_${tab}_${fecha}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
