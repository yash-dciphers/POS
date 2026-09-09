import { sql } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { buildUrgentRenewalEmail } from '@/lib/email-templates';
import type { RenewalItem } from '@/components/RenewalAlerts';

export async function notifyAdminsOfUrgentRenewals({
  companyId,
  urgentThresholdDays,
  renewals,
  force = false,
}: {
  companyId: string;
  urgentThresholdDays: number;
  renewals: RenewalItem[];
  force?: boolean;
}): Promise<{ urgentCount: number; newCount: number; adminCount: number; deliveredCount: number }> {
  const urgentRenewals = renewals.filter((renewal) => renewal.daysRemaining <= urgentThresholdDays);
  if (urgentRenewals.length === 0) return { urgentCount: 0, newCount: 0, adminCount: 0, deliveredCount: 0 };

  const sentRows = force
    ? []
    : await sql<{ line_item_id: string }[]>`
      select line_item_id
      from renewal_alert_notifications
      where company_id = ${companyId}
        and alert_type = 'urgent'
        and line_item_id in ${sql(urgentRenewals.map((renewal) => renewal.lineItemId))}
    `;
  const sentIds = new Set(sentRows.map((row) => row.line_item_id));
  const newlyUrgentRenewals = urgentRenewals.filter((renewal) => !sentIds.has(renewal.lineItemId));
  if (newlyUrgentRenewals.length === 0) {
    return { urgentCount: urgentRenewals.length, newCount: 0, adminCount: 0, deliveredCount: 0 };
  }

  const admins = await sql<{ email: string; full_name: string }[]>`
    select u.email, p.full_name
    from profiles p
    join app_users u on u.id = p.id
    where p.company_id = ${companyId}
      and p.role = 'admin'
      and u.is_active = true
    order by p.full_name, u.email
  `;

  if (admins.length === 0) {
    return { urgentCount: urgentRenewals.length, newCount: newlyUrgentRenewals.length, adminCount: 0, deliveredCount: 0 };
  }

  const results = await Promise.allSettled(
    admins.map((admin) => {
      const { subject, html } = buildUrgentRenewalEmail({
        adminName: admin.full_name,
        thresholdDays: urgentThresholdDays,
        renewals: newlyUrgentRenewals,
      });
      return sendEmail({ to: admin.email, subject, html });
    })
  );

  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length) {
    console.error(`Urgent renewal email failed for ${failed.length}/${admins.length} admin(s)`, failed);
  }

  const deliveredCount = results.filter((result) => result.status === 'fulfilled').length;
  if (deliveredCount === 0) {
    return { urgentCount: urgentRenewals.length, newCount: newlyUrgentRenewals.length, adminCount: admins.length, deliveredCount: 0 };
  }

  await sql`
    insert into renewal_alert_notifications (company_id, line_item_id, threshold_days)
    values ${sql(newlyUrgentRenewals.map((renewal) => [companyId, renewal.lineItemId, urgentThresholdDays]))}
    on conflict (line_item_id, alert_type) do nothing
  `;

  return {
    urgentCount: urgentRenewals.length,
    newCount: newlyUrgentRenewals.length,
    adminCount: admins.length,
    deliveredCount,
  };
}

export async function notifyAdminsOfCurrentUrgentRenewals(companyId: string, options: { force?: boolean } = {}) {
  const [company] = await sql<{ renewal_urgent_days: number }[]>`
    select renewal_urgent_days
    from companies
    where id = ${companyId}
    limit 1
  `;
  const urgentThresholdDays = company?.renewal_urgent_days ?? 30;

  const rows = await sql<
    {
      line_item_id: string;
      po_id: string;
      po_number: string;
      vendor_name: string;
      description: string;
      term_end_date: string;
      days_remaining: number;
    }[]
  >`
    select
      li.id as line_item_id,
      p.id as po_id,
      p.po_number,
      v.name as vendor_name,
      li.description,
      li.term_end_date::text as term_end_date,
      (li.term_end_date - current_date)::int as days_remaining
    from po_line_items li
    join purchase_orders p on p.id = li.po_id
    join vendors v on v.id = p.vendor_id
    where p.company_id = ${companyId}
      and p.status = 'issued'
      and p.deleted_at is null
      and li.term_end_date is not null
      and li.term_end_date >= current_date
      and li.term_end_date <= current_date + (${urgentThresholdDays}::int * interval '1 day')
    order by li.term_end_date asc
  `;

  return notifyAdminsOfUrgentRenewals({
    companyId,
    urgentThresholdDays,
    force: options.force,
    renewals: rows.map((row) => ({
      lineItemId: row.line_item_id,
      poId: row.po_id,
      poNumber: row.po_number,
      vendorName: row.vendor_name,
      description: row.description,
      termEndDate: row.term_end_date,
      daysRemaining: Number(row.days_remaining),
    })),
  });
}
