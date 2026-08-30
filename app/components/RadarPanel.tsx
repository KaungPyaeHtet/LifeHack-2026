"use client";

import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { DIMENSIONS, type DimensionKey } from "@/lib/dimensions";

/**
 * The shape is the diagnosis. A listing can carry good facts and still score
 * badly, and the radar is where that reads instantly: the attribute and
 * constraint spokes stay long while persona and comparative collapse, which
 * says "the data is fine, the framing is missing" faster than any number can.
 */
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
    <div className="w-full">
      <div className="h-[290px] w-full">
        <ResponsiveContainer>
          <RadarChart
            data={data}
            outerRadius="74%"
            margin={{ top: 12, right: 24, bottom: 12, left: 24 }}
          >
            <defs>
              <radialGradient id="ar-after" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.05} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.3} />
              </radialGradient>
            </defs>

            <PolarGrid stroke="var(--border)" strokeDasharray="2 4" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickSize={14}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />

            <Radar
              name="Original"
              dataKey="Original"
              stroke="var(--warn)"
              strokeWidth={1.5}
              fill="var(--warn)"
              fillOpacity={0.12}
              dot={{ r: 2.5, fill: "var(--warn)", strokeWidth: 0 }}
              isAnimationActive
              animationDuration={900}
            />
            {after && (
              <Radar
                name="Agent-ready"
                dataKey="Optimized"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#ar-after)"
                fillOpacity={1}
                dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
                isAnimationActive
                animationDuration={1100}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-5 text-[11px] text-[var(--muted)]">
        <LegendDot color="var(--warn)" label="Original" />
        {after && <LegendDot color="var(--accent)" label="Agent-ready" />}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
