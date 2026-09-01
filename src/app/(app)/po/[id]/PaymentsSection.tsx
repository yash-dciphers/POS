'use client';

import { useState } from 'react';
import { recordPayment, updatePayment, deletePayment } from './payment-actions';
import { Spinner } from '@/components/Skeleton';

interface Payment {
  id: string;
  amount: number;
  remark: string | null;
  recorded_at: string;
  recorder: { full_name: string } | null;
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PaymentsSection({
  poId,
  grandTotal,
  poDate,
  paymentTermsType,
  paymentTermsDays,
  isAdmin,
  payments,
}: {
  poId: string;
  grandTotal: number;
  poDate: string;
  paymentTermsType: 'credit' | 'pdc' | 'immediate' | null;
  paymentTermsDays: number | null;
  isAdmin: boolean;
  payments: Payment[];
}) {
  const [entryMode, setEntryMode] = useState<'none' | 'full' | 'partial'>('none');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editRemark, setEditRemark] = useState('');

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(grandTotal - totalPaid, 0);
  const status: 'unpaid' | 'partial' | 'paid' = remaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

  let dueDate: Date | null = null;
  if (paymentTermsDays != null) {
    dueDate = new Date(poDate);
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = dueDate ? Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isOverdue = remaining > 0 && daysUntilDue !== null && daysUntilDue < 0;

  // Nothing meaningful to show if this PO was never Credit/PDC and has
  // no payment history at all — matches exactly what makes a PO appear
  // on the Debits page in the first place.
  const hasAnything = paymentTermsType === 'credit' || paymentTermsType === 'pdc' || payments.length > 0;
  if (!hasAnything) return null;

  function openFull() {
    setEntryMode('full');
    setAmount(remaining.toFixed(2));
    setRemark('');
    setError(null);
  }
  function openPartial() {
    setEntryMode('partial');
    setAmount('');
    setRemark('');
    setError(null);
  }
  function cancelEntry() {
    setEntryMode('none');
    setError(null);
  }

  async function submitEntry() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await recordPayment(poId, amt, remark);
      setEntryMode('none');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong recording this payment.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Payment) {
    setEditingId(p.id);
    setEditAmount(String(p.amount));
    setEditRemark(p.remark ?? '');
    setError(null);
  }

  async function saveEdit(paymentId: string) {
    const amt = Number(editAmount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePayment(paymentId, amt, editRemark);
      setEditingId(null);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong updating this payment.');
    } finally {
      setBusy(false);
    }
  }

  async function removePayment(paymentId: string) {
    if (!window.confirm('Remove this payment record? This effectively un-marks it — the amount goes back to being owed.')) return;
    setBusy(true);
    setError(null);
    try {
      await deletePayment(paymentId);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong removing this payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-4 card p-5 print:hidden">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="font-display text-[15px]">Payments</h2>
        {status === 'paid' && (
          <span className="badge" style={{ background: '#E7F3EE', color: 'var(--success)' }}>
            Fully Paid
          </span>
        )}
        {status === 'partial' && !isOverdue && (
          <span className="badge" style={{ background: '#FBF2DF', color: 'var(--warn)' }}>
            Partially Paid
          </span>
        )}
        {isOverdue && (
          <span className="badge" style={{ background: '#F5E6E4', color: 'var(--danger)' }}>
            Overdue
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-4 text-sm">
        <div>
          <div className="field-label mb-0.5">Terms</div>
          <div className="uppercase font-semibold">{paymentTermsType ?? '—'}</div>
        </div>
        <div>
          <div className="field-label mb-0.5">Due Date</div>
          <div>{dueDate ? dueDate.toLocaleDateString('en-IN') : '—'}</div>
        </div>
        <div>
          <div className="field-label mb-0.5">Paid</div>
          <div className="font-mono">{fmt(totalPaid)}</div>
        </div>
        <div>
          <div className="field-label mb-0.5">Remaining</div>
          <div className={`font-mono font-semibold ${isOverdue ? 'text-danger' : ''}`}>{fmt(remaining)}</div>
        </div>
      </div>

      {daysUntilDue !== null && remaining > 0 && (
        <div className={`text-xs mb-4 ${isOverdue ? 'text-danger font-semibold' : 'text-muted'}`}>
          {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days left to pay`}
        </div>
      )}

      {payments.length > 0 && (
        <table className="ledger w-full mb-4">
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-right">Amount</th>
              <th>Remark</th>
              <th>Recorded By</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {payments.map((p) =>
              editingId === p.id ? (
                <tr key={p.id}>
                  <td>{new Date(p.recorded_at).toLocaleDateString('en-IN')}</td>
                  <td className="text-right">
                    <input
                      className="input text-right"
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                    />
                  </td>
                  <td colSpan={2}>
                    <input className="input" placeholder="Remark (optional)" value={editRemark} onChange={(e) => setEditRemark(e.target.value)} />
                  </td>
                  <td className="whitespace-nowrap">
                    <button type="button" disabled={busy} onClick={() => saveEdit(p.id)} className="text-xs font-semibold text-success mr-2">
                      {busy && editingId === p.id && <Spinner className="w-3 h-3 mr-1" />}
                      {busy && editingId === p.id ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs font-semibold text-muted">
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="row-hover">
                  <td>{new Date(p.recorded_at).toLocaleDateString('en-IN')}</td>
                  <td className="text-right font-mono">{fmt(Number(p.amount))}</td>
                  <td className="text-muted">{p.remark || '—'}</td>
                  <td className="text-muted">{p.recorder?.full_name ?? 'Removed user'}</td>
                  {isAdmin && (
                    <td className="whitespace-nowrap text-right">
                      <button type="button" onClick={() => startEdit(p)} className="text-xs font-semibold text-navy hover:underline mr-2.5">
                        Edit
                      </button>
                      <button type="button" onClick={() => removePayment(p.id)} className="text-xs font-semibold text-danger hover:underline">
                        {busy && <Spinner className="w-3 h-3 mr-1" />}
                        {busy ? 'Removing...' : 'Remove'}
                      </button>
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      )}

      {error && <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mb-3">{error}</div>}

      {isAdmin && remaining > 0 && entryMode === 'none' && (
        <div className="flex gap-2">
          <button type="button" onClick={openFull} className="btn btn-primary text-xs px-3.5 py-1.5">
            Mark Fully Paid ({fmt(remaining)})
          </button>
          <button type="button" onClick={openPartial} className="btn btn-outline text-xs px-3.5 py-1.5">
            Record Partial Payment
          </button>
        </div>
      )}

      {isAdmin && entryMode !== 'none' && (
        <div className="border border-border rounded-lg p-3.5 bg-bg">
          <div className="text-xs font-semibold mb-2">{entryMode === 'full' ? 'Mark Fully Paid' : 'Record Partial Payment'}</div>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <div>
              <label className="field-label">Amount</label>
              <input
                className="input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                readOnly={entryMode === 'full'}
              />
            </div>
            <div>
              <label className="field-label">Remark (optional)</label>
              <input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. advance, final settlement" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={submitEntry} className="btn btn-primary text-xs px-3.5 py-1.5">
              {busy && <Spinner className="w-3.5 h-3.5" />}
              {busy ? 'Saving...' : 'Confirm'}
            </button>
            <button type="button" onClick={cancelEntry} className="btn btn-outline text-xs px-3.5 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
