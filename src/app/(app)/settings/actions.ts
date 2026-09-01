'use server';

import { sql } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

export async function updateCompany(formData: FormData) {
  const user = await requireAdmin();

  const renewalWindowDays = Math.max(1, Number(formData.get('renewal_window_days')) || 90);
  const renewalUrgentDays = Math.max(1, Number(formData.get('renewal_urgent_days')) || 30);
  const debitsDueSoonDays = Math.max(1, Number(formData.get('debits_due_soon_days')) || 30);

  await sql`
    update companies
    set name = ${String(formData.get('name') ?? '')},
        address = ${String(formData.get('address') ?? '')},
        gstin = ${String(formData.get('gstin') ?? '')},
        pan = ${String(formData.get('pan') ?? '')},
        default_gst_rate = ${Number(formData.get('default_gst_rate'))},
        renewal_window_days = ${renewalWindowDays},
        renewal_urgent_days = ${Math.min(renewalUrgentDays, renewalWindowDays)},
        debits_due_soon_days = ${debitsDueSoonDays}
    where id = ${String(formData.get('id'))}
      and id = ${user.company_id}
  `;
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/debits');
}
