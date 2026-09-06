import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { inviteUser } from './actions';
import UsersTable from './UsersTable';
import SubmitButton from '@/components/SubmitButton';

const ERROR_MESSAGES: Record<string, string> = {
  short_password: 'Password must be at least 8 characters.',
  duplicate_email: 'That email address already has an account. Use Reset password on the existing user instead.',
  missing_fields: 'Name and email are both required.',
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { invited?: string; mail_failed?: string; error?: string };
}) {
  const user = await requireUser();
  const users = await sql`
    select p.*, u.email, u.is_active
    from profiles p
    join app_users u on u.id = p.id
    where p.company_id = ${user.company_id}
    order by p.full_name
  `;

  const invited = searchParams.invited === '1';
  const mailFailed = searchParams.mail_failed === '1';
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] ?? 'Something went wrong.' : null;

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="text-xs text-danger bg-[#F5E6E4] border border-danger/20 rounded-md px-3.5 py-2.5">{errorMessage}</div>
      )}
      {invited && !mailFailed && (
        <div className="text-xs text-success bg-[#E7F1EC] border border-success/20 rounded-md px-3.5 py-2.5">
          User created. Their sign-in details have been emailed to them.
        </div>
      )}
      {invited && mailFailed && (
        <div className="text-xs text-warn bg-[#F7EFE2] border border-warn/25 rounded-md px-3.5 py-2.5">
          User created, but the email could not be sent — they have not received their password.
          Share it with them directly, or use <strong>Reset password</strong> below to set a new one and try emailing again.
        </div>
      )}

      <form action={inviteUser} className="card p-4 flex gap-2.5 items-end flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <label className="field-label">Name</label>
          <input className="input" name="name" required />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="field-label">Email</label>
          <input className="input" name="email" type="email" required />
        </div>
        <div className="min-w-[160px]">
          <label className="field-label">Phone (optional)</label>
          <input className="input" name="phone" placeholder="10-digit mobile" />
        </div>
        <div className="min-w-[180px]">
          <label className="field-label">Password</label>
          <input className="input" name="password" type="password" minLength={8} required />
        </div>
        <div>
          <label className="field-label">Role</label>
          <select className="input" name="role">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <SubmitButton pendingText="Creating...">+ Invite User</SubmitButton>
      </form>

      <UsersTable users={users as any} currentUserId={user.id} />

      <div className="text-[10.5px] text-muted px-1">
        Click a role badge to toggle Admin/User. There must always be at least one Admin, so the last one can&apos;t be removed or demoted.
        New users are emailed their password with a prompt to change it.
      </div>
    </div>
  );
}
