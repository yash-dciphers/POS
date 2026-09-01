'use server';

import { sql, one, jsonb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

// Full and partial payments both go through here — "Full" just means the
// UI pre-fills this with the exact remaining balance rather than needing
// a special code path. That keeps "fully paid" as nothing more than "the
// sum of recorded payments equals the total" — never a separate flag
// that could drift out of sync with what's actually been recorded.
export async function recordPayment(poId: string, amount: number, remark?: string) {
  const user = await requireAdmin();

  if (!(amount > 0)) throw new Error('Payment amount must be greater than zero.');

  const po = one(await sql<{ po_number: string; grand_total: string }[]>`
    select po_number, grand_total
    from purchase_orders
    where id = ${poId} and company_id = ${user.company_id}
    limit 1
  `);
  if (!po) throw new Error('Purchase order not found');

  const existingPayments = await sql`select amount from po_payments where po_id = ${poId}`;
  const alreadyPaid = existingPayments.reduce((sum, p: any) => sum + Number(p.amount), 0);
  const remaining = Number(po.grand_total) - alreadyPaid;

  // A small floating-point tolerance (1 paisa) rather than a strict >
  // comparison — otherwise a "pay in full" click that computes the
  // remaining balance via JS arithmetic could get rejected by its own
  // rounding.
  if (amount > remaining + 0.01) {
    throw new Error(`That's more than what's remaining on this PO (₹${remaining.toFixed(2)}).`);
  }

  await sql`
    insert into po_payments (po_id, amount, remark, recorded_by)
    values (${poId}, ${amount}, ${remark?.trim() || null}, ${user.id})
  `;
  await sql`
    insert into po_audit_log (po_id, changed_by, action, diff)
    values (${poId}, ${user.id}, 'payment_recorded', ${jsonb({ amount, remark: remark?.trim() || null, po_number: po.po_number })}::jsonb)
  `;

  revalidatePath(`/po/${poId}`);
  revalidatePath('/debits');
}

// Editing an existing payment entry — same remaining-balance guard,
// computed excluding the payment being edited (so editing a payment's
// own amount doesn't compare it against a total that already includes
// its old value).
export async function updatePayment(paymentId: string, amount: number, remark?: string) {
  const user = await requireAdmin();

  if (!(amount > 0)) throw new Error('Payment amount must be greater than zero.');

  const payment = one(await sql<{ po_id: string; amount: string }[]>`
    select pay.po_id, pay.amount
    from po_payments pay
    join purchase_orders po on po.id = pay.po_id
    where pay.id = ${paymentId}
      and po.company_id = ${user.company_id}
    limit 1
  `);
  if (!payment) throw new Error('Payment record not found');

  const po = one(await sql<{ po_number: string; grand_total: string }[]>`
    select po_number, grand_total from purchase_orders where id = ${payment.po_id} limit 1
  `);
  if (!po) throw new Error('Purchase order not found');

  const otherPayments = await sql`
    select amount from po_payments where po_id = ${payment.po_id} and id <> ${paymentId}
  `;
  const paidByOthers = otherPayments.reduce((sum, p: any) => sum + Number(p.amount), 0);
  const remaining = Number(po.grand_total) - paidByOthers;

  if (amount > remaining + 0.01) {
    throw new Error(`That's more than what's remaining on this PO (₹${remaining.toFixed(2)}).`);
  }

  await sql`
    update po_payments
    set amount = ${amount}, remark = ${remark?.trim() || null}
    where id = ${paymentId}
  `;
  await sql`
    insert into po_audit_log (po_id, changed_by, action, diff)
    values (${payment.po_id}, ${user.id}, 'payment_updated', ${jsonb({ amount, remark: remark?.trim() || null, po_number: po.po_number })}::jsonb)
  `;

  revalidatePath(`/po/${payment.po_id}`);
  revalidatePath('/debits');
}

// Deleting a payment record IS how a payment gets "unmarked" — there's
// no separate paid/unpaid flag anywhere to keep in sync.
export async function deletePayment(paymentId: string) {
  const user = await requireAdmin();

  const payment = one(await sql<{ po_id: string; amount: string; remark: string | null }[]>`
    select pay.po_id, pay.amount, pay.remark
    from po_payments pay
    join purchase_orders po on po.id = pay.po_id
    where pay.id = ${paymentId}
      and po.company_id = ${user.company_id}
    limit 1
  `);
  if (!payment) throw new Error('Payment record not found');

  const po = one(await sql<{ po_number: string }[]>`
    select po_number from purchase_orders where id = ${payment.po_id} limit 1
  `);

  await sql`delete from po_payments where id = ${paymentId}`;
  await sql`
    insert into po_audit_log (po_id, changed_by, action, diff)
    values (${payment.po_id}, ${user.id}, 'payment_removed', ${jsonb({ amount: Number(payment.amount), remark: payment.remark, po_number: po?.po_number })}::jsonb)
  `;

  revalidatePath(`/po/${payment.po_id}`);
  revalidatePath('/debits');
}
