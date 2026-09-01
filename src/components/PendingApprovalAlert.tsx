'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface PendingApprovalItem {
  id: string;
  poNumber: string;
  vendorName: string;
  grandTotal: number;
}

export default function PendingApprovalAlert({ items }: { items: PendingApprovalItem[] }) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0 || dismissed) return null;

  return (
    <div className="rounded-lg border border-ink/20 bg-[#EEF1FA] mb-2.5 animate-slide-down">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" width={17} height={17} stroke="var(--ink)" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-[13px] font-medium">
            <strong>{items.length}</strong> PO{items.length === 1 ? '' : 's'} waiting on your approval.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-[12.5px] font-semibold text-navy hover:underline">
            {expanded ? 'Hide' : 'View'}
          </button>
          <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-muted hover:text-navy transition">
            ✕
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-ink/15">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/po/${item.id}`}
              className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-ink/10 last:border-b-0 hover:bg-white/50 transition"
            >
              <div>
                <span className="font-mono text-xs font-semibold">{item.poNumber}</span>
                <span className="text-muted text-xs ml-2">{item.vendorName}</span>
              </div>
              <span className="font-mono text-xs font-semibold shrink-0">
                ₹{item.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
