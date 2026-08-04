"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { diffAuditoria } from "@/lib/audit/diff";
import type { FilaAuditoria, FiltroAuditoria } from "@/modules/auditoria/query";
import type { Pagina } from "@/lib/tipos";
import { verificarIntegridad } from "./actions";
export function AuditoriaClient({
  pagina,
  filtros,
  puedeVerificar,
}: {
  pagina: Pagina<FilaAuditoria>;
  filtros: FiltroAuditoria;
  puedeVerificar: boolean;
}) {
  const [resultado, setResultado] = useState<string>();
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros))
    if (v && k !== "cursor") params.set(k, String(v));
  const siguiente = pagina.cursor
    ? `/auditoria?${new URLSearchParams({ ...Object.fromEntries(params), cursor: pagina.cursor })}`
    : "";
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
          <p className="text-muted-foreground text-sm">
            Registro de acciones del sistema
          </p>
        </div>
        {puedeVerificar && (
          <Button
            variant="outline"
            onClick={async () => {
              const r = await verificarIntegridad();
              setResultado(
                r.rota
                  ? `Cadena rota en el registro ${r.enId}.`
                  : `Cadena íntegra: ${r.verificadas} registros verificados.`,
              );
            }}
          >
            Verificar integridad
          </Button>
        )}
      </div>
      {resultado && (
        <p role="status" className="rounded-md border p-3 text-sm">
          {resultado}
        </p>
      )}
      <form className="flex flex-wrap gap-2">
        <input
          type="date"
          name="desde"
          defaultValue={filtros.desde}
          className="border-input bg-background rounded-md border px-2 text-sm"
        />
        <input
          type="date"
          name="hasta"
          defaultValue={filtros.hasta}
          className="border-input bg-background rounded-md border px-2 text-sm"
        />
        <input
          name="accion"
          defaultValue={filtros.accion}
          placeholder="Acción"
          className="border-input bg-background rounded-md border px-2 text-sm"
        />
        <input
          name="entidad"
          defaultValue={filtros.entidad}
          placeholder="Entidad"
          className="border-input bg-background rounded-md border px-2 text-sm"
        />
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      {pagina.items.length ? (
        <ol className="border-l pl-5">
          {pagina.items.map((f) => (
            <Evento key={f.id} fila={f} />
          ))}
        </ol>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          No hay registros para estos filtros.
        </div>
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
    <li className="relative pb-5">
      <span className="bg-primary absolute top-1 -left-[27px] size-3 rounded-full" />
      <p className="text-muted-foreground text-xs">
        {new Date(fila.ts).toLocaleString("es-PE")}
      </p>
      <p className="text-sm">
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
          className="mt-1 text-sm underline"
        >
          {abierto ? "Ocultar cambios" : "Ver cambios"}
        </button>
      )}
      {abierto && (
        <dl className="bg-muted mt-2 space-y-1 rounded-md p-3 text-xs">
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
