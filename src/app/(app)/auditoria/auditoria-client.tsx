"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, History, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { diffAuditoria } from "@/lib/audit/diff";
import type {
  DetalleAuditoria,
  FilaAuditoria,
  FiltroAuditoria,
} from "@/modules/auditoria/query";
import type { Pagina } from "@/lib/tipos";
import {
  cargarAuditoria,
  cargarDetalleAuditoria,
  verificarIntegridad,
} from "./actions";
import { CabeceraPagina, EstadoVacio } from "@/components/shell/pagina-ui";

type EstadoVerificacion =
  | { estado: "idle" }
  | { estado: "pending"; verificadas: number }
  | { estado: "success"; verificadas: number }
  | { estado: "broken"; enId: number; verificadas: number }
  | { estado: "error" };

export function AuditoriaClient({
  pagina,
  filtros,
  puedeVerificar,
  alcanceGlobal,
}: {
  pagina: Pagina<FilaAuditoria>;
  filtros: FiltroAuditoria;
  puedeVerificar: boolean;
  alcanceGlobal: boolean;
}) {
  const [eventos, setEventos] = useState(pagina.items);
  const [cursor, setCursor] = useState(pagina.cursor);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [verificacion, setVerificacion] = useState<EstadoVerificacion>({
    estado: "idle",
  });

  async function verificar() {
    setVerificacion({ estado: "pending", verificadas: 0 });
    let desdeId: number | undefined;
    let verificadas = 0;
    try {
      do {
        const resultado = await verificarIntegridad(desdeId);
        verificadas += resultado.verificadas;
        if (resultado.rota) {
          setVerificacion({
            estado: "broken",
            enId: resultado.enId,
            verificadas,
          });
          return;
        }
        desdeId = resultado.ultimoId ?? undefined;
        setVerificacion({ estado: "pending", verificadas });
        if (resultado.completa) {
          setVerificacion({ estado: "success", verificadas });
          return;
        }
      } while (desdeId !== undefined);
    } catch {
      setVerificacion({ estado: "error" });
    }
  }

  async function cargarMas() {
    if (!cursor || cargandoMas) return;
    setCargandoMas(true);
    try {
      const siguiente = await cargarAuditoria(filtros, cursor);
      setEventos((actuales) => [...actuales, ...siguiente.items]);
      setCursor(siguiente.cursor);
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Trazabilidad"
        titulo="Auditoría"
        descripcion={
          alcanceGlobal
            ? "Revisa la actividad crítica del sistema y verifica la integridad de la cadena de registros."
            : "Revisa la actividad crítica registrada por tu empresa."
        }
        icono={<History className="size-5" />}
        acciones={
          puedeVerificar ? (
            <Button
              variant="outline"
              disabled={verificacion.estado === "pending"}
              onClick={verificar}
            >
              <SearchCheck className="size-4" />
              {verificacion.estado === "pending"
                ? "Verificando…"
                : "Verificar integridad"}
            </Button>
          ) : null
        }
      />
      <ResultadoVerificacion estado={verificacion} />
      <form className="control-bar grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto]">
        <input
          type="date"
          name="desde"
          defaultValue={filtros.desde}
          aria-label="Fecha inicial"
          className="border-input bg-background h-11 rounded-xl border px-3 text-base sm:text-sm"
        />
        <input
          type="date"
          name="hasta"
          defaultValue={filtros.hasta}
          aria-label="Fecha final"
          className="border-input bg-background h-11 rounded-xl border px-3 text-base sm:text-sm"
        />
        <input
          name="accion"
          defaultValue={filtros.accion}
          placeholder="Acción"
          className="border-input bg-background h-11 rounded-xl border px-3 text-base sm:text-sm"
        />
        <input
          name="entidad"
          defaultValue={filtros.entidad}
          placeholder="Entidad"
          className="border-input bg-background h-11 rounded-xl border px-3 text-base sm:text-sm"
        />
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      {eventos.length ? (
        <ol className="surface-panel divide-y px-5 sm:px-6">
          {eventos.map((fila) => (
            <Evento key={fila.id} fila={fila} />
          ))}
        </ol>
      ) : (
        <EstadoVacio
          icono={<History className="size-6" />}
          titulo="No hay registros"
          descripcion="No encontramos actividad para los filtros seleccionados."
        />
      )}
      {cursor && (
        <Button
          variant="outline"
          className="self-start"
          onClick={cargarMas}
          disabled={cargandoMas}
        >
          {cargandoMas ? "Cargando…" : "Cargar más"}
        </Button>
      )}
    </section>
  );
}

function ResultadoVerificacion({ estado }: { estado: EstadoVerificacion }) {
  if (estado.estado === "idle") return null;
  const esError = estado.estado === "broken" || estado.estado === "error";
  const mensaje =
    estado.estado === "pending"
      ? `Verificando integridad… ${estado.verificadas} registros comprobados.`
      : estado.estado === "success"
        ? `Cadenas íntegras: ${estado.verificadas} registros verificados.`
        : estado.estado === "broken"
          ? `Cadena rota en el registro ${estado.enId} (${estado.verificadas} registros comprobados).`
          : "No se pudo verificar la integridad. Inténtalo nuevamente.";
  return (
    <div
      role="status"
      className={`${esError ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-success/20 bg-success/8 text-success"} flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold`}
    >
      {esError ? (
        <AlertCircle className="size-4" />
      ) : (
        <CheckCircle2 className="size-4" />
      )}
      {mensaje}
    </div>
  );
}

function Evento({ fila }: { fila: FilaAuditoria }) {
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<DetalleAuditoria | null>();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const cambios = detalle
    ? diffAuditoria(detalle.datosAntes, detalle.datosDespues)
    : [];

  async function alternar() {
    if (abierto) return setAbierto(false);
    setAbierto(true);
    if (detalle !== undefined || cargando) return;
    setCargando(true);
    setError(false);
    try {
      const respuesta = await cargarDetalleAuditoria(fila.id);
      setDetalle(respuesta);
      if (!respuesta) setError(true);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  return (
    <li className="relative py-5 pl-5">
      <span className="bg-primary ring-card absolute top-6 left-0 size-2.5 rounded-full ring-4" />
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {new Date(fila.ts).toLocaleString("es-PE")}
      </p>
      <p className="mt-1 text-sm">
        <strong>
          {fila.actor
            ? `${fila.actor.nombres} ${fila.actor.apellidos}`
            : "Sistema"}
        </strong>{" "}
        · {fila.accion}
      </p>
      <p className="text-muted-foreground text-sm">
        {fila.entidad} · {fila.entidadId}
      </p>
      <button
        onClick={alternar}
        className="text-primary mt-2 text-xs font-bold"
      >
        {abierto ? "Ocultar cambios" : "Ver cambios"}
      </button>
      {abierto && (
        <div className="bg-muted/70 mt-3 rounded-xl p-3 text-xs">
          {cargando ? (
            "Cargando cambios…"
          ) : error ? (
            "No se pudieron cargar los cambios."
          ) : cambios.length ? (
            <dl className="space-y-2">
              {cambios.map((c) => (
                <div key={c.campo}>
                  <dt className="font-medium">{c.campo}</dt>
                  <dd>
                    {mostrar(c.antes)} → {mostrar(c.despues)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            "Este evento no contiene cambios comparables."
          )}
        </div>
      )}
    </li>
  );
}

function mostrar(v: unknown) {
  return v === undefined
    ? "—"
    : typeof v === "string"
      ? `“${v}”`
      : JSON.stringify(v);
}
