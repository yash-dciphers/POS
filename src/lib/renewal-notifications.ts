import { sql } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { buildUrgentRenewalEmail } from '@/lib/email-templates';
import type { RenewalItem } from '@/components/RenewalAlerts';

export async function notifyUsersOfUrgentRenewals({
  companyId,
  urgentThresholdDays,
  renewals,
  force = false,
}: {
  companyId: string;
  urgentThresholdDays: number;
  renewals: RenewalItem[];
  force?: boolean;
}): Promise<{ urgentCount: number; newCount: number; recipientCount: number; deliveredCount: number }> {
  const urgentRenewals = renewals.filter((renewal) => renewal.daysRemaining <= urgentThresholdDays);
  if (urgentRenewals.length === 0) return { urgentCount: 0, newCount: 0, recipientCount: 0, deliveredCount: 0 };

  const recipients = await sql<{ id: string; email: string; full_name: string }[]>`
    select u.id, u.email, p.full_name
    from profiles p
    join app_users u on u.id = p.id
    where p.company_id = ${companyId}
      and u.is_active = true
    order by p.full_name, u.email
  `;

  if (recipients.length === 0) {
    return { urgentCount: urgentRenewals.length, newCount: urgentRenewals.length, recipientCount: 0, deliveredCount: 0 };
  }

  const sentRows = force
    ? []
    : await sql<{ line_item_id: string; recipient_user_id: string }[]>`
      select line_item_id, recipient_user_id
      from renewal_alert_notifications
      where company_id = ${companyId}
        and alert_type = 'urgent'
        and recipient_user_id is not null
        and line_item_id in ${sql(urgentRenewals.map((renewal) => renewal.lineItemId))}
    `;
  const sentPairs = new Set(sentRows.map((row) => `${row.recipient_user_id}:${row.line_item_id}`));

  const deliveries = recipients
    .map((recipient) => ({
      recipient,
      renewals: urgentRenewals.filter(
        (renewal) => force || !sentPairs.has(`${recipient.id}:${renewal.lineItemId}`)
      ),
    }))
    .filter((delivery) => delivery.renewals.length > 0);

  const newRenewalIds = new Set(deliveries.flatMap((delivery) => delivery.renewals.map((renewal) => renewal.lineItemId)));
  if (deliveries.length === 0) {
    return { urgentCount: urgentRenewals.length, newCount: 0, recipientCount: recipients.length, deliveredCount: 0 };
  }

  const results = await Promise.allSettled(
    deliveries.map(async ({ recipient, renewals: recipientRenewals }) => {
      const { subject, html } = buildUrgentRenewalEmail({
        recipientName: recipient.full_name,
        thresholdDays: urgentThresholdDays,
        renewals: recipientRenewals,
      });
      await sendEmail({ to: recipient.email, subject, html });
      return { recipient, renewals: recipientRenewals };
    })
  );

  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length) {
    console.error(`Urgent renewal email failed for ${failed.length}/${deliveries.length} recipient(s)`, failed);
  }

  const deliveredCount = results.filter((result) => result.status === 'fulfilled').length;
  const deliveredPairs = results.flatMap((result) =>
    result.status === 'fulfilled'
      ? result.value.renewals.map((renewal) => [companyId, renewal.lineItemId, urgentThresholdDays, result.value.recipient.id])
      : []
  );
  if (deliveredPairs.length > 0) {
    await sql`
      insert into renewal_alert_notifications (company_id, line_item_id, threshold_days, recipient_user_id)
      values ${sql(deliveredPairs)}
      on conflict (line_item_id, alert_type, recipient_user_id) where recipient_user_id is not null do nothing
    `;
  }

  return {
    urgentCount: urgentRenewals.length,
    newCount: newRenewalIds.size,
    recipientCount: recipients.length,
    deliveredCount,
  };
}

export async function notifyUsersOfCurrentUrgentRenewals(companyId: string, options: { force?: boolean } = {}) {
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

  return notifyUsersOfUrgentRenewals({
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
