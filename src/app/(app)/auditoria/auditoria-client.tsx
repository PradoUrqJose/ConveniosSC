"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, History, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { diffAuditoria } from "@/lib/audit/diff";
import type { FilaAuditoria, FiltroAuditoria } from "@/modules/auditoria/query";
import type { Pagina } from "@/lib/tipos";
import { verificarIntegridad } from "./actions";
import { CabeceraPagina, EstadoVacio } from "@/components/shell/pagina-ui";
import { serializarParametrosAuditoria } from "@/modules/auditoria/filtros";
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
  const [resultado, setResultado] = useState<string>();
  const siguiente = pagina.cursor
    ? `/auditoria?${serializarParametrosAuditoria({ ...filtros, cursor: pagina.cursor })}`
    : "";
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
              onClick={async () => {
                const r = await verificarIntegridad();
                setResultado(
                  r.rota
                    ? `Cadenas rotas en el registro ${r.enId}.`
                    : `Cadenas íntegras: ${r.verificadas} registros verificados.`,
                );
              }}
            >
              <SearchCheck className="size-4" />
              Verificar integridad
            </Button>
          ) : null
        }
      />
      {resultado && (
        <div
          role="status"
          className="border-success/20 bg-success/8 text-success flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold"
        >
          <CheckCircle2 className="size-4" /> {resultado}
        </div>
      )}
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
      {pagina.items.length ? (
        <ol className="surface-panel divide-y px-5 sm:px-6">
          {pagina.items.map((f) => (
            <Evento key={f.id} fila={f} />
          ))}
        </ol>
      ) : (
        <EstadoVacio
          icono={<History className="size-6" />}
          titulo="No hay registros"
          descripcion="No encontramos actividad para los filtros seleccionados."
        />
      )}
      {siguiente && (
        <Link href={siguiente} className="self-start text-sm underline">
          Cargar más
        </Link>
      )}
    </section>
  );
}
function Evento({ fila }: { fila: FilaAuditoria }) {
  const [abierto, setAbierto] = useState(false);
  const cambios = diffAuditoria(fila.datosAntes, fila.datosDespues);
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
      {cambios.length > 0 && (
        <button
          onClick={() => setAbierto(!abierto)}
          className="text-primary mt-2 text-xs font-bold"
        >
          {abierto ? "Ocultar cambios" : "Ver cambios"}
        </button>
      )}
      {abierto && (
        <dl className="bg-muted/70 mt-3 space-y-2 rounded-xl p-3 text-xs">
          {cambios.map((c) => (
            <div key={c.campo}>
              <dt className="font-medium">{c.campo}</dt>
              <dd>
                {mostrar(c.antes)} → {mostrar(c.despues)}
              </dd>
            </div>
          ))}
        </dl>
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
