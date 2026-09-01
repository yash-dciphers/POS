import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import AppShell from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const name = user.full_name ?? user.email ?? '';
  const initials = name
    .split(' ')
    .map((p: string) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell role={user.role} name={name} initials={initials || 'U'}>
      {children}
    </AppShell>
  );
}
