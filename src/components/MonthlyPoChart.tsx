'use client';

export interface MonthlyDataPoint {
  label: string; // e.g. "Apr"
  count: number;
  value: number; // grand total for that month
}

export default function MonthlyPoChart({ data }: { data: MonthlyDataPoint[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const totalCount = data.reduce((sum, point) => sum + point.count, 0);
  const totalValue = data.reduce((sum, point) => sum + point.value, 0);

  return (
    <section className="card overflow-hidden" aria-label="Purchase orders issued in the last six months">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-wide text-navy">POs Issued</h2>
          <p className="mt-0.5 text-[11px] text-muted">Monthly activity for the last 6 months</p>
        </div>
        <div className="rounded-lg border border-gold/25 bg-[#FBF6E6] px-3 py-1.5 text-right">
          <div className="font-mono text-lg font-bold leading-none text-navy">{totalCount}</div>
          <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted">Total issued</div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-5 sm:px-5">
        <div className="relative h-40">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
          <div className="pointer-events-none absolute inset-x-0 bottom-6 border-t border-[color:var(--border-strong)]" />

          <div className="relative z-10 grid h-full grid-cols-6 gap-2 sm:gap-4">
            {data.map((point) => {
              const heightPercent = point.count === 0 ? 0 : Math.max((point.count / maxCount) * 100, 8);
              return (
                <div
                  key={point.label}
                  className="group flex min-w-0 flex-col items-center"
                  title={`${point.label}: ${point.count} PO${point.count === 1 ? '' : 's'} · ₹${point.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                >
                  <div className="flex h-[134px] w-full items-end justify-center pb-px">
                    {point.count > 0 ? (
                      <div
                        className="relative w-full max-w-12 rounded-t-md bg-gradient-to-t from-navy to-ink shadow-sm transition duration-200 group-hover:brightness-110"
                        style={{ height: `${heightPercent}%` }}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-navy shadow-sm ring-1 ring-border">
                          {point.count}
                        </span>
                        <span className="absolute inset-x-0 top-0 h-1 rounded-t-md bg-gold" />
                      </div>
                    ) : (
                      <div className="mb-0.5 h-1.5 w-full max-w-12 rounded-full bg-border" />
                    )}
                  </div>
                  <div className="mt-2 text-[10.5px] font-semibold text-muted">{point.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[10.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-navy" /> Issued purchase orders
          </span>
          <span>
            6-month value: <strong className="font-mono text-navy">₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
