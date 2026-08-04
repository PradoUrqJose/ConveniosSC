import { sql } from "drizzle-orm";

import {
  obtenerFilas,
  registrar,
  type TransaccionAuditada,
} from "@/lib/audit/registrar";
import type { SessionContext } from "@/lib/auth/guardas";
import { sumarDias } from "@/lib/fechas";

export type EstadoConvenio =
  "BORRADOR" | "VIGENTE" | "SUSPENDIDO" | "TERMINADO";

export type DatosCrearConvenio = {
  empresaXId: string;
  empresaYId: string;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  notas?: string | null;
  descuentoXotorgaBps: number;
  descuentoYotorgaBps: number;
  activarInmediatamente: boolean;
};

export type DatosActualizarConvenio = {
  convenioId: string;
  estado?: EstadoConvenio;
  vigenciaHasta?: string | null; // undefined = no cambiar
  notas?: string; // undefined = no cambiar; "" → null
};

export type DatosCambiarTermino = {
  convenioId: string;
  empresaOtorganteId: string;
  nuevoDescuentoBps: number;
  vigenteDesde: string;
};

export type ResultadoConvenio =
  | { ok: true; terminoId?: string }
  | {
      ok: false;
      codigo: "NO_ENCONTRADO" | "REGLA_NEGOCIO";
      mensaje: string;
    };

/**
 * Crea el convenio y sus dos términos direccionales en la misma transacción
 * (01 §4-5, 03 §4). Orden canónico: `empresa_a_id < empresa_b_id`; los
 * descuentos viajan con su empresa. Duplicado → `23505` (lo captura el wrapper).
 */
export async function crearConvenioCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosCrearConvenio,
): Promise<string> {
  const [aId, bId] =
    datos.empresaXId < datos.empresaYId
      ? [datos.empresaXId, datos.empresaYId]
      : [datos.empresaYId, datos.empresaXId];
  const descuentoAotorgaBps =
    aId === datos.empresaXId
      ? datos.descuentoXotorgaBps
      : datos.descuentoYotorgaBps;
  const descuentoBotorgaBps =
    aId === datos.empresaXId
      ? datos.descuentoYotorgaBps
      : datos.descuentoXotorgaBps;

  const estado = datos.activarInmediatamente ? "VIGENTE" : "BORRADOR";

  const filas = obtenerFilas(
    await tx.execute(sql`
      INSERT INTO convenios
        (empresa_a_id, empresa_b_id, estado, vigencia_desde, vigencia_hasta,
         notas, creado_por_usuario_id)
      VALUES (${aId}, ${bId}, ${estado}, ${datos.vigenciaDesde},
              ${datos.vigenciaHasta}, ${datos.notas ?? null}, ${ctx.usuarioId})
      RETURNING id
    `),
  );
  const convenioId = String(filas[0]?.id);

  const terminoA = String(
    obtenerFilas(
      await tx.execute(sql`
        INSERT INTO convenio_terminos
          (convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde,
           creado_por_usuario_id)
        VALUES (${convenioId}, ${aId}, ${descuentoAotorgaBps},
                ${datos.vigenciaDesde}, ${ctx.usuarioId})
        RETURNING id
      `),
    )[0]?.id,
  );
  const terminoB = String(
    obtenerFilas(
      await tx.execute(sql`
        INSERT INTO convenio_terminos
          (convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde,
           creado_por_usuario_id)
        VALUES (${convenioId}, ${bId}, ${descuentoBotorgaBps},
                ${datos.vigenciaDesde}, ${ctx.usuarioId})
        RETURNING id
      `),
    )[0]?.id,
  );

  await registrar(tx, {
    accion: "CONVENIO_CREADO",
    entidad: "convenio",
    entidadId: convenioId,
    actor: ctx,
    datosDespues: {
      empresaAId: aId,
      empresaBId: bId,
      estado,
      vigenciaDesde: datos.vigenciaDesde,
      vigenciaHasta: datos.vigenciaHasta,
      notas: datos.notas ?? null,
      descuentoAotorgaBps,
      descuentoBotorgaBps,
    },
  });
  await registrar(tx, {
    accion: "TERMINO_CREADO",
    entidad: "convenio_termino",
    entidadId: terminoA,
    actor: ctx,
    datosDespues: {
      convenioId,
      empresaOtorganteId: aId,
      descuentoBps: descuentoAotorgaBps,
      vigenciaDesde: datos.vigenciaDesde,
    },
  });
  await registrar(tx, {
    accion: "TERMINO_CREADO",
    entidad: "convenio_termino",
    entidadId: terminoB,
    actor: ctx,
    datosDespues: {
      convenioId,
      empresaOtorganteId: bId,
      descuentoBps: descuentoBotorgaBps,
      vigenciaDesde: datos.vigenciaDesde,
    },
  });

  return convenioId;
}

/**
 * Actualiza estado, vencimiento o notas. No permite cambiar las empresas.
 * Terminar un convenio no afecta las ventas ya registradas.
 */
