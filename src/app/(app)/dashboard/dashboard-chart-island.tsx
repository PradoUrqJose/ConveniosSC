"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const GraficoVentas = dynamic(() => import("./dashboard-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-52 rounded-xl sm:h-64" />,
});

export function DashboardChartIsland({
  serie,
}: {
  serie: Array<{ periodo: string; brutoCentimos: number }>;
}) {
  return <GraficoVentas serie={serie} />;
}
