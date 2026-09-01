'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface DebitRow {
  id: string;
  poNumber: string;
  poDate: string;
  vendorName: string;
  grandTotal: number;
  totalPaid: number;
  remaining: number;
  paymentTermsType: 'credit' | 'pdc' | 'immediate' | null;
  dueDate: string | null;
  daysUntilDue: number | null;
  status: 'unpaid' | 'partial' | 'paid';
  isOverdue: boolean;
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowColorClass(row: DebitRow) {
  if (row.status === 'paid') return 'bg-[#E7F3EE]';
  if (row.isOverdue) return 'bg-[#F5E6E4]';
  if (row.status === 'partial') return 'bg-[#FBF2DF]';
  return '';
}

export default function DebitsClient({
  rows,
  dueSoonDays,
  isAdmin,
}: {
  rows: DebitRow[];
  dueSoonDays: number;
  isAdmin: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'credit' | 'pdc'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesFilter = filter === 'all' || r.paymentTermsType === filter;
      const matchesQuery = !q || r.poNumber.toLowerCase().includes(q) || r.vendorName.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [rows, filter, query]);

  const dueSoonTotal = filtered
    .filter((r) => r.remaining > 0 && r.daysUntilDue !== null && r.daysUntilDue <= dueSoonDays)
    .reduce((sum, r) => sum + r.remaining, 0);

  const overdueTotal = filtered.filter((r) => r.isOverdue).reduce((sum, r) => sum + r.remaining, 0);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div className="card border-l-[3px] border-l-navy p-4">
          <div className="text-[11px] uppercase font-semibold text-muted">
            Due in next {dueSoonDays} days{filter !== 'all' && ` — ${filter.toUpperCase()}`}
          </div>
          <div className="font-display text-2xl mt-1 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmt(dueSoonTotal)}
          </div>
        </div>
        <div className="card border-l-[3px] border-l-danger p-4">
          <div className="text-[11px] uppercase font-semibold text-muted">
            Overdue{filter !== 'all' && ` — ${filter.toUpperCase()}`}
          </div>
          <div className="font-display text-2xl mt-1 font-mono text-danger" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmt(overdueTotal)}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 p-4 border-b border-border">
          <input
            className="input flex-1 min-w-[200px]"
            placeholder="Search PO number, vendor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex gap-1.5">
            {(['all', 'credit', 'pdc'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition ${
                  filter === f ? 'bg-navy text-white border-navy' : 'border-border text-muted hover:border-navy hover:text-navy'
                }`}
              >
                {f === 'all' ? 'All' : f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <table className="ledger w-full">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Issue Date</th>
              <th>Vendor</th>
              <th>Terms</th>
              <th className="text-right">
                Grand Total
                <div className="text-[9.5px] font-normal text-muted normal-case tracking-normal">incl. GST</div>
              </th>
              <th className="text-right">Remaining</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`row-hover ${rowColorClass(r)}`}>
                <td className="font-mono font-semibold">
                  <Link href={`/po/${r.id}`} className="hover:underline">
                    {r.poNumber}
                  </Link>
                </td>
                <td>{new Date(r.poDate).toLocaleDateString('en-IN')}</td>
                <td>{r.vendorName}</td>
                <td className="uppercase text-xs font-semibold text-muted">{r.paymentTermsType ?? '—'}</td>
                <td className="text-right font-mono">{fmt(r.grandTotal)}</td>
                <td className="text-right font-mono font-semibold">{fmt(r.remaining)}</td>
                <td className="text-xs">
                  {r.status === 'paid' ? (
                    '—'
                  ) : r.daysUntilDue === null ? (
                    '—'
                  ) : r.isOverdue ? (
                    <span className="text-danger font-semibold">{Math.abs(r.daysUntilDue)}d overdue</span>
                  ) : (
                    `${r.daysUntilDue}d left`
                  )}
                </td>
                <td>
                  {r.status === 'paid' ? (
                    <span className="badge" style={{ background: '#E7F3EE', color: 'var(--success)' }}>
                      Paid
                    </span>
                  ) : r.isOverdue ? (
                    <span className="badge" style={{ background: '#F5E6E4', color: 'var(--danger)' }}>
                      Overdue
                    </span>
                  ) : r.status === 'partial' ? (
                    <span className="badge" style={{ background: '#FBF2DF', color: 'var(--warn)' }}>
                      Partial
                    </span>
                  ) : (
                    <span className="badge badge-user">Unpaid</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted text-sm py-10">
                  {rows.length === 0
                    ? 'No Credit or PDC payments to track yet.'
                    : 'No POs match that search or filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isAdmin && (
        <div className="text-[10.5px] text-muted mt-2.5 px-1">
          Recording a payment is done from each PO's own page, and is limited to Admins.
        </div>
      )}
    </div>
  );
}
