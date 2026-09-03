'use server';

import { sql, one } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { normalizePhone } from '@/lib/phone';
import { sendEmail } from '@/lib/email';
import { buildWelcomeEmail, buildPasswordResetEmail } from '@/lib/email-templates';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'crypto';

function appUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL is not set, so the sign-in link cannot be built.');
  return url.replace(/\/+$/, '');
}

// Admins set an initial password here; the user can sign in immediately and
// receives it by email along with a prompt to change it.
export async function inviteUser(formData: FormData) {
  const requester = await requireAdmin();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('name') ?? '').trim();
  const role = String(formData.get('role') ?? 'user');
  const rawPhone = String(formData.get('phone') ?? '');
  const password = String(formData.get('password') ?? '');

  if (password.length < 8) redirect('/users?error=short_password');
  if (!email || !fullName) redirect('/users?error=missing_fields');

  const userId = randomUUID();
  // Hashed before the transaction opens — bcrypt at 12 rounds takes a few
  // hundred milliseconds, and there's no reason to hold a transaction (and a
  // pooled connection) open for CPU work unrelated to the database.
  const passwordHash = await hashPassword(password);

  // Both rows are written together: a failure between them would otherwise
  // leave an app_users row with no profile, which can't sign in (the session
  // query inner-joins profiles) and never appears in this page's list.
  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into app_users (id, email, password_hash, email_verified_at, password_set_by_admin)
        values (${userId}, ${email}, ${passwordHash}, now(), true)
      `;
      await tx`
        insert into profiles (id, company_id, full_name, role, phone)
        values (
          ${userId},
          ${requester.company_id},
          ${fullName},
          ${role},
          ${rawPhone ? normalizePhone(rawPhone) : null}
        )
      `;
    });
  } catch (error: any) {
    if (error?.code === '23505') redirect('/users?error=duplicate_email');
    throw error;
  }

  // The account exists and works from here on. A failed send must not undo
  // that — the admin can use "Reset password" to try again.
  let mailed = true;
  try {
    const { subject, html } = buildWelcomeEmail({
      fullName,
      email,
      password,
      role: role === 'admin' ? 'admin' : 'user',
      invitedByName: requester.full_name,
      appUrl: appUrl(),
    });
    await sendEmail({ to: email, subject, html });
  } catch (error) {
    console.error('Welcome email failed to send', error);
    mailed = false;
  }

  revalidatePath('/users');
  redirect(mailed ? '/users?invited=1' : '/users?invited=1&mail_failed=1');
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

// Sets a new password on someone else's account and emails it to them.
// This is the recovery path for a forgotten password: bcrypt hashes can't be
// reversed, so an existing password can never be re-sent — only replaced.
export async function resetUserPassword(targetUserId: string, newPassword: string) {
  const requester = await requireAdmin();

  if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');

  const target = one(await sql<{ email: string; full_name: string; company_id: string }[]>`
    select u.email, p.full_name, p.company_id
    from profiles p
    join app_users u on u.id = p.id
    where p.id = ${targetUserId}
    limit 1
  `);
  if (!target || target.company_id !== requester.company_id) throw new Error('User not found');

  await sql`
    update app_users
    set password_hash = ${await hashPassword(newPassword)},
        password_set_by_admin = true
    where id = ${targetUserId}
  `;

  // Existing sessions are cut so the old password can't keep a device signed
  // in after it has supposedly been replaced.
  await sql`delete from app_sessions where user_id = ${targetUserId}`;

  let emailed = true;
  try {
    const { subject, html } = buildPasswordResetEmail({
      fullName: target.full_name,
      email: target.email,
      password: newPassword,
      resetByName: requester.full_name,
      appUrl: appUrl(),
    });
    await sendEmail({ to: target.email, subject, html });
  } catch (error) {
    console.error('Password reset email failed to send', error);
    emailed = false;
  }

  revalidatePath('/users');
  return { emailed, email: target.email };
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
