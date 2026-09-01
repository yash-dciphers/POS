'use server';

import { sql, one } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { normalizePhone } from '@/lib/phone';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

// Admins set an initial password here; the user can sign in immediately.
export async function inviteUser(formData: FormData) {
  const requester = await requireAdmin();
  const email = String(formData.get('email'));
  const rawPhone = String(formData.get('phone') ?? '');
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');

  const userId = randomUUID();
  await sql`
    insert into app_users (id, email, password_hash, email_verified_at)
    values (${userId}, ${email.trim().toLowerCase()}, ${await hashPassword(password)}, now())
  `;
  await sql`
    insert into profiles (id, company_id, full_name, role, phone)
    values (
      ${userId},
      ${requester.company_id},
      ${String(formData.get('name'))},
      ${String(formData.get('role'))},
      ${rawPhone ? normalizePhone(rawPhone) : null}
    )
  `;

  revalidatePath('/users');
}

// Guards against a company ever ending up with zero Admins, which would
// lock everyone out of Company Settings, user management, and PO approval.
async function assertNotLastAdmin(companyId: string, excludingUserId: string) {
  const [{ count }] = await sql`
    select count(*)::int
    from profiles
    where company_id = ${companyId}
      and role = 'admin'
      and id <> ${excludingUserId}
  `;
  if (!count || count < 1) {
    throw new Error('Cannot do this — there must always be at least one Admin left.');
  }
}

export async function removeUser(targetUserId: string) {
  const requester = await requireAdmin();

  if (targetUserId === requester.id) throw new Error("You can't remove your own account.");

  const target = one(await sql<{ role: string; company_id: string }[]>`
    select role, company_id from profiles where id = ${targetUserId} limit 1
  `);
  if (!target || target.company_id !== requester.company_id) throw new Error('User not found');
  if (target.role === 'admin') await assertNotLastAdmin(requester.company_id, targetUserId);

  await sql`delete from app_users where id = ${targetUserId}`;

  revalidatePath('/users');
}

export async function changeUserRole(targetUserId: string, newRole: 'admin' | 'user') {
  const requester = await requireAdmin();

  if (newRole === 'user' && targetUserId === requester.id) {
    await assertNotLastAdmin(requester.company_id, targetUserId);
  } else if (newRole === 'user') {
    const target = one(await sql<{ role: string; company_id: string }[]>`
      select role, company_id from profiles where id = ${targetUserId} limit 1
    `);
    if (target?.role === 'admin') await assertNotLastAdmin(requester.company_id, targetUserId);
  }

  await sql`
    update profiles
    set role = ${newRole}
    where id = ${targetUserId}
      and company_id = ${requester.company_id}
  `;

  revalidatePath('/users');
}
