'use server';

import { sql, one, jsonb } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getNextPoNumber } from '@/lib/po-numbering';
import { calculateTotals, lineTotal } from '@/lib/gst';
import { numberToWordsIndian } from '@/lib/number-to-words';
import { sendEmail } from '@/lib/email';
import { buildPendingApprovalEmail } from '@/lib/email-templates';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export interface CreatePoLineItem {
  description: string;
  partCode?: string;
  qty: number;
  unitPrice: number;
  total: number;
  [key: string]: unknown;
}

export interface CreatePoInput {
  category: 'PRH' | 'PRS';
  poDate: string;
  gstRate: number;
  vendorId?: string;
  newVendor?: { name: string; address: string; gstin: string; pan: string; save: boolean };
  quoteNumber?: string;
  contactPerson?: string;
  contactPhone?: string;
  shipSameAsBill: boolean;
  shipToDetails?: { name: string; address: string; gstin?: string; pan?: string };
  deliveryTimeline: string;
  paymentTerms: string;
  paymentTermsType?: 'credit' | 'pdc' | 'immediate';
  paymentTermsDays?: number;
  termsAndConditions: string;
  lineItems: CreatePoLineItem[];
  lineItemColumns: unknown[];
  status: 'draft' | 'issued' | 'pending_approval';
  requestedApproverId?: string;
}

export async function createPurchaseOrder(input: CreatePoInput) {
  const user = await requireUser();

  // Defense in depth: never trust the client's chosen status for a
  // non-admin. Even if something bypassed the UI, a non-admin issuing a PO
  // always lands as pending_approval, not issued.
  const effectiveStatus = input.status === 'issued' && user.role !== 'admin' ? 'pending_approval' : input.status;

  const company = one(await sql<any[]>`select * from companies where id = ${user.company_id} limit 1`);
  if (!company) throw new Error('No company profile configured');

  // Resolve or create the vendor. Contact person, phone, and quote number
  // are NOT stored here — they vary PO to PO, so they're captured further
  // below as a snapshot on the purchase_orders row itself, the same way
  // bill_to_snapshot already works.
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

  const vendor = one(await sql<{ name: string }[]>`
    select name from vendors where id = ${vendorId} and company_id = ${company.id} limit 1
  `);
  if (!vendor) throw new Error('Vendor not found');

  let requestedApprover: { id: string; email: string; full_name: string } | null = null;
  if (effectiveStatus === 'pending_approval') {
    if (!input.requestedApproverId) {
      throw new Error('Choose the Admin who should receive this approval request.');
    }
    requestedApprover = one(await sql<{ id: string; email: string; full_name: string }[]>`
      select p.id, u.email, p.full_name
      from profiles p
      join app_users u on u.id = p.id
      where p.id = ${input.requestedApproverId}
        and p.company_id = ${company.id}
        and p.role = 'admin'
        and u.is_active = true
      limit 1
    `);
    if (!requestedApprover) throw new Error('Selected approval Admin is no longer available.');
  }

  // Atomically reserve the next PO number for the chosen series/fiscal year.
  const poDate = new Date(input.poDate);
  const { poNumber, fiscalYear } = await getNextPoNumber({
    companyId: company.id,
    companyCode: 'DCIPHERS',
    seriesPrefix: input.category,
    poDate,
  });

  // Totals are always computed server-side — never trust client-submitted totals.
  const lineTotals = input.lineItems.map((li) => lineTotal(li));
  const { subtotal, gstAmount, grandTotal } = calculateTotals(lineTotals, input.gstRate);
  const amountInWords = numberToWordsIndian(grandTotal);

  const billToSnapshot = {
    name: company.name,
    address: company.address,
    gstin: company.gstin,
    pan: company.pan,
    contact_email: company.contact_email,
    contact_phone: company.contact_phone,
  };
  const shipToSnapshot = input.shipSameAsBill
    ? null
    : {
        name: input.shipToDetails?.name || company.name,
        address: input.shipToDetails?.address || company.address,
        gstin: input.shipToDetails?.gstin || null,
        pan: input.shipToDetails?.pan || null,
      };

  const rows = input.lineItems.map((li, i) => {
    const { description, partCode, qty, unitPrice, total, term_start_date, term_end_date, ...custom } = li;
    return {
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
  const poId = randomUUID();
  await sql`
    insert into purchase_orders (
      id, company_id, po_number, series_prefix, fiscal_year, po_date, vendor_id,
      quote_number, vendor_contact_person, vendor_contact_phone, bill_to_snapshot, ship_to_snapshot,
      currency, gst_rate, subtotal, gst_amount, grand_total, amount_in_words,
      delivery_timeline, payment_terms, payment_terms_type, payment_terms_days,
      service_validity, terms_and_conditions, line_item_columns, status, requested_approver_id, created_by, updated_by
    )
    values (
      ${poId}, ${company.id}, ${poNumber}, ${input.category}, ${fiscalYear}, ${input.poDate}, ${vendorId},
      ${input.quoteNumber || null}, ${input.contactPerson || null}, ${input.contactPhone || null},
      ${jsonb(billToSnapshot)}::jsonb, ${shipToSnapshot ? jsonb(shipToSnapshot) : null}::jsonb,
      'INR', ${input.gstRate}, ${subtotal}, ${gstAmount}, ${grandTotal}, ${amountInWords},
      ${input.deliveryTimeline}, ${input.paymentTerms}, ${input.paymentTermsType ?? null}, ${input.paymentTermsDays ?? null},
      'As per principal', ${input.termsAndConditions}, ${jsonb(input.lineItemColumns as any)}::jsonb,
      ${effectiveStatus}, ${requestedApprover?.id ?? null}, ${user.id}, ${user.id}
    )
  `;
  for (const row of rows) {
    await sql`
      insert into po_line_items (
        po_id, sort_order, description, part_code, qty, unit_price, total_price,
        term_start_date, term_end_date, custom_fields
      )
      values (
        ${poId}, ${row.sort_order}, ${row.description}, ${row.part_code}, ${row.qty}, ${row.unit_price},
        ${row.total_price}, ${row.term_start_date}, ${row.term_end_date}, ${jsonb(row.custom_fields as any)}::jsonb
      )
    `;
  }
  await sql`
    insert into po_audit_log (po_id, changed_by, action, diff)
    values (
      ${poId},
      ${user.id},
      ${effectiveStatus === 'draft' ? 'saved_draft' : effectiveStatus === 'pending_approval' ? 'submitted_for_approval' : 'created'},
      ${jsonb({ po_number: poNumber, grand_total: grandTotal, status: effectiveStatus })}::jsonb
    )
  `;

  if (effectiveStatus === 'pending_approval') {
    const { subject, html } = buildPendingApprovalEmail({
      adminName: requestedApprover!.full_name,
      requesterName: user.full_name,
      poNumber,
      vendorName: vendor.name,
      grandTotal,
      currency: 'INR',
    });
    await sendEmail({ to: requestedApprover!.email, subject, html }).catch((error) => {
      console.error(`Pending approval email failed for selected admin ${requestedApprover!.id}`, error);
    });
  }

  revalidatePath('/dashboard');
  redirect(`/po/${poId}`);
}
