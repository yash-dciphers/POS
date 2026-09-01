'use server';

import { sql, one, jsonb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { calculateTotals, lineTotal } from '@/lib/gst';
import { numberToWordsIndian } from '@/lib/number-to-words';
import { getNextPoNumber } from '@/lib/po-numbering';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { CreatePoLineItem } from '../../new/actions';

export interface UpdatePoInput {
  poId: string;
  poDate: string;
  gstRate: number;
  vendorId?: string;
  newVendor?: { name: string; address: string; gstin: string; pan: string; save: boolean };
  quoteNumber?: string;
  contactPerson?: string;
  contactPhone?: string;
  poNumberMode?: 'keep' | 'generate' | 'custom';
  customPoNumber?: string;
  shipSameAsBill: boolean;
  shipToDetails?: { name: string; address: string; gstin?: string; pan?: string };
  deliveryTimeline: string;
  paymentTerms: string;
  paymentTermsType?: 'credit' | 'pdc' | 'immediate';
  paymentTermsDays?: number;
  termsAndConditions: string;
  lineItems: CreatePoLineItem[];
  lineItemColumns: unknown[];
  status: 'draft' | 'issued' | 'pending_approval' | 'cancelled';
}

export async function updatePurchaseOrder(input: UpdatePoInput) {
  const user = await requireAdmin();

  const company = one(await sql<any[]>`select * from companies where id = ${user.company_id} limit 1`);
  if (!company) throw new Error('No company profile configured');

  const existing = one(await sql<any[]>`
    select * from purchase_orders where id = ${input.poId} and company_id = ${user.company_id} limit 1
  `);
  if (!existing) throw new Error('Purchase order not found');

  // Resolve or create the vendor — same logic as creation. Contact
  // person, phone, and quote number are per-PO, captured further below.
  let vendorId = input.vendorId;
  if (!vendorId && input.newVendor) {
    const [newVendor] = await sql`
      insert into vendors (company_id, name, address, gstin, pan, created_by)
      values (${company.id}, ${input.newVendor.name}, ${input.newVendor.address}, ${input.newVendor.gstin}, ${input.newVendor.pan}, ${user.id})
      returning id
    `;
    vendorId = newVendor.id;
  }
  if (!vendorId) throw new Error('A vendor is required');

  // Totals always recomputed server-side, never trusted from the client.
  const lineTotals = input.lineItems.map((li) => lineTotal(li));
  const { subtotal, gstAmount, grandTotal } = calculateTotals(lineTotals, input.gstRate);
  const amountInWords = numberToWordsIndian(grandTotal);

  // PO number: default is to keep it as-is. Admin can instead generate a
  // fresh one (same series, atomic — same mechanism as creation) or type a
  // fully custom number. Series/fiscal-year metadata only changes for the
  // "generate" path; a custom number is stored as entered.
  let poNumber = existing.po_number;
  let seriesPrefix = existing.series_prefix;
  let fiscalYear = existing.fiscal_year;
  if (input.poNumberMode === 'generate') {
    const result = await getNextPoNumber({
      companyId: company.id,
      companyCode: 'DCIPHERS',
      seriesPrefix: existing.series_prefix,
      poDate: new Date(input.poDate),
    });
    poNumber = result.poNumber;
    fiscalYear = result.fiscalYear;
  } else if (input.poNumberMode === 'custom' && input.customPoNumber) {
    poNumber = input.customPoNumber;
  }

  const shipToSnapshot = input.shipSameAsBill
    ? null
    : {
        name: input.shipToDetails?.name || company.name,
        address: input.shipToDetails?.address || company.address,
        gstin: input.shipToDetails?.gstin || null,
        pan: input.shipToDetails?.pan || null,
      };

  // Replace line items wholesale rather than diffing — simpler and safe
  // since po_line_items has no history requirements of its own (the
  // audit log below is what preserves the "before" picture).
  const rows = input.lineItems.map((li, i) => {
    const { description, partCode, qty, unitPrice, total, term_start_date, term_end_date, ...custom } = li;
    return {
      po_id: input.poId,
      sort_order: i,
      description,
      part_code: partCode ?? null,
      qty,
      unit_price: unitPrice,
      total_price: total,
      term_start_date: term_start_date ? String(term_start_date) : null,
      term_end_date: term_end_date ? String(term_end_date) : null,
      custom_fields: custom,
    };
  });
  try {
    await sql`
      update purchase_orders
      set po_number = ${poNumber},
          series_prefix = ${seriesPrefix},
          fiscal_year = ${fiscalYear},
          po_date = ${input.poDate},
          vendor_id = ${vendorId},
          quote_number = ${input.quoteNumber || null},
          vendor_contact_person = ${input.contactPerson || null},
          vendor_contact_phone = ${input.contactPhone || null},
          ship_to_snapshot = ${shipToSnapshot ? jsonb(shipToSnapshot) : null}::jsonb,
          gst_rate = ${input.gstRate},
          subtotal = ${subtotal},
          gst_amount = ${gstAmount},
          grand_total = ${grandTotal},
          amount_in_words = ${amountInWords},
          delivery_timeline = ${input.deliveryTimeline},
          payment_terms = ${input.paymentTerms},
          payment_terms_type = ${input.paymentTermsType ?? null},
          payment_terms_days = ${input.paymentTermsDays ?? null},
          terms_and_conditions = ${input.termsAndConditions},
          line_item_columns = ${jsonb(input.lineItemColumns as any)}::jsonb,
          status = ${input.status},
          updated_by = ${user.id},
          rejection_reason = ${input.status !== 'draft' ? null : existing.rejection_reason},
          rejected_by = ${input.status !== 'draft' ? null : existing.rejected_by},
          rejected_at = ${input.status !== 'draft' ? null : existing.rejected_at}
      where id = ${input.poId}
        and company_id = ${user.company_id}
    `;
    await sql`delete from po_line_items where po_id = ${input.poId}`;
    for (const row of rows) {
      await sql`
        insert into po_line_items (
          po_id, sort_order, description, part_code, qty, unit_price, total_price,
          term_start_date, term_end_date, custom_fields
        )
        values (
          ${input.poId}, ${row.sort_order}, ${row.description}, ${row.part_code}, ${row.qty}, ${row.unit_price},
          ${row.total_price}, ${row.term_start_date}, ${row.term_end_date}, ${jsonb(row.custom_fields as any)}::jsonb
        )
      `;
    }
    await sql`
      insert into po_audit_log (po_id, changed_by, action, diff)
      values (${input.poId}, ${user.id}, 'edited', ${jsonb({
        before: { po_number: existing.po_number, grand_total: existing.grand_total, status: existing.status },
        after: { po_number: poNumber, grand_total: grandTotal, status: input.status },
      })}::jsonb)
    `;
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new Error(`PO number "${poNumber}" is already in use by another purchase order — pick a different one.`);
    }
    throw error;
  }

  revalidatePath('/dashboard');
  revalidatePath(`/po/${input.poId}`);
  redirect(`/po/${input.poId}`);
}
