import { notFound } from 'next/navigation';
import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import Badge from '@/components/Badge';

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();

  const [vendorRows, pos] = await Promise.all([
    sql`select * from vendors where id = ${params.id} and company_id = ${user.company_id} limit 1`,
    sql`
      select id, po_number, po_date, subtotal, grand_total, status
      from purchase_orders
      where vendor_id = ${params.id}
        and company_id = ${user.company_id}
        and deleted_at is null
      order by po_date desc
    `,
  ]);
  const vendor = vendorRows[0];
  if (!vendor) notFound();

  const rows = pos;
  const issuedRows = rows.filter((p) => p.status === 'issued');
  const totalSpend = issuedRows.reduce((sum, p) => sum + Number(p.grand_total), 0);
  const pendingCount = rows.filter((p) => p.status === 'pending_approval').length;
  const draftCount = rows.filter((p) => p.status === 'draft').length;

  return (
    <div className="min-w-0 space-y-5">
      <Link href="/vendors" className="text-xs font-semibold text-muted hover:text-navy mb-3.5 inline-block">
        ← Back to Vendor Repository
      </Link>

      <section className="card overflow-hidden">
        <div className="border-b border-border bg-[#FAFBFC] p-5 sm:p-6">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">Vendor overview</div>
          <h1 className="break-words text-xl font-semibold leading-snug text-navy sm:text-2xl">{vendor.name}</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted">Vendor information and purchase order history</p>
        </div>
        <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-[2fr_1fr_1fr]">
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">Registered address</dt>
            <dd className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed">{vendor.address || 'Not provided'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">GSTIN</dt>
            <dd className="mt-2 break-all font-mono text-sm">{vendor.gstin || 'Not provided'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">PAN</dt>
            <dd className="mt-2 break-all font-mono text-sm">{vendor.pan || 'Not provided'}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Vendor spend summary" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-[10px] bg-navy p-5 text-white">
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/70">Issued PO value</div>
          <div className="mt-3 break-words font-mono text-xl font-semibold tabular-nums" style={{ overflowWrap: 'anywhere' }}>{fmt(totalSpend)}</div>
          <div className="mt-2 text-[11px] leading-relaxed text-white/70">Includes GST · not payments made</div>
        </div>
        {[
          { label: 'Issued orders', value: issuedRows.length, note: 'Included in the value above' },
          { label: 'Awaiting approval', value: pendingCount, note: `${draftCount} draft${draftCount === 1 ? '' : 's'} also in progress` },
          { label: 'All purchase orders', value: rows.length, note: 'Includes drafts and cancelled orders' },
        ].map((stat) => (
          <div key={stat.label} className="card min-w-0 p-5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{stat.label}</div>
            <div className="mt-3 font-mono text-2xl font-semibold text-navy">{stat.value}</div>
            <div className="mt-2 text-[11px] leading-relaxed text-muted">{stat.note}</div>
          </div>
        ))}
      </section>

        <section className="card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-5">
            <div>
              <h2 className="font-display text-base font-semibold text-navy">Purchase orders</h2>
              <p className="mt-1 text-xs text-muted">Most recent first · {rows.length} order{rows.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-semibold text-navy">No purchase orders yet</p>
              <p className="mt-2 text-sm text-muted">Orders for this vendor will appear here once created.</p>
            </div>
          ) : (
          <>
          <div className="divide-y divide-border lg:hidden">
            {rows.map((po: any) => (
              <article key={po.id} className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">{formatDate(po.po_date)}</span>
                  <Badge status={po.status} />
                </div>
                <Link href={`/po/${po.id}`} className="block break-all font-mono text-sm font-semibold text-navy hover:underline">{po.po_number}</Link>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted">Total including GST</div>
                    <div className="mt-1 break-all font-mono text-base font-semibold">{fmt(po.grand_total)}</div>
                  </div>
                  <Link href={`/po/${po.id}`} className="inline-flex min-h-10 items-center text-xs font-semibold text-ink hover:underline">View order →</Link>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[680px] text-sm [&_th]:px-5 [&_th]:py-3 [&_th]:text-left [&_th]:text-[10px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted [&_td]:px-5 [&_td]:py-4">
            <thead>
              <tr className="border-b border-border bg-[#FAFBFC]">
                <th>PO Number</th>
                <th>Date</th>
                <th className="!text-right">Total incl. GST</th>
                <th>Status</th>
                <th><span className="sr-only">View order</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((po: any) => (
                <tr key={po.id} className="border-b border-border last:border-0 hover:bg-[#FAFBFC]">
                  <td className="max-w-[300px] break-words font-mono text-xs font-semibold"><Link href={`/po/${po.id}`} className="text-navy hover:underline">{po.po_number}</Link></td>
                  <td className="whitespace-nowrap text-xs text-muted">{formatDate(po.po_date)}</td>
                  <td className="whitespace-nowrap text-right font-mono font-semibold">{fmt(po.grand_total)}</td>
                  <td>
                    <Badge status={po.status} />
                  </td>
                  <td>
                    <Link href={`/po/${po.id}`} className="whitespace-nowrap text-xs font-semibold text-ink hover:underline">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
          )}
        </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmt(n: number) {
  return '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
