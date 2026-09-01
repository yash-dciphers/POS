export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-3 bg-border/60 rounded animate-pulse ${className}`} />;
}

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-r-transparent animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-border/40 rounded-lg animate-pulse ${className}`} />;
}

export function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-3.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card border-l-[3px] border-l-border p-4">
          <SkeletonLine className="w-20 h-2.5 mb-3" />
          <SkeletonLine className="w-16 h-6" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-border flex gap-2.5">
        <SkeletonLine className="w-48 h-8" />
        <SkeletonLine className="w-32 h-8" />
      </div>
      <table className="ledger w-full">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><SkeletonLine className="w-16 h-2.5" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci}><SkeletonLine className={ci === 0 ? 'w-32' : 'w-20'} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className="card p-5">
      <SkeletonLine className="w-32 h-4 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={`mb-2.5 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
      ))}
    </div>
  );
}
