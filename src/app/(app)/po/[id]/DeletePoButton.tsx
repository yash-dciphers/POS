'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deletePurchaseOrder } from './actions';
import { Spinner } from '@/components/Skeleton';

export default function DeletePoButton({ poId, poNumber }: { poId: string; poNumber: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete ${poNumber}? It'll disappear from the dashboard, search, and vendor totals — but stays permanently in the Audit Log. This can't be undone from here.`)) {
      return;
    }
    setBusy(true);
    try {
      await deletePurchaseOrder(poId);
      router.push('/dashboard');
    } catch (e: any) {
      alert(e?.message ?? 'Something went wrong deleting this PO.');
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handleDelete} disabled={busy} className="btn btn-outline text-xs px-3.5 py-1.5 text-danger border-danger/30 hover:bg-danger/5">
      {busy && <Spinner className="w-3.5 h-3.5" />}
      {busy ? 'Deleting...' : 'Delete (Admin)'}
    </button>
  );
}
