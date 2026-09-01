'use server';

import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { normalizePhone } from '@/lib/phone';
import { revalidatePath } from 'next/cache';

export async function updateMyPhone(formData: FormData) {
  const user = await requireUser();

  const rawPhone = String(formData.get('phone') ?? '');
  await sql`
    update profiles
    set phone = ${rawPhone ? normalizePhone(rawPhone) : null}
    where id = ${user.id}
  `;

  revalidatePath('/profile');
}
