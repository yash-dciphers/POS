'use client';

import { useState } from 'react';
import { rejectPurchaseOrder } from './actions';
import { Spinner } from '@/components/Skeleton';

export default function RejectPoButton({ poId }: { poId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReject() {
    const reason = window.prompt("What needs to change before this can be approved? This is shown to whoever created it.");
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      alert('A reason is required so the creator knows what to fix.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await rejectPurchaseOrder(poId, reason);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong rejecting this PO.');
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleReject}
        disabled={busy}
        className="btn btn-outline text-xs px-3.5 py-1.5 text-danger border-danger/30 hover:bg-danger/5 shrink-0"
      >
        {busy && <Spinner className="w-3.5 h-3.5" />}
        {busy ? 'Rejecting...' : 'Reject'}
      </button>
      {error && <div className="text-xs text-danger mt-1">{error}</div>}
    </>
  );
}
