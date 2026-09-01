'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createVendor, updateVendor } from './actions';
import { isValidGstinFormat } from '@/lib/gstin';
import type { Vendor } from '@/lib/types';
import { Spinner } from '@/components/Skeleton';

function panFromGstin(gstin: string): string | null {
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return null;
  return clean.slice(2, 12);
}

const EMPTY_FIELDS = { name: '', address: '', gstin: '', pan: '' };

export default function VendorsClient({ initialVendors }: { initialVendors: Vendor[] }) {
  // Local, directly-updatable copy — the Add/Edit modals splice results
  // straight into this array from what the server action returns, rather
  // than waiting on revalidatePath/router.refresh() to round-trip and
  // re-render. That round trip is what caused the "only shows after a
  // manual page refresh" bug — the action's own response already has the
  // real row, so there's no need to wait for anything else.
  const [vendors, setVendors] = useState(initialVendors);
  useEffect(() => setVendors(initialVendors), [initialVendors]);

  const [query, setQuery] = useState('');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [gstinWarning, setGstinWarning] = useState<string | null>(null);
  const [checkingGstin, setCheckingGstin] = useState(false);

  // Warn (don't block) if a GSTIN typed here already belongs to a
  // differently-named vendor — real vendors get typed inconsistently
  // ("iValue" vs "iValue Infosolutions Ltd"), and this catches it before
  // two records end up representing the same company.
  useEffect(() => {
    const gstin = fields.gstin.trim().toUpperCase();
    if (gstin.length !== 15) {
      setGstinWarning(null);
      setCheckingGstin(false);
      return;
    }
    let cancelled = false;
    setCheckingGstin(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vendors/search?gstin=${encodeURIComponent(gstin)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const match = (data.vendors ?? []).find((v: any) => v.id !== editingId && v.name.trim().toLowerCase() !== fields.name.trim().toLowerCase());
        if (!cancelled) setGstinWarning(match ? `This GSTIN is already used by "${match.name}" — is this the same vendor under a different name?` : null);
      } finally {
        if (!cancelled) setCheckingGstin(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [fields.gstin, fields.name, editingId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v: any) =>
        v.name?.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q) ||
        v.gstin?.toLowerCase().includes(q)
    );
  }, [vendors, query]);

  function openAdd() {
    setFields(EMPTY_FIELDS);
    setError(null);
    setGstinWarning(null);
    setModalMode('add');
  }
  function openEdit(v: any) {
    setFields({ name: v.name ?? '', address: v.address ?? '', gstin: v.gstin ?? '', pan: v.pan ?? '' });
    setEditingId(v.id);
    setError(null);
    setGstinWarning(null);
    setModalMode('edit');
  }
  function closeModal() {
    setModalMode(null);
    setEditingId(null);
    setGstinWarning(null);
  }

  async function handleSave() {
    if (!fields.name.trim()) {
      setError('Vendor name is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (modalMode === 'edit' && editingId) {
        const updated = await updateVendor({ id: editingId, ...fields });
        setVendors((prev) => prev.map((v) => (v.id === editingId ? (updated as any) : v)).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const created = await createVendor(fields);
        setVendors((prev) => [...prev, created as any].sort((a, b) => a.name.localeCompare(b.name)));
      }
      closeModal();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong saving this vendor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-border gap-2.5 flex-wrap">
        <input
          className="input max-w-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, address, or GSTIN…"
        />
        <button type="button" className="btn btn-primary text-xs" onClick={openAdd}>
          + Add Vendor
        </button>
      </div>
      <table className="ledger w-full">
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Address</th>
            <th>GSTIN</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((v: any) => (
            <tr key={v.id} className="row-hover">
              <td className="font-semibold">
                <Link href={`/vendors/${v.id}`} className="hover:text-navy hover:underline">
                  {v.name}
                </Link>
              </td>
              <td className="text-muted">{v.address ?? '—'}</td>
              <td className="font-mono">{v.gstin ?? '—'}</td>
              <td>
                <button type="button" className="text-xs font-semibold text-navy hover:underline" onClick={() => openEdit(v)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="py-14">
                {vendors.length === 0 ? (
                  <div className="flex flex-col items-center text-center animate-fade-in-up">
                    <div className="w-14 h-14 rounded-full bg-[#EEF1FA] flex items-center justify-center mb-3.5">
                      <svg viewBox="0 0 24 24" width={26} height={26} stroke="var(--navy)" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                    </div>
                    <div className="text-sm font-semibold mb-1">No vendors yet</div>
                    <div className="text-xs text-muted mb-4 max-w-xs">
                      They'll appear here automatically as you create POs, or you can add one directly.
                    </div>
                    <button type="button" className="btn btn-gold" onClick={openAdd}>
                      + Add Your First Vendor
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-muted text-sm">No vendors match that search.</div>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-6 animate-fade-in" onClick={() => !saving && closeModal()}>
          <div
            className="card bg-white w-full max-w-md p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
              e.preventDefault();
              if (!saving) handleSave();
            }}
          >
            <h2 className="font-display text-lg mb-1">{modalMode === 'edit' ? 'Edit Vendor' : 'Add Vendor'}</h2>
            <div className="h-0.5 w-9 bg-gold rounded mb-4" />

            <div className="space-y-2.5">
              <div>
                <label className="field-label">Name</label>
                <input className="input" value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <input
                    className="input"
                    placeholder="GSTIN"
                    value={fields.gstin}
                    onChange={(e) => {
                      const gstin = e.target.value;
                      const autoPan = panFromGstin(gstin);
                      setFields({ ...fields, gstin, pan: autoPan ?? fields.pan });
                    }}
                  />
                  <div className="text-[10.5px] text-muted mt-1">PAN auto-fills once GSTIN is complete</div>
                  {fields.gstin.trim().length >= 15 && !isValidGstinFormat(fields.gstin) && (
                    <div className="text-[10.5px] text-danger bg-[#F5E6E4] border border-danger/20 rounded-md px-2 py-1.5 mt-1.5">
                      ⚠ Doesn't look like a valid GSTIN format — double-check it.
                    </div>
                  )}
                  {checkingGstin && (
                    <div className="text-[10.5px] text-muted mt-1.5 flex items-center gap-1.5">
                      <Spinner className="w-3 h-3" />
                      Checking GSTIN...
                    </div>
                  )}
                  {gstinWarning && (
                    <div className="text-[10.5px] text-warn bg-[#FBF2DF] border border-warn/20 rounded-md px-2 py-1.5 mt-1.5">
                      ⚠ {gstinWarning}
                    </div>
                  )}
                </div>
                <input className="input" placeholder="PAN" value={fields.pan} onChange={(e) => setFields({ ...fields, pan: e.target.value })} />
              </div>
              <textarea className="input" placeholder="Address" value={fields.address} onChange={(e) => setFields({ ...fields, address: e.target.value })} />
            </div>

            <div className="text-[10.5px] text-muted mt-2.5">
              Contact person and phone are captured per purchase order (they can vary), not stored here.
            </div>

            {error && <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mt-3">{error}</div>}

            <div className="flex gap-2 mt-4">
              <button className="btn btn-outline flex-1 justify-center" disabled={saving} onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn-primary flex-1 justify-center" disabled={saving} onClick={handleSave}>
                {saving && <Spinner className="w-3.5 h-3.5" />}
                {saving ? 'Saving...' : modalMode === 'edit' ? 'Save Changes' : 'Save Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
