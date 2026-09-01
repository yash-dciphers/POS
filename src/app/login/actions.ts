'use server';

import { sql, one } from '@/lib/db';
import { createSession, destroySession } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  try {
    const user = one(await sql<{ id: string; password_hash: string | null; is_active: boolean }[]>`
      select id, password_hash, is_active
      from app_users
      where email = ${email}
      limit 1
    `);

    if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
      redirect('/login?error=1');
    }

    await createSession(user.id);
  } catch (error: any) {
    if (isRedirectError(error)) throw error;
    console.error('Login failed before credential verification completed', error);
    redirect('/login?error=db');
  }

  redirect('/dashboard');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}

function isRedirectError(error: unknown) {
  return typeof error === 'object' && error !== null && 'digest' in error && String((error as any).digest).startsWith('NEXT_REDIRECT');
}
