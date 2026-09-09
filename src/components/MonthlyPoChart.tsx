'use client';

export interface MonthlyDataPoint {
  label: string; // e.g. "Apr"
  count: number;
  value: number; // grand total for that month
}

export default function MonthlyPoChart({ data }: { data: MonthlyDataPoint[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="card px-4 py-5 sm:px-5">
      <div className="mb-4 text-[11px] font-bold uppercase tracking-wide text-muted">POs Issued — Last 6 Months</div>
      <div className="grid h-36 grid-cols-6 items-end gap-2 sm:gap-4">
        {data.map((d) => {
          const barHeight = d.count === 0 ? 0 : Math.max((d.count / maxCount) * 96, 5);
          return (
            <div
              key={d.label}
              className="flex h-full min-w-0 flex-col items-center justify-end"
              title={`${d.label}: ${d.count} PO${d.count === 1 ? '' : 's'} · ₹${d.value.toLocaleString('en-IN')}`}
            >
              <div className="mb-1 h-4 text-[10px] font-bold text-navy">{d.count > 0 ? d.count : ''}</div>
              <div className="flex h-24 w-full items-end justify-center border-b border-border">
                <div
                  className="w-full max-w-10 rounded-t bg-gold/90 transition-all duration-500"
                  style={{ height: `${barHeight}px` }}
                />
              </div>
              <div className="mt-2 text-[10.5px] text-muted">{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
