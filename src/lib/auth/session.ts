import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { SESSION_COOKIE } from '@/lib/auth/constants';

const SESSION_DAYS = 30;

export interface CurrentUser {
  id: string;
  // The app_sessions row backing this request. A fresh sign-in always means a
  // new id, which is what lets the UI tell one login session from the next.
  session_id: string;
  email: string;
  company_id: string;
  full_name: string;
  role: 'user' | 'admin';
  phone: string | null;
  // True while the current password is one an Admin chose and emailed to
  // them. Cleared as soon as they set their own.
  password_set_by_admin: boolean;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function shouldUseSecureCookie() {
  if (process.env.NODE_ENV !== 'production') return false;

  const appUrl = process.env.APP_URL;
  if (!appUrl) return true;

  try {
    return new URL(appUrl).protocol === 'https:';
  } catch {
    return true;
  }
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
    secure: shouldUseSecureCookie(),
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
    secure: shouldUseSecureCookie(),
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
        s.id as session_id,
        u.email,
        p.company_id,
        p.full_name,
        p.role,
        p.phone,
        u.password_set_by_admin
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
