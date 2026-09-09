import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { resolveColumns } from '@/lib/line-items';
import { parseJsonValue } from '@/lib/json';
import EditPoForm from './EditPoForm';
import type { LineItemRow } from '@/components/LineItemsEditor';

function toDateInputValue(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export default async function EditPoPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect(`/po/${params.id}`);

  const [po] = await sql`
    select p.*, to_jsonb(v.*) as vendors
    from purchase_orders p
    join vendors v on v.id = p.vendor_id
    where p.id = ${params.id}
      and p.company_id = ${user.company_id}
    limit 1
  `;
  if (!po) notFound();
  const normalizedPo: any = {
    ...po,
    vendors: parseJsonValue(po.vendors, null),
    ship_to_snapshot: parseJsonValue(po.ship_to_snapshot, null),
    line_item_columns: parseJsonValue(po.line_item_columns, null),
  };
  if (normalizedPo.deleted_at) redirect(`/po/${params.id}`);

  const [lineItemRows, companyRows] = await Promise.all([
    sql`select * from po_line_items where po_id = ${normalizedPo.id} order by sort_order`,
    sql`select default_gst_rate from companies where id = ${user.company_id} limit 1`,
  ]);
  const company = companyRows[0];

  const columns = resolveColumns(normalizedPo.line_item_columns);

  // Reverse the DB row shape (part_code, unit_price, total_price,
  // custom_fields) back into the flat shape the line-items editor works
  // with (partCode, unitPrice, total, ...custom fields spread directly).
  const lineItems: LineItemRow[] = (lineItemRows ?? []).map((li: any) => ({
    ...parseJsonValue(li.custom_fields, {}),
    description: li.description,
    partCode: li.part_code ?? undefined,
    qty: li.qty,
    unitPrice: li.unit_price,
    total: li.total_price,
    term_start_date: toDateInputValue(li.term_start_date) || undefined,
    term_end_date: toDateInputValue(li.term_end_date) || undefined,
  }));

  return (
    <div>
      <a href={`/po/${normalizedPo.id}`} className="text-xs font-semibold text-muted hover:text-navy mb-3.5 inline-block">
        ← Back to Purchase Order
      </a>
      <EditPoForm
        poId={normalizedPo.id}
        defaultGstRate={company?.default_gst_rate ?? 18}
        existingPoNumber={normalizedPo.po_number}
        initialValues={{
          category: normalizedPo.series_prefix,
          poDate: toDateInputValue(normalizedPo.po_date),
          gstRate: Number(normalizedPo.gst_rate),
          vendor: normalizedPo.vendors,
          quoteNumber: normalizedPo.quote_number ?? '',
          contactPerson: normalizedPo.vendor_contact_person ?? '',
          contactPhone: normalizedPo.vendor_contact_phone ?? '',
          shipSameAsBill: !normalizedPo.ship_to_snapshot,
          shipToDetails: normalizedPo.ship_to_snapshot
            ? {
                name: normalizedPo.ship_to_snapshot.name ?? '',
                address: normalizedPo.ship_to_snapshot.address ?? '',
                gstin: normalizedPo.ship_to_snapshot.gstin ?? '',
                pan: normalizedPo.ship_to_snapshot.pan ?? '',
              }
            : undefined,
          deliveryTimeline: normalizedPo.delivery_timeline ?? '',
          paymentTerms: normalizedPo.payment_terms ?? '',
          paymentTermsType: normalizedPo.payment_terms_type ?? null,
          paymentTermsDays: normalizedPo.payment_terms_days ?? null,
          termsAndConditions: normalizedPo.terms_and_conditions ?? '',
          status: normalizedPo.status,
          lineItems,
          lineItemColumns: columns,
        }}
      />
    </div>
  );
}
