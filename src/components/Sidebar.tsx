'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/login/actions';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/po/new', label: 'New Purchase Order', icon: 'file-plus' },
  { href: '/vendors', label: 'Vendor Repository', icon: 'package' },
  { href: '/debits', label: 'Debits', icon: 'credit-card' },
];
const ADMIN_NAV = [
  { href: '/settings', label: 'Company Settings', icon: 'settings' },
  { href: '/users', label: 'Users & Roles', icon: 'users' },
  { href: '/audit-log', label: 'Audit Log', icon: 'file-text' },
];

const ICONS: Record<string, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
    </>
  ),
  'credit-card': (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </>
  ),
  'file-plus': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="12" y1="12.5" x2="12" y2="18" />
      <line x1="9" y1="15.25" x2="15" y2="15.25" />
    </>
  ),
  package: (
    <>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </>
  ),
  'log-out': (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
};

function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      className="shrink-0 opacity-90"
      stroke="currentColor"
      fill="none"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

function NavItem({ href, label, icon, active, onClick }: { href: string; label: string; icon: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] font-medium mb-0.5 border-l-2 transition-colors ${
        active ? 'bg-white/10 border-gold text-white' : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar({ role, name, onNavigate }: { role: string; name: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <aside
      className="w-[248px] h-full shrink-0 bg-navy text-white flex flex-col"
      style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '14px 14px' }}
    >
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="DCIPHERS logo" className="w-9 h-auto shrink-0" />
        <div>
          <div className="font-bold text-[13.5px]">DCIPHERS</div>
          <div className="text-[10.5px] text-white/55">PO Management</div>
        </div>
      </div>
      <nav className="p-2.5 flex-1 overflow-y-auto">
        {NAV.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} onClick={onNavigate} />
        ))}
        {role === 'admin' && (
          <>
            <div className="text-[10.5px] uppercase tracking-wide text-white/40 px-3 pt-3.5 pb-1.5">Admin</div>
            {ADMIN_NAV.map((item) => (
              <NavItem key={item.href} {...item} active={pathname === item.href} onClick={onNavigate} />
            ))}
          </>
        )}
      </nav>
      <div className="px-4.5 py-3.5 border-t border-white/10 text-xs text-white/50">
        {name}
        <br />
        <span className="badge badge-admin mt-1 uppercase text-[10px]">{role}</span>
        <Link href="/profile" className="block mt-2.5 text-[12.5px] font-medium text-white/60 hover:text-white transition">
          My Profile
        </Link>
        <form action={logout} className="mt-1.5">
          <button
            type="submit"
            className="flex items-center gap-2 text-[12.5px] font-medium text-white/60 hover:text-white transition"
          >
            <Icon name="log-out" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
