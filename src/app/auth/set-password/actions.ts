'use server';

import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { redirect } from 'next/navigation';

export async function setPassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (password.length < 8) {
    redirect('/auth/set-password?error=too_short');
  }
  if (password !== confirmPassword) {
    redirect('/auth/set-password?error=mismatch');
  }

  const user = await requireUser();

  await sql`
    update app_users
    set password_hash = ${await hashPassword(password)}
    where id = ${user.id}
  `;

  redirect('/dashboard');
}
