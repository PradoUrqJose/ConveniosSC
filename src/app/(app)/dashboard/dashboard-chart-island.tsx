"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const GraficoVentas = dynamic(() => import("./dashboard-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 rounded-xl lg:h-72" />,
});

export function DashboardChartIsland({
  serie,
  granularidad,
}: {
  serie: Array<{ periodo: string; brutoCentimos: number }>;
  granularidad: "dia" | "semana" | "mes";
}) {
  const referencia = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = referencia.current;
    if (!nodo) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return;
        setVisible(true);
        observador.disconnect();
      },
      { rootMargin: "160px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={referencia} aria-busy={!visible}>
      {visible ? (
        <ErrorGrafico>
          <GraficoVentas serie={serie} granularidad={granularidad} />
        </ErrorGrafico>
      ) : (
        <Skeleton className="h-64 rounded-xl lg:h-72" />
      )}
      {/* El canvas SVG no es una lectura suficiente para tecnologías de
          asistencia. Esta lista conserva la misma serie incluso si falla
          el chunk del gráfico. */}
      <ul className="sr-only" aria-label={`Ventas por ${granularidad}`}>
        {serie.map((punto) => (
          <li
            key={punto.periodo}
          >{`${punto.periodo}: ${new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(punto.brutoCentimos / 100)}`}</li>
        ))}
      </ul>
    </div>
  );
}

class ErrorGrafico extends Component<
  { children: ReactNode },
  { fallo: boolean }
> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  render() {
    if (this.state.fallo) {
      return (
        <p
          role="status"
          className="text-muted-foreground grid h-64 place-items-center rounded-xl border border-dashed px-6 text-center text-sm lg:h-72"
        >
          El gráfico no pudo cargarse. La serie de ventas sigue disponible como
          texto para lectores de pantalla.
        </p>
      );
    }
    return this.props.children;
  }
}
