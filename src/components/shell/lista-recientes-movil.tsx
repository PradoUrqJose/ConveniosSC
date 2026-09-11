"use client";

import Link from "next/link";
import { ArrowRight, ReceiptText } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";
import { formatearSoles } from "@/lib/dinero";
import { formatearFechaUI } from "@/lib/fechas";
import { iniciarTransicionMovil } from "@/lib/transicion-movil";
import type { VentaReciente } from "@/modules/ventas/query";

type Filtro = "todas" | "hoy";

const FILTROS: ReadonlyArray<readonly [Filtro, string]> = [
  ["todas", "Todas"],
  ["hoy", "Hoy"],
];

/**
 * Movimientos recientes del rediseño PWA (2026-09): encabezado de sección,
 * chips que filtran de verdad (todas / de hoy) y filas limpias con ícono en
 * squircle e importe a la derecha. Solo móvil; el escritorio conserva su
 * panel. Tocar una fila abre el detalle con la transición lateral (#70).
 */
export function ListaRecientesMovil({
  titulo,
  ventas,
  hoy,
  vacio,
  verTodas = "/ventas",
  className,
}: {
  titulo: string;
  ventas: VentaReciente[];
  /** Fecha de Lima (`YYYY-MM-DD`) contra la que filtra el chip "Hoy". */
  hoy: string;
  vacio: string;
  verTodas?: string;
  className?: string;
}) {
  const idTitulo = useId();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const visibles =
    filtro === "hoy" ? ventas.filter((v) => v.fechaVenta === hoy) : ventas;

  return (
    <section aria-labelledby={idTitulo} className={cn("lg:hidden", className)}>
      <div className="mob-seccion-encabezado">
        <h2 id={idTitulo} className="mob-seccion-titulo">
          {titulo}
        </h2>
        <Link href={verTodas} className="mob-seccion-enlace">
          Ver todas
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="mob-chips" role="group" aria-label="Filtrar movimientos">
        {FILTROS.map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            // 36px visibles con área táctil de 44px por `::after`.
            data-toque="compacto"
            aria-pressed={filtro === valor}
            onClick={() => setFiltro(valor)}
            className="mob-chip"
          >
            {etiqueta}
          </button>
        ))}
      </div>
      {visibles.length ? (
        <ul className="mob-movimientos">
          {visibles.map((venta) => (
            <li key={venta.id}>
              <Link
                href={`/ventas/${venta.id}`}
                onClick={() => iniciarTransicionMovil("adelante")}
                className="mob-movimiento"
              >
                <span className="mob-movimiento-icono" aria-hidden="true">
                  <ReceiptText className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="mob-movimiento-titulo">
                    {venta.empleado.nombres} {venta.empleado.apellidos}
                  </span>
                  <span className="mob-movimiento-meta">
                    {formatearFechaUI(venta.fechaVenta)} · {venta.sede.nombre}
                  </span>
                </span>
                <span className="mob-movimiento-monto">
                  {formatearSoles(venta.montoFinalCentimos)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mob-movimientos-vacio">
          {filtro === "hoy" ? "Hoy todavía no hay movimientos." : vacio}
        </p>
      )}
    </section>
  );
}
