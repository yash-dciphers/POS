import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';

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
            <td className="capitalize">{e.action}</td>
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
