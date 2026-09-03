'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Shown while a user's password is still the one an Admin chose and emailed
// to them. Dismissal is kept in sessionStorage rather than component state
// because the dashboard is a server component — plain state would bring the
// banner back on every navigation, which would make the ✕ meaningless.
//
// Keyed by the app_sessions id rather than the user id, so dismissal lasts
// exactly one login session: signing out and back in issues a new session
// row, so the reminder returns. Keying by user would have kept it hidden
// across logins, since signing out never clears the browser's storage.
export default function AdminPasswordReminder({ sessionId }: { sessionId: string }) {
  const [visible, setVisible] = useState(false);

  // Read after mount, never during render: the server has no sessionStorage,
  // so deciding visibility during render would make the two markups disagree.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey(sessionId)) !== '1') setVisible(true);
    } catch {
      // Private mode and blocked-storage settings throw on access. Showing
      // the reminder is the safer failure.
      setVisible(true);
    }
  }, [sessionId]);

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(storageKey(sessionId), '1');
    } catch {
      // Dismissal just won't survive the next navigation. Not worth surfacing.
    }
  }

  if (!visible) return null;

  return (
    <div className="rounded-lg border border-warn/25 bg-[#F7EFE2] mb-2.5 animate-slide-down">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <svg
            viewBox="0 0 24 24"
            width={17}
            height={17}
            className="shrink-0"
            stroke="var(--warn)"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[13px] font-medium">
            <strong>Your password was created by an Admin.</strong>{' '}
            <span className="text-muted">Someone other than you has seen it — change it to something only you know.</span>
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/auth/set-password" className="text-[12.5px] font-semibold text-navy hover:underline whitespace-nowrap">
            Change password
          </Link>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-muted hover:text-navy transition">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function storageKey(sessionId: string) {
  return `dciphers:pw-reminder:${sessionId}`;
}
