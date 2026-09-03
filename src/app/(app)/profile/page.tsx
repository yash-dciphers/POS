import { requireUser } from '@/lib/auth/session';
import { formatPhone } from '@/lib/phone';
import { updateMyPhone } from './actions';
import SubmitButton from '@/components/SubmitButton';
import { logout } from '@/app/login/actions';

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="max-w-md">
      <div className="card p-5">
        <h2 className="font-display text-[15px] mb-1">My Profile</h2>
        <div className="h-0.5 w-9 bg-gold rounded mb-3.5" />
        <div className="text-xs text-muted mb-3.5">
          Your phone number is printed on any PO you generate, so anyone with a question about it knows who to contact.
        </div>
        <div className="mb-3.5">
          <label className="field-label">Name</label>
          <div className="text-sm">{user.full_name}</div>
        </div>
        <div className="mb-3.5">
          <label className="field-label">Email</label>
          <div className="text-sm">{user.email}</div>
        </div>
        <div className="mb-3.5">
          <label className="field-label">Role</label>
          <div className="text-sm capitalize">
            <span className={`badge badge-${user.role === 'admin' ? 'admin' : 'user'}`}>{user.role}</span>
          </div>
        </div>
        <form action={updateMyPhone}>
          <label className="field-label">Phone number</label>
          <input
            className="input max-w-[220px]"
            name="phone"
            placeholder="10-digit mobile number"
            defaultValue={user.phone ?? ''}
          />
          {user.phone && <div className="text-[10.5px] text-muted mt-1">Currently shown as: {formatPhone(user.phone)}</div>}
          <SubmitButton className="btn btn-primary mt-3" pendingText="Saving...">Save</SubmitButton>
        </form>
        <div className="divider-fade my-4" />
        <div>
          <label className="field-label">Password</label>
          {user.password_set_by_admin ? (
            <div className="text-[11.5px] text-warn bg-[#F7EFE2] border border-warn/25 rounded-md px-3 py-2 mb-2.5 leading-relaxed">
              Your current password was created by an Admin, so someone else has seen it.
              Change it to something only you know.
            </div>
          ) : (
            <div className="text-[11.5px] text-muted mb-2.5 leading-relaxed">
              Change the password you use to sign in.
            </div>
          )}
          <a href="/auth/set-password" className="btn btn-outline w-full sm:w-auto">
            Change my password
          </a>
        </div>
        <div className="divider-fade my-4" />
        <form action={logout}>
          <button type="submit" className="btn btn-outline text-danger w-full sm:w-auto">
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
