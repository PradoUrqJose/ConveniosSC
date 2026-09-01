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
  granularidad,
}: {
  serie: Array<{ periodo: string; brutoCentimos: number }>;
  granularidad: "dia" | "semana" | "mes";
}) {
  return (
    <div
      className="h-64 lg:h-72"
      role="img"
      aria-label="Gráfico de ventas por periodo"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={serie}>
          <XAxis
            dataKey="periodo"
            minTickGap={24}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={{ stroke: "var(--border)" }}
            tickFormatter={(fecha) =>
              granularidad === "mes"
                ? String(fecha).slice(0, 7)
                : String(fecha).slice(5)
            }
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={{ stroke: "var(--border)" }}
            tickFormatter={(v) => `S/${Math.round(Number(v) / 100)}`}
            width={62}
          />
          <Tooltip
            formatter={(v) => [formatearSoles(Number(v)), "Monto bruto"]}
            labelFormatter={(fecha) => `Periodo: ${fecha}`}
            contentStyle={{
              backgroundColor: "var(--popover)",
              borderColor: "var(--border)",
              borderRadius: 12,
              color: "var(--popover-foreground)",
            }}
            labelStyle={{ color: "var(--popover-foreground)" }}
            itemStyle={{ color: "var(--popover-foreground)" }}
          />
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
