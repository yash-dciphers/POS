'use client';

import { useState } from 'react';
import { formatPhone } from '@/lib/phone';
import { removeUser, changeUserRole } from './actions';
import { Spinner } from '@/components/Skeleton';

export default function UsersTable({ users, currentUserId }: { users: any[]; currentUserId: string }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      {error && <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mb-3">{error}</div>}
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
            return (
              <tr key={u.id} className="row-hover">
                <td className="font-semibold">
                  {u.full_name}
                  {isSelf && <span className="text-muted font-normal text-xs ml-1.5">(you)</span>}
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
