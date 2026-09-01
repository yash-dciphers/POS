import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import DebitsClient, { type DebitRow } from './DebitsClient';

export default async function DebitsPage() {
  const user = await requireUser();

  const [companyRows, pos] = await Promise.all([
    sql`select debits_due_soon_days from companies where id = ${user.company_id} limit 1`,
    sql`
      select
        p.id, p.po_number, p.po_date, p.grand_total, p.payment_terms_type, p.payment_terms_days,
        jsonb_build_object('name', v.name) as vendors
      from purchase_orders p
      join vendors v on v.id = p.vendor_id
      where p.company_id = ${user.company_id}
        and p.status = 'issued'
        and p.deleted_at is null
      order by p.po_date asc
    `,
  ]);

  const isAdmin = user.role === 'admin';
  const dueSoonDays = companyRows[0]?.debits_due_soon_days ?? 30;
  const allIssued = pos ?? [];

  // A PO only needs payment history fetched if it's Credit/PDC now, OR
  // might have history from before its terms changed — pulling for every
  // issued PO here is simplest and this list is never large enough for
  // that to matter (same reasoning already used elsewhere in this app).
  const poIds = allIssued.map((p: any) => p.id);
  const payments = poIds.length
    ? await sql`select po_id, amount from po_payments where po_id = any(${poIds})`
    : [];

  const paidByPo = new Map<string, number>();
  for (const pay of payments ?? []) {
    paidByPo.set(pay.po_id, (paidByPo.get(pay.po_id) ?? 0) + Number(pay.amount));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: DebitRow[] = allIssued
    .filter((po: any) => {
      const hasTerms = po.payment_terms_type === 'credit' || po.payment_terms_type === 'pdc';
      const hasHistory = paidByPo.has(po.id);
      // A PO whose terms no longer say Credit/PDC still shows here if
      // real payments were already recorded against it — losing sight of
      // money already being tracked would be a real problem, not just a
      // cosmetic one. If nothing's been paid and the terms changed away
      // from Credit/PDC, it correctly drops off the list entirely.
      return hasTerms || hasHistory;
    })
    .map((po: any) => {
      const totalPaid = paidByPo.get(po.id) ?? 0;
      const grandTotal = Number(po.grand_total);
      const remaining = Math.max(grandTotal - totalPaid, 0);

      let dueDate: string | null = null;
      if (po.payment_terms_days != null) {
        const d = new Date(po.po_date);
        d.setDate(d.getDate() + po.payment_terms_days);
        dueDate = d.toISOString().slice(0, 10);
      }
      const daysUntilDue = dueDate
        ? Math.round((new Date(dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const status: DebitRow['status'] = remaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
      const isOverdue = remaining > 0 && daysUntilDue !== null && daysUntilDue < 0;

      return {
        id: po.id,
        poNumber: po.po_number,
        poDate: po.po_date,
        vendorName: po.vendors?.name ?? '—',
        grandTotal,
        totalPaid,
        remaining,
        paymentTermsType: po.payment_terms_type,
        dueDate,
        daysUntilDue,
        status,
        isOverdue,
      };
    });

  return <DebitsClient rows={rows} dueSoonDays={dueSoonDays} isAdmin={isAdmin} />;
}
