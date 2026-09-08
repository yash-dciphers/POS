import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import StatCard from '@/components/StatCard';
import Badge from '@/components/Badge';
import RenewalAlerts, { type RenewalItem } from '@/components/RenewalAlerts';
import PendingApprovalAlert, { type PendingApprovalItem } from '@/components/PendingApprovalAlert';
import AdminPasswordReminder from '@/components/AdminPasswordReminder';
import ExportExcelButton from '@/components/ExportExcelButton';
import MonthlyPoChart, { type MonthlyDataPoint } from '@/components/MonthlyPoChart';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; mine?: string };
}) {
  const user = await requireUser();

  // Profile, company settings, and the main PO list are independent of
  // each other. The renewal line-items query is NOT independent — it
  // needs the company's configured renewal window before it can even
  // build its date filter — so it has to wait for this batch first.
  const [companyRows, pos] = await Promise.all([
    sql`select renewal_window_days, renewal_urgent_days from companies where id = ${user.company_id} limit 1`,
    sql`
      select
        p.id, p.po_number, p.po_date, p.subtotal, p.grand_total, p.status, p.created_by,
        jsonb_build_object('name', v.name) as vendors
      from purchase_orders p
      join vendors v on v.id = p.vendor_id
      where p.company_id = ${user.company_id}
        and p.deleted_at is null
      order by p.created_at desc
    `,
  ]);

  const company = companyRows[0];
  const renewalWindowDays = company?.renewal_window_days ?? 90;
  const renewalUrgentDays = company?.renewal_urgent_days ?? 30;

  const today = new Date();
  const windowOut = new Date();
  windowOut.setDate(today.getDate() + renewalWindowDays);

  const upcomingLineItems = await sql`
    select
      li.id, li.description, li.term_end_date,
      jsonb_build_object(
        'id', p.id,
        'po_number', p.po_number,
        'status', p.status,
        'deleted_at', p.deleted_at,
        'vendors', jsonb_build_object('name', v.name)
      ) as purchase_orders
    from po_line_items li
    join purchase_orders p on p.id = li.po_id
    join vendors v on v.id = p.vendor_id
    where p.company_id = ${user.company_id}
      and li.term_end_date is not null
      and li.term_end_date <= ${windowOut.toISOString().slice(0, 10)}
    order by li.term_end_date asc
  `;

  const isAdmin = user.role === 'admin';
  const all = pos ?? [];
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const statusFilter = searchParams.status ?? '';
  const mineOnly = searchParams.mine === '1';

  // Filtered in memory rather than in SQL: at ~70-80 POs/year this dataset
  // never gets large enough for that to matter, and it lets one query cover
  // search across both po_number and the joined vendor name without a
  // separate database function.
  const rows = all.filter((po: any) => {
    const matchesQuery =
      !q || po.po_number.toLowerCase().includes(q) || (po.vendors?.name ?? '').toLowerCase().includes(q);
    const matchesStatus = !statusFilter || po.status === statusFilter;
    const matchesMine = !mineOnly || po.created_by === user?.id;
    return matchesQuery && matchesStatus && matchesMine;
  });

  const issued = all.filter((p) => p.status === 'issued').length;
  const pendingApproval = all.filter((p) => p.status === 'pending_approval').length;
  const draft = all.filter((p) => p.status === 'draft').length;
  const calculatedPos = all.filter((p) => p.status === 'issued');
  const totalValue = calculatedPos.reduce((sum, p) => sum + Number(p.subtotal), 0);

  // Built from `all` (already fetched above) — no new query needed. Only
  // ever shown to Admins, since only Admins can act on it.
  const pendingApprovalItems: PendingApprovalItem[] = all
    .filter((p: any) => p.status === 'pending_approval')
    .map((p: any) => ({ id: p.id, poNumber: p.po_number, vendorName: p.vendors?.name ?? '—', grandTotal: Number(p.grand_total) }));

  // Renewal reminders: any line item with a term end date in the next 90
  // days, on an issued (not draft/cancelled) PO. Filtered in memory for the
  // same reason as above — small dataset, and it avoids relying on
  // PostgREST's embedded-filter syntax for the joined status check.
  const todayStr = today.toISOString().slice(0, 10);
  const renewals: RenewalItem[] = (upcomingLineItems ?? [])
    .filter((li: any) => li.purchase_orders?.status === 'issued' && !li.purchase_orders?.deleted_at && li.term_end_date >= todayStr)
    .map((li: any) => {
      const daysRemaining = Math.ceil((new Date(li.term_end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        lineItemId: li.id,
        poId: li.purchase_orders.id,
        poNumber: li.purchase_orders.po_number,
        vendorName: li.purchase_orders.vendors?.name ?? '—',
        description: li.description,
        termEndDate: li.term_end_date,
        daysRemaining,
      };
    });

  // Last 6 months, oldest to newest, counting issued POs by po_date. Built
  // from `all` (already fetched above) rather than a separate query.
  const monthlyData: MonthlyDataPoint[] = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setDate(1); // avoid month-length rollover issues when subtracting months
    d.setMonth(d.getMonth() - (5 - i));
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const inMonth = all.filter((po: any) => {
      const poDate = new Date(po.po_date);
      return `${poDate.getFullYear()}-${poDate.getMonth()}` === monthKey && po.status === 'issued';
    });
    return {
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      count: inMonth.length,
      value: inMonth.reduce((sum: number, p: any) => sum + Number(p.grand_total), 0),
    };
  });

  return (
    <div>
      {user.password_set_by_admin && <AdminPasswordReminder sessionId={user.session_id} />}
      {isAdmin && <PendingApprovalAlert items={pendingApprovalItems} />}
      <RenewalAlerts renewals={renewals} urgentThresholdDays={renewalUrgentDays} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-3.5">
        <StatCard label="POs this FY" value={calculatedPos.length} accent="navy" delay={0} href="/dashboard" />
        <StatCard label="Total value (excl. GST)" value={totalValue} format="currency" accent="gold" delay={50} />
        <StatCard label="Issued" value={issued} accent="success" delay={100} href="/dashboard?status=issued" />
        <StatCard label="Pending Approval" value={pendingApproval} accent="ink" delay={150} href="/dashboard?status=pending_approval" />
        <StatCard label="Draft" value={draft} accent="warn" delay={200} href="/dashboard?status=draft" />
      </div>

      <div className="mb-6">
        <MonthlyPoChart data={monthlyData} />
      </div>

      <div className="card overflow-hidden">
        <form className="p-4 flex items-center justify-between border-b border-border gap-2.5 flex-wrap">
          <div className="flex gap-2">
            <input
              className="input max-w-xs"
              name="q"
              defaultValue={searchParams.q}
              placeholder="Search PO number, vendor…"
            />
            <select className="input max-w-[160px]" name="status" defaultValue={searchParams.status ?? ''}>
              <option value="">All statuses</option>
              <option value="issued">Issued</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted px-1">
              <input type="checkbox" name="mine" value="1" defaultChecked={mineOnly} />
              My POs only
            </label>
            <button className="btn btn-outline text-xs">Filter</button>
          </div>
          <div className="flex gap-2">
            <ExportExcelButton
              rows={rows.map((po: any) => ({
                po_number: po.po_number,
                po_date: po.po_date,
                vendor_name: po.vendors?.name ?? '',
                subtotal: po.subtotal,
                grand_total: po.grand_total,
                status: po.status,
              }))}
              filename={`dciphers-pos-${new Date().toISOString().slice(0, 10)}.xlsx`}
            />
            <Link href="/po/new" className="btn btn-gold">
              + Generate New Purchase Order
            </Link>
          </div>
        </form>
        <table className="ledger w-full">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Date</th>
              <th>Vendor</th>
              <th className="text-right">Subtotal</th>
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
                <td>{po.vendors?.name}</td>
                <td className="text-right font-mono">{fmt(po.subtotal)}</td>
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
                <td colSpan={7} className="py-14">
                  {all.length === 0 ? (
                    <div className="flex flex-col items-center text-center animate-fade-in-up">
                      <div className="w-14 h-14 rounded-full bg-[#EEF1FA] flex items-center justify-center mb-3.5">
                        <svg viewBox="0 0 24 24" width={26} height={26} stroke="var(--navy)" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                          <line x1="12" y1="12.5" x2="12" y2="18" />
                          <line x1="9" y1="15.25" x2="15" y2="15.25" />
                        </svg>
                      </div>
                      <div className="text-sm font-semibold mb-1">No purchase orders yet</div>
                      <div className="text-xs text-muted mb-4 max-w-xs">
                        Every PO you issue, numbered correctly and calculated for you, will show up right here.
                      </div>
                      <Link href="/po/new" className="btn btn-gold">
                        + Generate Your First Purchase Order
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center text-muted text-sm">No POs match that search.</div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
