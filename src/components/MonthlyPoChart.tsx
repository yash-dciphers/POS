'use client';

export interface MonthlyDataPoint {
  label: string; // e.g. "Apr"
  count: number;
  value: number; // grand total for that month
}

export default function MonthlyPoChart({ data }: { data: MonthlyDataPoint[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const barWidth = 28;
  const gap = 14;
  const chartHeight = 110;
  const width = data.length * (barWidth + gap);

  return (
    <div className="card p-4.5">
      <div className="text-[11px] uppercase tracking-wide text-muted font-bold mb-3.5">POs Issued — Last 6 Months</div>
      <svg viewBox={`0 0 ${width} ${chartHeight + 28}`} width="100%" height={chartHeight + 28} preserveAspectRatio="xMinYMid meet">
        {data.map((d, i) => {
          const barHeight = d.count === 0 ? 0 : Math.max((d.count / maxCount) * chartHeight, 4);
          const x = i * (barWidth + gap);
          const y = chartHeight - barHeight;
          return (
            <g key={d.label} className="group">
              <rect x={x} y={chartHeight} width={barWidth} height={0} rx={4} fill="var(--gold)" opacity={0.85}>
                <animate attributeName="y" from={chartHeight} to={y} dur="0.5s" fill="freeze" begin={`${i * 0.05}s`} calcMode="spline" keySplines="0.2 0 0.2 1" />
                <animate attributeName="height" from="0" to={barHeight} dur="0.5s" fill="freeze" begin={`${i * 0.05}s`} calcMode="spline" keySplines="0.2 0 0.2 1" />
              </rect>
              <text x={x + barWidth / 2} y={y < 16 ? y + 16 : y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill={y < 16 ? 'white' : 'var(--navy)'} opacity={d.count > 0 ? 1 : 0}>
                {d.count}
              </text>
              <text x={x + barWidth / 2} y={chartHeight + 18} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
