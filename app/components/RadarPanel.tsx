"use client";

import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from "recharts";
import { DIMENSIONS, type DimensionKey } from "@/lib/dimensions";

export function RadarPanel({
  before,
  after,
}: {
  before: Record<DimensionKey, number>;
  after?: Record<DimensionKey, number>;
}) {
  const data = DIMENSIONS.map((d) => ({
    axis: d.short,
    Original: before[d.key] ?? 0,
    ...(after ? { Optimized: after[d.key] ?? 0 } : {}),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Original" dataKey="Original"
            stroke="var(--bad)" fill="var(--bad)" fillOpacity={0.18}
          />
          {after && (
            <Radar
              name="Optimized" dataKey="Optimized"
              stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.18}
            />
          )}
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
            iconType="plainline"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
