"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
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
        <GraficoVentas serie={serie} granularidad={granularidad} />
      ) : (
        <Skeleton className="h-64 rounded-xl lg:h-72" />
      )}
    </div>
  );
}
