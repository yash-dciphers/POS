import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { inviteUser } from './actions';
import UsersTable from './UsersTable';
import SubmitButton from '@/components/SubmitButton';

export default async function UsersPage() {
  const user = await requireUser();
  const users = await sql`
    select p.*, u.email, u.is_active
    from profiles p
    join app_users u on u.id = p.id
    where p.company_id = ${user.company_id}
    order by p.full_name
  `;

  return (
    <div className="space-y-4">
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
        Click a role badge to toggle Admin/User. There must always be at least one Admin, so the last one can't be removed or demoted.
      </div>
    </div>
  );
}