export async function actualizarConvenioCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosActualizarConvenio,
): Promise<{ ok: true } | { ok: false; codigo: "NO_ENCONTRADO" }> {
  const actual = obtenerFilas(
    await tx.execute(
      sql`SELECT * FROM convenios WHERE id = ${datos.convenioId} FOR UPDATE`,
    ),
  )[0];
  if (!actual) {
    return { ok: false, codigo: "NO_ENCONTRADO" };
  }

  const estado = datos.estado ?? String(actual.estado);
  const vigenciaHasta =
    datos.vigenciaHasta === undefined
      ? (actual.vigencia_hasta as string | null)
      : datos.vigenciaHasta;
  const notas =
    datos.notas === undefined
      ? ((actual.notas as string | null) ?? null)
      : datos.notas === ""
        ? null
        : datos.notas;

  await tx.execute(sql`
    UPDATE convenios SET
      estado = ${estado},
      vigencia_hasta = ${vigenciaHasta},
      notas = ${notas}
    WHERE id = ${datos.convenioId}
  `);

  await registrar(tx, {
    accion: "CONVENIO_ACTUALIZADO",
    entidad: "convenio",
    entidadId: datos.convenioId,
    actor: ctx,
    datosAntes: {
      estado: String(actual.estado),
      vigenciaHasta: actual.vigencia_hasta ?? null,
      notas: actual.notas ?? null,
    },
    datosDespues: { estado, vigenciaHasta, notas },
  });

  return { ok: true };
}

/**
 * Cambiar un descuento nunca es un `UPDATE` (01 §5): cierra el término vigente
 * con `vigencia_hasta = vigenteDesde − 1` e inserta el nuevo desde `vigenteDesde`.
 * El constraint `EXCLUDE` es la garantía final de que no queden solapes.
 */
export async function cambiarTerminoCore(
  tx: TransaccionAuditada,
  ctx: SessionContext,
  datos: DatosCambiarTermino,
): Promise<ResultadoConvenio> {
  const convenio = obtenerFilas(
    await tx.execute(
      sql`SELECT * FROM convenios WHERE id = ${datos.convenioId} FOR UPDATE`,
    ),
  )[0];
  if (!convenio) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      mensaje: "El convenio no existe.",
    };
  }
  const esOtorgante =
    String(convenio.empresa_a_id) === datos.empresaOtorganteId ||
    String(convenio.empresa_b_id) === datos.empresaOtorganteId;
  if (!esOtorgante) {
    return {
      ok: false,
      codigo: "REGLA_NEGOCIO",
      mensaje: "La empresa otorgante no pertenece al convenio.",
    };
  }

  const vigente = obtenerFilas(
    await tx.execute(sql`
      SELECT * FROM convenio_terminos
      WHERE convenio_id = ${datos.convenioId}
        AND empresa_otorgante_id = ${datos.empresaOtorganteId}
        AND vigencia_desde <= ${datos.vigenteDesde}
        AND (vigencia_hasta IS NULL OR vigencia_hasta >= ${datos.vigenteDesde})
      FOR UPDATE
    `),
  )[0];

  if (vigente) {
    const cierre = sumarDias(datos.vigenteDesde, -1);
    await tx.execute(sql`
      UPDATE convenio_terminos SET vigencia_hasta = ${cierre}
      WHERE id = ${String(vigente.id)}
    `);
    await registrar(tx, {
      accion: "TERMINO_CERRADO",
      entidad: "convenio_termino",
      entidadId: String(vigente.id),
      actor: ctx,
      datosAntes: {
        descuentoBps: Number(vigente.descuento_bps),
        vigenciaDesde: String(vigente.vigencia_desde),
        vigenciaHasta: vigente.vigencia_hasta ?? null,
      },
      datosDespues: {
        descuentoBps: Number(vigente.descuento_bps),
        vigenciaDesde: String(vigente.vigencia_desde),
        vigenciaHasta: cierre,
      },
    });
  }

  const nuevo = obtenerFilas(
    await tx.execute(sql`
      INSERT INTO convenio_terminos
        (convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde,
         creado_por_usuario_id)
      VALUES (${datos.convenioId}, ${datos.empresaOtorganteId},
              ${datos.nuevoDescuentoBps}, ${datos.vigenteDesde}, ${ctx.usuarioId})
      RETURNING id
    `),
  )[0];
  const terminoId = String(nuevo?.id);

  await registrar(tx, {
    accion: "TERMINO_CREADO",
    entidad: "convenio_termino",
    entidadId: terminoId,
    actor: ctx,
    datosDespues: {
      convenioId: datos.convenioId,
      empresaOtorganteId: datos.empresaOtorganteId,
      descuentoBps: datos.nuevoDescuentoBps,
      vigenciaDesde: datos.vigenteDesde,
    },
  });

  return { ok: true, terminoId };
}
