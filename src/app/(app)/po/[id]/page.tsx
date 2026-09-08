import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { resolveColumns, getLineItemValue, formatLineItemValue, NUMERIC_KEYS } from '@/lib/line-items';
import { parseJsonValue } from '@/lib/json';
import { formatPhone } from '@/lib/phone';
import { approvePurchaseOrder } from './actions';
import PrintButton from '@/components/PrintButton';
import DeletePoButton from './DeletePoButton';
import RejectPoButton from './RejectPoButton';
import PaymentsSection from './PaymentsSection';
import SubmitButton from '@/components/SubmitButton';

export default async function PoDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();

  // Three queries here — profile, the PO itself, and its line items — none
  // of them actually need each other's results (line items only needs
  // params.id, the same value the PO query uses, not po.id from a
  // resolved PO row). Running them one after another was paying for three
  // full round-trips in sequence for no reason; Promise.all collapses that
  // to the time of the single slowest one.
  const [poRows, lineItems, payments] = await Promise.all([
    sql`
      select
        p.*,
        to_jsonb(v.*) as vendors,
        case when creator.id is null then null else jsonb_build_object('full_name', creator.full_name, 'phone', creator.phone) end as creator,
        case when requested_approver.id is null then null else jsonb_build_object('full_name', requested_approver.full_name) end as requested_approver,
        case when approver.id is null then null else jsonb_build_object('full_name', approver.full_name) end as approver,
        case when deleter.id is null then null else jsonb_build_object('full_name', deleter.full_name) end as deleter,
        case when rejecter.id is null then null else jsonb_build_object('full_name', rejecter.full_name) end as rejecter
      from purchase_orders p
      join vendors v on v.id = p.vendor_id
      left join profiles creator on creator.id = p.created_by
      left join profiles requested_approver on requested_approver.id = p.requested_approver_id
      left join profiles approver on approver.id = p.approved_by
      left join profiles deleter on deleter.id = p.deleted_by
      left join profiles rejecter on rejecter.id = p.rejected_by
      where p.id = ${params.id}
        and p.company_id = ${user.company_id}
      limit 1
    `,
    sql`select * from po_line_items where po_id = ${params.id} order by sort_order`,
    sql`
      select
        pay.*,
        case when recorder.id is null then null else jsonb_build_object('full_name', recorder.full_name) end as recorder
      from po_payments pay
      left join profiles recorder on recorder.id = pay.recorded_by
      join purchase_orders p on p.id = pay.po_id
      where pay.po_id = ${params.id}
        and p.company_id = ${user.company_id}
      order by pay.recorded_at desc
    `,
  ]);

  const po = normalizePo(poRows[0]);
  const normalizedLineItems = lineItems.map(normalizeLineItem);
  const isAdmin = user.role === 'admin';
  if (!po) notFound();
  const isDeleted = Boolean(po.deleted_at);
  const columns = resolveColumns(po.line_item_columns);

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5 print:hidden">
        <a href="/dashboard" className="text-xs font-semibold text-muted hover:text-navy">
          ← Back to Dashboard
        </a>
        <div className="flex gap-2">
          {!isDeleted && (
            <a href={`/po/new?clone=${po.id}`} className="btn btn-outline text-xs px-3.5 py-1.5">
              Duplicate
            </a>
          )}
          {isAdmin && !isDeleted && (
            <a href={`/po/${po.id}/edit`} className="btn btn-outline text-xs px-3.5 py-1.5">
              Edit (Admin)
            </a>
          )}
          <PrintButton />
          <a href={`/api/po/${po.id}/pdf`} className="btn btn-primary text-xs px-3.5 py-1.5" target="_blank">
            Download PDF
          </a>
          {isAdmin && !isDeleted && <DeletePoButton poId={po.id} poNumber={po.po_number} />}
        </div>
      </div>

      {isDeleted && (
        <div className="max-w-3xl mx-auto flex items-center gap-2 bg-[#F5E6E4] border border-danger/20 rounded-lg px-4 py-3 mb-3.5 print:hidden">
          <div className="text-[13px]">
            <span className="font-semibold text-danger">This PO has been deleted.</span>{' '}
            {po.deleter?.full_name && `By ${po.deleter.full_name}`}
            {po.deleted_at && ` on ${new Date(po.deleted_at).toLocaleDateString('en-IN')}`}
            {' — it no longer appears on the dashboard or in search, but this record and its full history are preserved.'}
          </div>
        </div>
      )}

      {po.status === 'pending_approval' && (
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 bg-[#EEF1FA] border border-navy/15 rounded-lg px-4 py-3 mb-3.5 print:hidden">
          <div className="text-[13px]">
            <span className="font-semibold">Admin approval pending.</span>{' '}
            {po.requested_approver?.full_name
              ? `Approval request sent to ${po.requested_approver.full_name}.`
              : isAdmin
              ? 'This PO is awaiting Admin approval.'
              : "You'll see this update once an Admin approves it."}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <RejectPoButton poId={po.id} />
              <form action={approvePurchaseOrder.bind(null, po.id)}>
                <SubmitButton className="btn btn-primary text-xs px-3.5 py-1.5" pendingText="Approving...">
                  Approve This PO
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      )}
      {po.status === 'issued' && po.approver?.full_name && (
        <div className="max-w-3xl mx-auto text-[11.5px] text-muted mb-3.5 print:hidden">
          Approved by {po.approver.full_name}
          {po.approved_at ? ` on ${new Date(po.approved_at).toLocaleDateString('en-IN')}` : ''}.
        </div>
      )}
      {po.status === 'draft' && po.rejection_reason && (
        <div className="max-w-3xl mx-auto bg-[#F5E6E4] border border-danger/20 rounded-lg px-4 py-3 mb-3.5 print:hidden">
          <div className="text-[13px]">
            <span className="font-semibold text-danger">Sent back for changes</span>
            {po.rejecter?.full_name && ` by ${po.rejecter.full_name}`}
            {po.rejected_at ? ` on ${new Date(po.rejected_at).toLocaleDateString('en-IN')}` : ''}.
          </div>
          <div className="text-[12.5px] mt-1">&ldquo;{po.rejection_reason}&rdquo;</div>
          <div className="text-[11px] text-muted mt-1.5">
            Ask an Admin to edit this draft, or use Duplicate above to submit a corrected version.
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto bg-white border border-border shadow-md p-8 relative overflow-hidden print:max-w-none print:border-0 print:shadow-none print:p-0 print:mx-0">
        <div
          className="absolute pointer-events-none font-display font-semibold leading-none"
          style={{ right: -30, bottom: -90, fontSize: 280, color: 'rgba(20,33,61,0.025)' }}
        >
          D
        </div>
        {po.status !== 'issued' && (
          <div className="po-watermark-layer absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute left-8 right-8 top-16 bottom-16 grid -rotate-[34deg] grid-cols-3 content-between gap-x-8 print:left-10 print:right-10 print:top-20 print:bottom-20">
              {Array.from({ length: 21 }).map((_, index) => (
                <div
                  key={index}
                  className="po-watermark-text whitespace-nowrap font-display text-[28px] font-medium uppercase leading-none print:text-[23px]"
                  style={{ color: 'rgba(217, 92, 92, 0.2)' }}
                >
                  NOT APPROVED
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="relative z-10">
          {po.status !== 'issued' && (
            <div className="bg-[#F5E6E4] border border-danger rounded-md px-4 py-2.5 mb-4 text-center">
              <span className="text-danger font-bold text-xs uppercase tracking-wide">
                {po.status === 'pending_approval'
                  ? '⚠ This Purchase Order is pending Admin approval and has not been verified'
                  : po.status === 'draft'
                  ? '⚠ This is a draft and has not been issued'
                  : `⚠ Status: ${po.status}`}
              </span>
            </div>
          )}
          <div className="flex justify-between items-start border-b-2 border-navy pb-4 mb-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-pdf.png" alt="DCIPHERS logo" className="w-12 h-auto shrink-0" />
              <div>
                <div className="font-bold text-[15px]">{po.bill_to_snapshot?.name}</div>
                <div className="text-[11.5px] text-muted mt-0.5 leading-relaxed">{po.bill_to_snapshot?.address}</div>
                {(po.bill_to_snapshot?.contact_phone || po.bill_to_snapshot?.contact_email) && (
                  <div className="text-[11.5px] text-muted mt-0.5">
                    {po.bill_to_snapshot?.contact_phone}
                    {po.bill_to_snapshot?.contact_phone && po.bill_to_snapshot?.contact_email ? ' · ' : ''}
                    {po.bill_to_snapshot?.contact_email}
                  </div>
                )}
                <a href="https://www.dciphers.com/" target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-ink mt-0.5 block hover:underline">
                  www.dciphers.com
                </a>
              </div>
            </div>
            <div className="text-right text-[11.5px] shrink-0 pl-4">
              <div className="font-mono font-bold text-[13px]">{po.po_number}</div>
              <div className="text-muted mt-0.5">PO Date: {new Date(po.po_date).toLocaleDateString('en-IN')}</div>
              <div className="text-muted">Currency: {po.currency}</div>
            </div>
          </div>

          <div className="mb-4 text-xs">
            <div className="font-bold uppercase tracking-wide text-[10.5px] text-muted mb-1">Vendor</div>
            <div className="font-semibold">{po.vendors?.name}</div>
            <div className="text-muted mt-0.5">{po.vendors?.address}</div>
            {po.vendors?.gstin && <div className="font-mono text-muted mt-0.5">GSTIN: {po.vendors.gstin}</div>}
            {po.vendors?.pan && <div className="font-mono text-muted">PAN: {po.vendors.pan}</div>}
            {po.vendor_contact_person && <div className="text-muted mt-0.5">Contact Person: {po.vendor_contact_person}</div>}
            {po.vendor_contact_phone && <div className="text-muted mt-0.5">Phone Number: {formatPhone(po.vendor_contact_phone)}</div>}
            {po.quote_number && <div className="text-muted mt-0.5">Quote #: {po.quote_number}</div>}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-5 text-xs">
            <div>
              <div className="font-bold uppercase tracking-wide text-[10.5px] text-muted mb-1">Bill To</div>
              <div className="font-semibold">{po.bill_to_snapshot?.name}</div>
              <div className="text-muted mt-0.5">{po.bill_to_snapshot?.address}</div>
              {po.bill_to_snapshot?.gstin && <div className="font-mono text-muted mt-0.5">GSTIN: {po.bill_to_snapshot.gstin}</div>}
              {po.bill_to_snapshot?.pan && <div className="font-mono text-muted">PAN: {po.bill_to_snapshot.pan}</div>}
            </div>
            <div>
              <div className="font-bold uppercase tracking-wide text-[10.5px] text-muted mb-1">Ship To</div>
              {(() => {
                const ship = po.ship_to_snapshot ?? po.bill_to_snapshot;
                return (
                  <>
                    <div className="font-semibold">{ship?.name}</div>
                    <div className="text-muted mt-0.5">{ship?.address}</div>
                    {ship?.gstin && <div className="font-mono text-muted mt-0.5">GSTIN: {ship.gstin}</div>}
                    {ship?.pan && <div className="font-mono text-muted">PAN: {ship.pan}</div>}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="mb-3.5 overflow-x-auto">
          <table className="ledger w-full text-xs min-w-[700px]">
            <thead>
              <tr>
                <th className="text-center">S.No</th>
                {columns.map((c) => (
                  <th key={c.key} className="text-center">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalizedLineItems.map((li: any, rowIndex: number) => (
                <tr key={li.id} className={rowIndex % 2 === 1 ? 'bg-[#FBFBFC]' : ''}>
                  <td className="text-center">{rowIndex + 1}</td>
                  {columns.map((c, i) => (
                    <td key={c.key} className={c.key === 'qty' ? 'text-center font-mono' : NUMERIC_KEYS.has(c.key) ? 'text-right font-mono' : i === 0 ? 'text-justify' : ''}>
                      {formatLineItemValue(c.key, getLineItemValue(li, c.key))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="mb-4 flex justify-end">
            <div className="w-60 text-xs">
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <span className="font-mono">{fmt(po.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>GST @ {po.gst_rate}%</span>
                <span className="font-mono">{fmt(po.gst_amount)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold border-t border-border">
                <span>Grand Total</span>
                <span className="font-mono">{fmt(po.grand_total)}</span>
              </div>
            </div>
          </div>

          <div className="mb-5 text-[11px] text-muted">Value in words: {po.amount_in_words}</div>

          <div className="mb-5">
            <div className="font-bold uppercase tracking-wide text-[10.5px] text-muted mb-1.5">Terms &amp; Conditions</div>
            <div className="text-[10.5px] text-muted leading-relaxed space-y-1">
              <div>1. Purchase Order no &amp; date shall be mentioned along with each item on the invoice.</div>
              <div>2. HSN/SAC code and item code as per P.O for each item shall be mentioned on the invoice.</div>
              <div>3. Service Provider shall acknowledge the receipt of PO through e-mail within 3 (three) days of receipt of PO, failing which PO shall be considered as acknowledged.</div>
              <div>4. The license and/or support documentation, along with the tax invoice, must be submitted to operations@dciphers.com</div>
              <div>5. Material to be delivered shall accompany a copy of Purchase Order.</div>
              {po.terms_and_conditions && po.terms_and_conditions.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                <div key={i}>{6 + i}. {line}</div>
              ))}
            </div>
          </div>

          <div className="mb-5 flex gap-6 border-t border-border pt-3">
            <div className="flex-1 text-[11.5px] text-muted leading-relaxed">
              <div>Invoice to be raised on :</div>
              <div className="font-bold">DCIPHERS IT SOLUTIONS PVT. LTD.</div>
              {po.payment_terms && <div className="mt-2">Payment Terms: {po.payment_terms}</div>}
              {po.delivery_timeline && <div>Delivery: {po.delivery_timeline}</div>}
              {po.service_validity && <div>Service Validity: {po.service_validity}</div>}
              {po.creator?.full_name && (
                <div className="mt-2">
                  Ordered By:<br />
                  <span className="font-bold">{po.creator.full_name}</span>
                  {po.creator.phone ? ` (${formatPhone(po.creator.phone)})` : ''}
                  <br />DCIPHERS IT SOLUTIONS PVT. LTD.
                </div>
              )}
            </div>
          </div>

          <div className="text-[8px] text-muted mt-6 pt-3 border-t border-border">
            This is a system-generated Purchase Order.
          </div>
        </div>
      </div>

      {!isDeleted && po.status === 'issued' && payments !== null && (
        <PaymentsSection
          poId={po.id}
          grandTotal={Number(po.grand_total)}
          poDate={po.po_date}
          paymentTermsType={po.payment_terms_type}
          paymentTermsDays={po.payment_terms_days}
          isAdmin={isAdmin}
          payments={payments as any}
        />
      )}
    </div>
  );
}

function normalizePo(po: any): any {
  if (!po) return null;
  return {
    ...po,
    vendors: parseJsonValue(po.vendors, null),
    creator: parseJsonValue(po.creator, null),
    approver: parseJsonValue(po.approver, null),
    requested_approver: parseJsonValue(po.requested_approver, null),
    deleter: parseJsonValue(po.deleter, null),
    rejecter: parseJsonValue(po.rejecter, null),
    bill_to_snapshot: parseJsonValue(po.bill_to_snapshot, null),
    ship_to_snapshot: parseJsonValue(po.ship_to_snapshot, null),
    line_item_columns: parseJsonValue(po.line_item_columns, null),
  };
}

function normalizeLineItem(lineItem: any) {
  return {
    ...lineItem,
    custom_fields: parseJsonValue(lineItem.custom_fields, {}),
  };
}

function fmt(n: number) {
  return '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
