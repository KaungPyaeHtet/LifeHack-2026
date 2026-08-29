"use client";

import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
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

  // No legend: the dial beside it already carries the colour key, and
  // repeating it stole vertical room the chart needed.
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="78%" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickSize={12}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Original" dataKey="Original"
            stroke="var(--warn)" fill="var(--warn)" fillOpacity={0.14}
          />
          {after && (
            <Radar
              name="Optimized" dataKey="Optimized"
              stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.18}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
