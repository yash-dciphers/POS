'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/login/actions';

export default function TopBar({
  initials,
  name,
  role,
  onMenuClick,
}: {
  initials: string;
  name: string;
  role: string;
  onMenuClick?: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setProfileOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="bg-white border-b border-border px-3 sm:px-4 md:px-7 py-3 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 rounded-md hover:bg-bg transition shrink-0"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 24 24" width={20} height={20} stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('open-quick-search'))}
        className="hidden md:flex items-center gap-2.5 text-xs text-muted border border-border rounded-md px-3 py-1.5 hover:border-navy hover:text-navy transition w-56"
      >
        <svg viewBox="0 0 24 24" width={14} height={14} stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="flex-1 text-left">Search...</span>
        <span className="text-[10px] font-semibold border border-border rounded px-1 py-0.5">Ctrl K</span>
      </button>

      <div className="md:hidden min-w-0 flex-1">
        <div className="text-[12px] font-bold text-navy truncate">DCIPHERS</div>
        <div className="text-[10.5px] text-muted truncate">PO Management</div>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('open-quick-search'))}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-md hover:bg-bg transition shrink-0"
          aria-label="Search"
        >
          <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0 ring-2 ring-transparent hover:ring-gold/40 transition"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            {initials}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-11 z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-white shadow-lg animate-scale-in overflow-hidden">
              <div className="p-3.5 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{name}</div>
                    <div className="text-[11px] text-muted capitalize">{role}</div>
                  </div>
                </div>
              </div>
              <div className="p-1.5">
                <Link
                  href="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium hover:bg-bg transition"
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  My Profile
                </Link>
                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-[#FCE9E7] transition"
                  >
                    <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Logout
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
