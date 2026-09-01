'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import QuickSearch from './QuickSearch';

export default function AppShell({
  role,
  name,
  initials,
  children,
}: {
  role: string;
  name: string;
  initials: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <QuickSearch />
      {/* Backdrop — mobile only, closes the menu on tap outside it */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-navy/40 z-40 md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 print:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar role={role} name={name} onNavigate={() => setMobileOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="print:hidden">
          <TopBar initials={initials} name={name} role={role} onMenuClick={() => setMobileOpen(true)} />
        </div>
        <main className="p-4 md:p-7 flex-1 print:p-0">{children}</main>
      </div>
    </div>
  );
}
