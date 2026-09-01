import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { updateCompany } from './actions';
import SubmitButton from '@/components/SubmitButton';

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = user.role === 'admin';

  const [company] = await sql`select * from companies where id = ${user.company_id} limit 1`;
  const sequences = await sql`
    select *
    from po_number_sequences
    where company_id = ${user.company_id}
    order by fiscal_year
  `;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {isAdmin ? (
        <form action={updateCompany} className="card p-5 space-y-3.5">
          <h2 className="font-display text-[15px] mb-1">Company Profile</h2>
          <div className="h-0.5 w-9 bg-gold rounded mb-1" />
          <input type="hidden" name="id" value={company?.id ?? ''} />
          <div>
            <label className="field-label">Legal name</label>
            <input className="input" name="name" defaultValue={company?.name} />
          </div>
          <div>
            <label className="field-label">Registered address</label>
            <textarea className="input" name="address" defaultValue={company?.address} />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="field-label">GSTIN</label>
              <input className="input" name="gstin" defaultValue={company?.gstin} />
            </div>
            <div>
              <label className="field-label">PAN</label>
              <input className="input" name="pan" defaultValue={company?.pan} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="field-label">Contact email</label>
              <input className="input" name="contact_email" type="email" defaultValue={company?.contact_email} />
            </div>
            <div>
              <label className="field-label">Contact phone</label>
              <input className="input" name="contact_phone" defaultValue={company?.contact_phone} />
            </div>
          </div>
          <div>
            <label className="field-label">Default GST rate (%)</label>
            <input className="input max-w-[120px]" name="default_gst_rate" type="number" defaultValue={company?.default_gst_rate} />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="field-label">Renewal alert window (days)</label>
              <input className="input" name="renewal_window_days" type="number" min={1} defaultValue={company?.renewal_window_days ?? 90} />
              <div className="text-[10.5px] text-muted mt-1">How far ahead the dashboard flags upcoming renewals.</div>
            </div>
            <div>
              <label className="field-label">Urgent threshold (days)</label>
              <input className="input" name="renewal_urgent_days" type="number" min={1} defaultValue={company?.renewal_urgent_days ?? 30} />
              <div className="text-[10.5px] text-muted mt-1">Within this many days, the alert turns red instead of amber.</div>
            </div>
          </div>
          <div>
            <label className="field-label">Debits "due soon" window (days)</label>
            <input className="input max-w-[160px]" name="debits_due_soon_days" type="number" min={1} defaultValue={company?.debits_due_soon_days ?? 30} />
            <div className="text-[10.5px] text-muted mt-1">How far ahead the Debits page's top summary looks for upcoming payments.</div>
          </div>
          <SubmitButton pendingText="Saving...">Save Changes</SubmitButton>
        </form>
      ) : (
        <div className="card p-5">
          <h2 className="font-display text-[15px] mb-1">Company Profile</h2>
          <div className="h-0.5 w-9 bg-gold rounded mb-3.5" />
          <div className="text-xs text-muted bg-bg rounded-md px-3 py-2 mb-3.5">
            Read-only — only Admins can change company settings. Contact your Admin if something here needs updating.
          </div>
          <div className="text-sm space-y-2.5">
            <div>
              <div className="field-label mb-0.5">Legal name</div>
              {company?.name}
            </div>
            <div>
              <div className="field-label mb-0.5">Registered address</div>
              {company?.address}
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <div className="field-label mb-0.5">GSTIN</div>
                {company?.gstin}
              </div>
              <div>
                <div className="field-label mb-0.5">PAN</div>
                {company?.pan}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <div className="field-label mb-0.5">Contact email</div>
                {company?.contact_email}
              </div>
              <div>
                <div className="field-label mb-0.5">Contact phone</div>
                {company?.contact_phone}
              </div>
            </div>
            <div>
              <div className="field-label mb-0.5">Default GST rate</div>
              {company?.default_gst_rate}%
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <div className="field-label mb-0.5">Renewal alert window</div>
                {company?.renewal_window_days ?? 90} days
              </div>
              <div>
                <div className="field-label mb-0.5">Urgent threshold</div>
                {company?.renewal_urgent_days ?? 30} days
              </div>
            </div>
            <div>
              <div className="field-label mb-0.5">Debits "due soon" window</div>
              {company?.debits_due_soon_days ?? 30} days
            </div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-display text-[15px] mb-1">PO Numbering</h2>
        <div className="h-0.5 w-9 bg-gold rounded mb-3.5" />
        <table className="ledger w-full">
          <thead>
            <tr>
              <th>Fiscal Year</th>
              <th className="text-right">Last Number Issued</th>
            </tr>
          </thead>
          <tbody>
            {(sequences ?? []).map((s: any) => (
              <tr key={s.id}>
                <td className="font-mono">{s.fiscal_year}</td>
                <td className="text-right font-mono">{String(s.last_number).padStart(2, '0')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11.5px] text-muted mt-3">
          PRH (Hardware) and PRS (Software &amp; Licenses) are labels only — both share this one running number
          per fiscal year. Resets automatically each fiscal year (April).
        </p>
      </div>
    </div>
  );
}
