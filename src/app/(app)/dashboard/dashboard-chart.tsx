"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatearSoles } from "@/lib/dinero";

export default function DashboardChart({
  serie,
}: {
  serie: Array<{ periodo: string; brutoCentimos: number }>;
}) {
  return (
    <div className="h-52 sm:h-64" aria-label="Gráfico de ventas por periodo">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={serie}>
          <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `S/${Math.round(Number(v) / 100)}`} />
          <Tooltip formatter={(v) => formatearSoles(Number(v))} />
          <Bar
            dataKey="brutoCentimos"
            name="Monto bruto"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
