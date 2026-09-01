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

  return (
    <div>
      <Link href="/vendors" className="text-xs font-semibold text-muted hover:text-navy mb-3.5 inline-block">
        ← Back to Vendor Repository
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 items-start">
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-display text-[15px]">Purchase Orders with {vendor.name}</h2>
          </div>
          <table className="ledger w-full">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Date</th>
                <th className="text-right">Grand Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((po: any) => (
                <tr key={po.id} className="row-hover">
                  <td className="font-mono font-semibold">{po.po_number}</td>
                  <td className="font-mono">{new Date(po.po_date).toLocaleDateString('en-IN')}</td>
                  <td className="text-right font-mono font-semibold">{fmt(po.grand_total)}</td>
                  <td>
                    <Badge status={po.status} />
                  </td>
                  <td>
                    <Link href={`/po/${po.id}`} className="text-xs font-semibold text-muted hover:text-navy">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-8">
                    No purchase orders issued to this vendor yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3.5">
          <div className="card p-4.5">
            <div className="text-[11px] uppercase tracking-wide text-muted font-bold mb-2.5">Vendor Details</div>
            <div className="text-sm font-semibold mb-1">{vendor.name}</div>
            {vendor.address && <div className="text-xs text-muted mb-1">{vendor.address}</div>}
            {vendor.gstin && <div className="text-xs font-mono text-muted mb-0.5">GSTIN: {vendor.gstin}</div>}
            {vendor.pan && <div className="text-xs font-mono text-muted mb-0.5">PAN: {vendor.pan}</div>}
          </div>

          <div className="card p-4.5">
            <div className="text-[11px] uppercase tracking-wide text-muted font-bold mb-2.5">Spend Summary</div>
            <div className="flex justify-between py-1.5 text-sm border-b border-border">
              <span>Issued POs</span>
              <span className="font-mono font-semibold">{issuedRows.length}</span>
            </div>
            <div className="flex justify-between py-1.5 text-sm border-b border-border">
              <span>All POs (incl. drafts)</span>
              <span className="font-mono">{rows.length}</span>
            </div>
            <div className="flex justify-between py-2 text-[14.5px] font-bold pt-2.5">
              <span>Total Spend</span>
              <span className="font-mono">{fmt(totalSpend)}</span>
            </div>
            <div className="text-[10.5px] text-muted mt-1">Total spend counts issued POs only, excluding drafts and cancelled.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
