"use client";

import dynamic from "next/dynamic";
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
  return <GraficoVentas serie={serie} granularidad={granularidad} />;
}
