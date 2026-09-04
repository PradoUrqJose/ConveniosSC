"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";

import { ErrorParcial } from "@/components/estados";
import { EstadoSinResultados } from "@/components/shell/pagina-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { copiaFallo, type ClaseFallo } from "@/lib/estados-red";

const CLASES: ClaseFallo[] = [
  "offline",
  "servidor",
  "timeout",
  "sesion",
  "permiso",
  "datos",
  "desconocido",
];

/**
 * Referencia viva de los estados del issue #56 (PWA-MOB-06).
 *
 * Sirve para lo que un test no ve: que las siete causas de fallo se lean
 * distintas, que los dos vacíos no se confundan y que el esqueleto tenga la
 * geometría de la fila real y no un bloque genérico.
 */
export function DemoEstados() {
  const [clase, setClase] = useState<ClaseFallo>("offline");
  const [hayFiltros, setHayFiltros] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-xs font-semibold opacity-60">
          Clases de fallo (`clasificarFallo`)
        </p>
        <div className="flex flex-wrap gap-2">
          {CLASES.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setClase(opcion)}
              aria-pressed={clase === opcion}
              className={`mob-pill min-h-11 px-3 text-sm font-semibold ${
                clase === opcion
                  ? "mob-pill-ok"
                  : "bg-[var(--mob-superficie-tenue)] text-[var(--mob-superficie-tenue-foreground)]"
              }`}
            >
              {opcion}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs opacity-60">{copiaFallo(clase).titulo}</p>
      </div>

      <ErrorParcial clase={clase} onReintentar={() => undefined} />

      <div>
        <p className="mb-2 text-xs font-semibold opacity-60">
          Vacío inicial vs. cero resultados
        </p>
        <button
          type="button"
          onClick={() => setHayFiltros((valor) => !valor)}
          className="mob-pill mb-3 min-h-11 bg-[var(--mob-superficie-tenue)] px-3 text-sm font-semibold text-[var(--mob-superficie-tenue-foreground)]"
        >
          {hayFiltros ? "Con filtros aplicados" : "Sin filtros"}
        </button>
        <EstadoSinResultados
          icono={<Receipt className="size-6" />}
          hayFiltros={hayFiltros}
          inicial={{
            titulo: "Aún no hay ventas registradas",
            descripcion:
              "Cuando registres una operación, aparecerá aquí con su monto y estado.",
          }}
          filtrado={{
            titulo: "No encontramos coincidencias",
            descripcion:
              "Prueba con otros términos o limpia los filtros para ver más resultados.",
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold opacity-60">
          Esqueleto geométrico (misma altura de fila que el contenido)
        </p>
        <div className="mob-tarjeta divide-y">
          {Array.from({ length: 3 }, (_, indice) => (
            <div
              key={indice}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3"
            >
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
