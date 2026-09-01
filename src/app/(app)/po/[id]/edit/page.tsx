import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { resolveColumns } from '@/lib/line-items';
import EditPoForm from './EditPoForm';
import type { LineItemRow } from '@/components/LineItemsEditor';

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
  if (po.deleted_at) redirect(`/po/${params.id}`);

  const [lineItemRows, companyRows] = await Promise.all([
    sql`select * from po_line_items where po_id = ${po.id} order by sort_order`,
    sql`select default_gst_rate from companies where id = ${user.company_id} limit 1`,
  ]);
  const company = companyRows[0];

  const columns = resolveColumns(po.line_item_columns);

  // Reverse the DB row shape (part_code, unit_price, total_price,
  // custom_fields) back into the flat shape the line-items editor works
  // with (partCode, unitPrice, total, ...custom fields spread directly).
  const lineItems: LineItemRow[] = (lineItemRows ?? []).map((li: any) => ({
    description: li.description,
    partCode: li.part_code ?? undefined,
    qty: li.qty,
    unitPrice: li.unit_price,
    total: li.total_price,
    term_start_date: li.term_start_date ?? undefined,
    term_end_date: li.term_end_date ?? undefined,
    ...(li.custom_fields ?? {}),
  }));

  return (
    <div>
      <a href={`/po/${po.id}`} className="text-xs font-semibold text-muted hover:text-navy mb-3.5 inline-block">
        ← Back to Purchase Order
      </a>
      <EditPoForm
        poId={po.id}
        defaultGstRate={company?.default_gst_rate ?? 18}
        existingPoNumber={po.po_number}
        initialValues={{
          category: po.series_prefix,
          poDate: po.po_date,
          gstRate: Number(po.gst_rate),
          vendor: po.vendors,
          quoteNumber: po.quote_number ?? '',
          contactPerson: po.vendor_contact_person ?? '',
          contactPhone: po.vendor_contact_phone ?? '',
          shipSameAsBill: !po.ship_to_snapshot,
          shipToDetails: po.ship_to_snapshot
            ? {
                name: po.ship_to_snapshot.name ?? '',
                address: po.ship_to_snapshot.address ?? '',
                gstin: po.ship_to_snapshot.gstin ?? '',
                pan: po.ship_to_snapshot.pan ?? '',
              }
            : undefined,
          deliveryTimeline: po.delivery_timeline ?? '',
          paymentTerms: po.payment_terms ?? '',
          paymentTermsType: po.payment_terms_type ?? null,
          paymentTermsDays: po.payment_terms_days ?? null,
          termsAndConditions: po.terms_and_conditions ?? '',
          status: po.status,
          lineItems,
          lineItemColumns: columns,
        }}
      />
    </div>
  );
}
