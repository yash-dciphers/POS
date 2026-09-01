'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface RenewalItem {
  lineItemId: string;
  poId: string;
  poNumber: string;
  vendorName: string;
  description: string;
  termEndDate: string;
  daysRemaining: number;
}



export default function RenewalAlerts({ renewals, urgentThresholdDays = 30 }: { renewals: RenewalItem[]; urgentThresholdDays?: number }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const count = renewals.length;
  const urgent = renewals.filter((r) => r.daysRemaining <= urgentThresholdDays);
  // The banner is the proactive, no-click-needed alert — it only appears at
  // all when something falls within the 90-day window (i.e. whenever
  // `renewals` is non-empty, since that's already filtered to 90 days
  // server-side), but its tone and headline emphasize whatever's within 30
  // days, since that's the actionable-soon subset.
  const showBanner = count > 0 && !bannerDismissed;

  return (
    <div className="relative">
      {showBanner && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 mb-2.5 border transition-all animate-slide-down ${
            urgent.length > 0 ? 'bg-[#FDEDEC] border-danger/25' : 'bg-[#FBF3DE] border-warn/25'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <svg
              viewBox="0 0 24 24"
              width={17}
              height={17}
              stroke="currentColor"
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={urgent.length > 0 ? 'text-danger' : 'text-warn'}
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="text-[13px] font-medium">
              {urgent.length > 0 ? (
                <>
                  <strong>{urgent.length}</strong> renewal{urgent.length === 1 ? '' : 's'} due within 30 days
                  {count > urgent.length ? ` (${count} total in the next 90 days)` : ''}.
                </>
              ) : (
                <>
                  <strong>{count}</strong> renewal{count === 1 ? '' : 's'} coming up in the next 90 days.
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setDropdownOpen(true)}
              className="text-[12.5px] font-semibold text-navy hover:underline"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
              className="text-muted hover:text-navy transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-bg transition"
          aria-label="Upcoming renewals"
        >
          <svg viewBox="0 0 24 24" width={19} height={19} stroke="currentColor" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
              {count}
            </span>
          )}
        </button>
      </div>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 max-h-96 overflow-y-auto card shadow-lg animate-scale-in">
            <div className="px-4 py-3 border-b border-border">
              <div className="font-display text-sm">Upcoming Renewals</div>
              <div className="text-[11px] text-muted">Next 90 days, issued POs only</div>
            </div>
            {renewals.length === 0 ? (
              <div className="text-center text-muted text-xs py-8 px-4">Nothing renewing in the next 90 days.</div>
            ) : (
              <div>
                {renewals.map((r) => (
                  <Link
                    key={r.lineItemId}
                    href={`/po/${r.poId}`}
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-bg transition"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-xs font-semibold">{r.vendorName}</div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          r.daysRemaining <= urgentThresholdDays ? 'bg-[#F5E6E4] text-danger' : 'bg-[#FBF3DE] text-warn'
                        }`}
                      >
                        {r.daysRemaining <= 0 ? 'Due today' : `${r.daysRemaining}d left`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">{r.description}</div>
                    <div className="text-[10.5px] text-muted mt-0.5 font-mono">
                      {r.poNumber} · ends {new Date(r.termEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
