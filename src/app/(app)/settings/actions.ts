'use server';

import { sql } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyUsersOfCurrentUrgentRenewals } from '@/lib/renewal-notifications';

export async function updateCompany(formData: FormData) {
  const user = await requireAdmin();

  const renewalWindowDays = Math.max(1, Number(formData.get('renewal_window_days')) || 90);
  const renewalUrgentDays = Math.max(1, Number(formData.get('renewal_urgent_days')) || 30);
  const debitsDueSoonDays = Math.max(1, Number(formData.get('debits_due_soon_days')) || 30);
  const defaultGstRate = Number(formData.get('default_gst_rate'));

  const updated = await sql`
    update companies
    set name = ${String(formData.get('name') ?? '')},
        address = ${String(formData.get('address') ?? '')},
        gstin = ${String(formData.get('gstin') ?? '')},
        pan = ${String(formData.get('pan') ?? '')},
        contact_email = ${String(formData.get('contact_email') ?? '')},
        contact_phone = ${String(formData.get('contact_phone') ?? '')},
        default_gst_rate = ${Number.isFinite(defaultGstRate) ? defaultGstRate : 18},
        renewal_window_days = ${renewalWindowDays},
        renewal_urgent_days = ${Math.min(renewalUrgentDays, renewalWindowDays)},
        debits_due_soon_days = ${debitsDueSoonDays}
    where id = ${String(formData.get('id'))}
      and id = ${user.company_id}
    returning id
  `;
  if (updated.length === 0) redirect('/settings?error=not_saved');

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/debits');
  redirect('/settings?saved=1');
}

export async function sendUrgentRenewalAlertsNow() {
  const user = await requireAdmin();

  const result = await notifyUsersOfCurrentUrgentRenewals(user.company_id, { force: true });
  revalidatePath('/dashboard');
  revalidatePath('/settings');

  const params = new URLSearchParams({
    renewal_test: '1',
    urgent: String(result.urgentCount),
    queued: String(result.newCount),
    recipients: String(result.recipientCount),
    sent: String(result.deliveredCount),
  });
  redirect(`/settings?${params.toString()}`);
}
