import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';

const ACTION_LABELS: Record<string, string> = {
  created: 'Purchase Order Created',
  saved_draft: 'Draft Saved',
  submitted_for_approval: 'Submitted for Approval',
  approved: 'Purchase Order Approved',
  rejected: 'Returned for Revision',
  deleted: 'Purchase Order Deleted',
  updated: 'Purchase Order Updated',
  payment_recorded: 'Payment Recorded',
  payment_updated: 'Payment Updated',
  payment_removed: 'Payment Removed',
};

const ACTION_STYLES: Record<string, string> = {
  created: 'bg-[#E9F5EE] text-success border-success/20',
  saved_draft: 'bg-[#FBF2DF] text-warn border-warn/25',
  submitted_for_approval: 'bg-[#EDF0F8] text-ink border-ink/25',
  approved: 'bg-[#E9F5EE] text-success border-success/20',
  rejected: 'bg-[#F5E6E4] text-danger border-danger/20',
  deleted: 'bg-[#F5E6E4] text-danger border-danger/20',
  updated: 'bg-[#EDEEF2] text-muted border-border',
  payment_recorded: 'bg-[#E9F5EE] text-success border-success/20',
  payment_updated: 'bg-[#EDF0F8] text-ink border-ink/25',
  payment_removed: 'bg-[#F5E6E4] text-danger border-danger/20',
};

function formatAction(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function AuditLogPage() {
  const user = await requireUser();
  const entries = await sql`
    select
      a.*,
      jsonb_build_object('po_number', po.po_number) as purchase_orders,
      case when p.id is null then null else jsonb_build_object('full_name', p.full_name) end as profiles
    from po_audit_log a
    join purchase_orders po on po.id = a.po_id
    left join profiles p on p.id = a.changed_by
    where po.company_id = ${user.company_id}
    order by a.changed_at desc
    limit 100
  `;

  return (
    <table className="ledger w-full card">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Actor</th>
          <th>PO Number</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e: any) => (
          <tr key={e.id}>
            <td className="font-mono">{new Date(e.changed_at).toLocaleString('en-IN')}</td>
            <td>{e.profiles?.full_name ?? <span className="text-muted italic">Removed user</span>}</td>
            <td className="font-mono">{e.purchase_orders?.po_number}</td>
            <td>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ACTION_STYLES[e.action] ?? 'bg-[#EDEEF2] text-muted border-border'}`}>
                {formatAction(e.action)}
              </span>
            </td>
          </tr>
        ))}
        {entries.length === 0 && (
          <tr>
            <td colSpan={4} className="text-center text-muted py-8">No activity logged yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
