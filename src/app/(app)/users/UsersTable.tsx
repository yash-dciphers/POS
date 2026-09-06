'use client';

import { useState } from 'react';
import { formatPhone } from '@/lib/phone';
import { removeUser, changeUserRole, resetUserPassword } from './actions';
import { Spinner } from '@/components/Skeleton';

export default function UsersTable({ users, currentUserId }: { users: any[]; currentUserId: string }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  async function handleRoleChange(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const verb = newRole === 'admin' ? 'make this person an Admin' : 'change this person to a regular User';
    if (!window.confirm(`Are you sure you want to ${verb}?`)) return;

    setError(null);
    setBusyId(userId);
    try {
      await changeUserRole(userId, newRole);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong changing this role.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!window.confirm(`Remove ${name}'s account? They'll immediately lose access. This can't be undone.`)) return;

    setError(null);
    setBusyId(userId);
    try {
      await removeUser(userId);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong removing this user.');
      setBusyId(null);
    }
  }

  function startReset(userId: string) {
    setError(null);
    setNotice(null);
    setNewPassword('');
    setResettingId(userId);
  }

  function cancelReset() {
    setResettingId(null);
    setNewPassword('');
  }

  async function handleReset(userId: string, name: string) {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError(null);
    setNotice(null);
    setBusyId(userId);
    try {
      const result = await resetUserPassword(userId, newPassword);
      setResettingId(null);
      setNewPassword('');
      setNotice(
        result.emailed
          ? `New password set for ${name} and emailed to ${result.email}. They have been signed out of any active sessions.`
          : `New password set for ${name}, but the email to ${result.email} failed — you'll need to share it with them directly.`
      );
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong resetting this password.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mb-3">{error}</div>}
      {notice && <div className="text-xs text-success bg-[#E7F1EC] rounded-md px-3 py-2 mb-3">{notice}</div>}
      <table className="ledger w-full card">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Role</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u: any) => {
            const isSelf = u.id === currentUserId;
            const isBusy = busyId === u.id;
            const isResetting = resettingId === u.id;
            return (
              <tr key={u.id} className="row-hover">
                <td className="font-semibold">
                  {u.full_name}
                  {isSelf && <span className="text-muted font-normal text-xs ml-1.5">(you)</span>}
                  <div className="text-[11px] text-muted font-normal mt-0.5">{u.email}</div>
                </td>
                <td className="font-mono text-xs">{formatPhone(u.phone) || <span className="text-muted">Not set</span>}</td>
                <td>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRoleChange(u.id, u.role)}
                    className={`badge badge-${u.role === 'admin' ? 'admin' : 'user'} cursor-pointer hover:opacity-80 transition disabled:opacity-50`}
                    title="Click to toggle role"
                  >
                    {isBusy && <Spinner className="w-3 h-3" />}
                    {u.role === 'admin' ? 'Admin' : 'User'}
                  </button>
                </td>
                <td>
                  {isResetting ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <input
                        className="input max-w-[170px] text-xs py-1"
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (8+)"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReset(u.id, u.full_name)}
                        className="btn btn-primary text-xs px-3 py-1 disabled:opacity-50"
                      >
                        {isBusy ? 'Saving...' : 'Set & email'}
                      </button>
                      <button type="button" onClick={cancelReset} className="text-xs text-muted hover:underline">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => startReset(u.id)}
                        className="text-xs font-semibold text-muted hover:text-navy disabled:opacity-50"
                      >
                        Reset password
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleRemove(u.id, u.full_name)}
                          className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                        >
                          {isBusy && <Spinner className="w-3 h-3 mr-1" />}
                          {isBusy ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
