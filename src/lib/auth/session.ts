import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { SESSION_COOKIE } from '@/lib/auth/constants';

const SESSION_DAYS = 30;

export interface CurrentUser {
  id: string;
  email: string;
  company_id: string;
  full_name: string;
  role: 'user' | 'admin';
  phone: string | null;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await sql`
    insert into app_sessions (user_id, token_hash, expires_at)
    values (${userId}, ${tokenHash}, ${expiresAt})
  `;

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await sql`delete from app_sessions where token_hash = ${hashToken(token)}`;
  }
  cookies().set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let rows: CurrentUser[] = [];
  try {
    rows = await sql<CurrentUser[]>`
      select
        u.id,
        u.email,
        p.company_id,
        p.full_name,
        p.role,
        p.phone
      from app_sessions s
      join app_users u on u.id = s.user_id
      join profiles p on p.id = u.id
      where s.token_hash = ${hashToken(token)}
        and s.expires_at > now()
        and u.is_active = true
      limit 1
    `;
  } catch (error) {
    console.error('Session lookup failed', error);
    return null;
  }

  return rows[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('Only admins can perform this action');
  return user;
}
