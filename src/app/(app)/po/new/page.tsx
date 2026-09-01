import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { resolveColumns } from '@/lib/line-items';
import PoCreateForm, { type PoFormInitialValues } from './PoCreateForm';
import type { LineItemRow } from '@/components/LineItemsEditor';

export default async function NewPoPage({ searchParams }: { searchParams: { clone?: string } }) {
  const user = await requireUser();
  const isAdmin = user.role === 'admin';

  const [company] = await sql`select default_gst_rate from companies where id = ${user.company_id} limit 1`;

  let initialValues: PoFormInitialValues | undefined;
  let cloneNotice: string | null = null;

  if (searchParams.clone) {
    const [source] = await sql`
      select p.*, to_jsonb(v.*) as vendors
      from purchase_orders p
      join vendors v on v.id = p.vendor_id
      where p.id = ${searchParams.clone}
        and p.company_id = ${user.company_id}
      limit 1
    `;

    if (source) {
      const sourceLineItems = await sql`
        select * from po_line_items where po_id = ${source.id} order by sort_order
      `;

      const lineItems: LineItemRow[] = (sourceLineItems ?? []).map((li: any) => ({
        description: li.description,
        partCode: li.part_code ?? undefined,
        qty: li.qty,
        unitPrice: li.unit_price,
        total: li.total_price,
        term_start_date: li.term_start_date ?? undefined,
        term_end_date: li.term_end_date ?? undefined,
        ...(li.custom_fields ?? {}),
      }));

      initialValues = {
        category: source.series_prefix,
        poDate: new Date().toISOString().slice(0, 10), // today, not the original date
        gstRate: Number(source.gst_rate),
        vendor: source.vendors,
        quoteNumber: '', // a duplicate is a new transaction — the old quote almost certainly doesn't apply
        contactPerson: '',
        contactPhone: '',
        shipSameAsBill: !source.ship_to_snapshot,
        shipToDetails: source.ship_to_snapshot
          ? {
              name: source.ship_to_snapshot.name ?? '',
              address: source.ship_to_snapshot.address ?? '',
              gstin: source.ship_to_snapshot.gstin ?? '',
              pan: source.ship_to_snapshot.pan ?? '',
            }
          : undefined,
        deliveryTimeline: source.delivery_timeline ?? '',
        paymentTerms: source.payment_terms ?? '',
        paymentTermsType: source.payment_terms_type ?? null,
        paymentTermsDays: source.payment_terms_days ?? null,
        termsAndConditions: source.terms_and_conditions ?? '',
        status: 'draft', // a duplicate starts as a draft, never auto-issued
        lineItems,
        lineItemColumns: resolveColumns(source.line_item_columns),
      };
      cloneNotice = `Duplicated from ${source.po_number} — review before saving. This will get its own new PO number.`;
    }
  }

  return (
    <div>
      {cloneNotice && (
        <div className="text-xs text-navy bg-[#EEF1FA] border border-navy/15 rounded-md px-3.5 py-2.5 mb-4">{cloneNotice}</div>
      )}
      <PoCreateForm defaultGstRate={company?.default_gst_rate ?? 18} initialValues={initialValues} isAdmin={isAdmin} />
    </div>
  );
}
