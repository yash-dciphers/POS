import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { resolveColumns } from '@/lib/line-items';
import { parseJsonValue } from '@/lib/json';
import PoCreateForm, { type PoFormInitialValues } from './PoCreateForm';
import type { LineItemRow } from '@/components/LineItemsEditor';

export default async function NewPoPage({ searchParams }: { searchParams: { clone?: string } }) {
  const user = await requireUser();
  const isAdmin = user.role === 'admin';

  const [companyRows, admins] = await Promise.all([
    sql<{ default_gst_rate: number }[]>`select default_gst_rate from companies where id = ${user.company_id} limit 1`,
    sql<{ id: string; full_name: string; email: string }[]>`
      select p.id, p.full_name, u.email
      from profiles p
      join app_users u on u.id = p.id
      where p.company_id = ${user.company_id}
        and p.role = 'admin'
        and u.is_active = true
      order by p.full_name, u.email
    `,
  ]);
  const company = companyRows[0];

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
      const normalizedSource: any = {
        ...source,
        vendors: parseJsonValue(source.vendors, null),
        ship_to_snapshot: parseJsonValue(source.ship_to_snapshot, null),
        line_item_columns: parseJsonValue(source.line_item_columns, null),
      };
      const sourceLineItems = await sql`
        select * from po_line_items where po_id = ${source.id} order by sort_order
      `;

      const lineItems: LineItemRow[] = (sourceLineItems ?? []).map((li: any) => ({
        ...parseJsonValue(li.custom_fields, {}),
        description: li.description,
        partCode: li.part_code ?? undefined,
        qty: li.qty,
        unitPrice: li.unit_price,
        total: li.total_price,
        term_start_date: li.term_start_date ?? undefined,
        term_end_date: li.term_end_date ?? undefined,
      }));

      initialValues = {
        category: normalizedSource.series_prefix,
        poDate: new Date().toISOString().slice(0, 10), // today, not the original date
        gstRate: Number(normalizedSource.gst_rate),
        vendor: normalizedSource.vendors,
        quoteNumber: '', // a duplicate is a new transaction — the old quote almost certainly doesn't apply
        contactPerson: '',
        contactPhone: '',
        shipSameAsBill: !normalizedSource.ship_to_snapshot,
        shipToDetails: normalizedSource.ship_to_snapshot
          ? {
              name: normalizedSource.ship_to_snapshot.name ?? '',
              address: normalizedSource.ship_to_snapshot.address ?? '',
              gstin: normalizedSource.ship_to_snapshot.gstin ?? '',
              pan: normalizedSource.ship_to_snapshot.pan ?? '',
            }
          : undefined,
        deliveryTimeline: normalizedSource.delivery_timeline ?? '',
        paymentTerms: normalizedSource.payment_terms ?? '',
        paymentTermsType: normalizedSource.payment_terms_type ?? null,
        paymentTermsDays: normalizedSource.payment_terms_days ?? null,
        termsAndConditions: normalizedSource.terms_and_conditions ?? '',
        status: 'draft', // a duplicate starts as a draft, never auto-issued
        lineItems,
        lineItemColumns: resolveColumns(normalizedSource.line_item_columns),
      };
      cloneNotice = `Duplicated from ${normalizedSource.po_number} — review before saving. This will get its own new PO number.`;
    }
  }

  return (
    <div>
      {cloneNotice && (
        <div className="text-xs text-navy bg-[#EEF1FA] border border-navy/15 rounded-md px-3.5 py-2.5 mb-4">{cloneNotice}</div>
      )}
      <PoCreateForm defaultGstRate={company?.default_gst_rate ?? 18} initialValues={initialValues} isAdmin={isAdmin} admins={admins} />
    </div>
  );
}
