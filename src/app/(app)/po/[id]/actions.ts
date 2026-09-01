'use server';

import { sql, one, jsonb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

// Any single Admin approving is sufficient — no quorum. This flips a
// pending_approval PO straight to issued and records who/when.
export async function approvePurchaseOrder(poId: string) {
  const user = await requireAdmin();

  const po = one(await sql<{ status: string }[]>`
    select status from purchase_orders where id = ${poId} and company_id = ${user.company_id} limit 1
  `);
  if (!po) throw new Error('Purchase order not found');
  if (po.status !== 'pending_approval') throw new Error('This PO is not awaiting approval');

  await sql`
    update purchase_orders
    set status = 'issued',
        approved_by = ${user.id},
        approved_at = now(),
        updated_by = ${user.id}
    where id = ${poId}
      and company_id = ${user.company_id}
  `;
  await sql`
    insert into po_audit_log (po_id, changed_by, action, diff)
    values (${poId}, ${user.id}, 'approved', ${jsonb({ status: 'issued' })}::jsonb)
  `;

  revalidatePath('/dashboard');
  revalidatePath(`/po/${poId}`);
}

// Soft delete, admin-only: the row and its full history (including this
// very deletion event) stay in the database — the PO just gets hidden from
// the dashboard, search, vendor totals, and renewal reminders. A real hard
// delete isn't offered because po_audit_log rows cascade-delete with their
// PO, which would erase the deletion record the moment it's created.
export async function deletePurchaseOrder(poId: string) {
  const user = await requireAdmin();

  const po = one(await sql<{ po_number: string; deleted_at: string | null }[]>`
    select po_number, deleted_at from purchase_orders where id = ${poId} and company_id = ${user.company_id} limit 1
  `);
  if (!po) throw new Error('Purchase order not found');
  if (po.deleted_at) throw new Error('This PO is already deleted');

  await sql`
    update purchase_orders
    set deleted_at = now(), deleted_by = ${user.id}
    where id = ${poId}
      and company_id = ${user.company_id}
  `;
  await sql`
    insert into po_audit_log (po_id, changed_by, action, diff)
    values (${poId}, ${user.id}, 'deleted', ${jsonb({ po_number: po.po_number })}::jsonb)
  `;

  revalidatePath('/dashboard');
  revalidatePath(`/po/${poId}`);
}

// Sends a pending_approval PO back to draft with a reason, rather than
// leaving it stuck with no path forward. The creator sees why on the PO
// page; fixing it currently means asking an Admin to edit it, or
// duplicating it with corrections and resubmitting — editing stays
// Admin-only, same as everywhere else in the app.
export async function rejectPurchaseOrder(poId: string, reason: string) {
  const user = await requireAdmin();

  if (!reason.trim()) throw new Error('A reason is required so the creator knows what to fix.');

  const po = one(await sql<{ status: string }[]>`
    select status from purchase_orders where id = ${poId} and company_id = ${user.company_id} limit 1
  `);
  if (!po) throw new Error('Purchase order not found');
  if (po.status !== 'pending_approval') throw new Error('This PO is not awaiting approval');

  await sql`
    update purchase_orders
    set status = 'draft',
        rejection_reason = ${reason.trim()},
        rejected_by = ${user.id},
        rejected_at = now(),
        updated_by = ${user.id}
    where id = ${poId}
      and company_id = ${user.company_id}
  `;
  await sql`
    insert into po_audit_log (po_id, changed_by, action, diff)
    values (${poId}, ${user.id}, 'rejected', ${jsonb({ status: 'draft', reason: reason.trim() })}::jsonb)
  `;

  revalidatePath('/dashboard');
  revalidatePath(`/po/${poId}`);
}
