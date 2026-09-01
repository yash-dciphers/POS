'use client';

import { useEffect, useMemo, useState } from 'react';
import { isValidGstinFormat } from '@/lib/gstin';
import VendorAutocomplete from '@/components/VendorAutocomplete';
import LineItemsEditor, { type LineItemColumn, type LineItemRow } from '@/components/LineItemsEditor';
import { calculateTotals } from '@/lib/gst';
import { numberToWordsIndian } from '@/lib/number-to-words';
import { createPurchaseOrder } from './actions';
import type { Vendor } from '@/lib/types';
import { Spinner } from '@/components/Skeleton';

// An Indian GSTIN encodes the PAN inside it: 2-digit state code, then the
// 10-character PAN, then a 3-character entity/checksum suffix. So the PAN
// is always recoverable directly from a valid GSTIN — no need to ask twice.
function panFromGstin(gstin: string): string | null {
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return null;
  return clean.slice(2, 12);
}

export interface PoFormInitialValues {
  category: 'PRH' | 'PRS';
  poDate: string;
  gstRate: number;
  vendor: Vendor | null;
  quoteNumber: string;
  contactPerson: string;
  contactPhone: string;
  shipSameAsBill: boolean;
  shipToDetails?: { name: string; address: string; gstin: string; pan: string };
  deliveryTimeline: string;
  paymentTerms: string;
  paymentTermsType?: 'credit' | 'pdc' | 'immediate' | null;
  paymentTermsDays?: number | null;
  termsAndConditions: string;
  status: 'draft' | 'issued' | 'cancelled';
  lineItems: LineItemRow[];
  lineItemColumns: LineItemColumn[];
}

export default function PoCreateForm({
  defaultGstRate,
  mode = 'create',
  poId,
  initialValues,
  onSubmitEdit,
  existingPoNumber,
  isAdmin = false,
}: {
  defaultGstRate: number;
  mode?: 'create' | 'edit';
  poId?: string;
  initialValues?: PoFormInitialValues;
  onSubmitEdit?: (payload: any) => Promise<void>;
  existingPoNumber?: string;
  isAdmin?: boolean;
}) {
  const [category, setCategory] = useState<'PRH' | 'PRS'>(initialValues?.category ?? 'PRS');
  const [gstRate, setGstRate] = useState(initialValues?.gstRate ?? defaultGstRate);
  const [vendor, setVendor] = useState<Vendor | null>(initialValues?.vendor ?? null);
  const [newVendorName, setNewVendorName] = useState<string | null>(null);
  const [newVendorFields, setNewVendorFields] = useState({
    address: '',
    gstin: '',
    pan: '',
    save: true,
  });
  const [newVendorGstinWarning, setNewVendorGstinWarning] = useState<string | null>(null);
  const [checkingNewVendorGstin, setCheckingNewVendorGstin] = useState(false);
  useEffect(() => {
    const gstin = newVendorFields.gstin.trim().toUpperCase();
    if (gstin.length !== 15 || !newVendorName) {
      setNewVendorGstinWarning(null);
      setCheckingNewVendorGstin(false);
      return;
    }
    let cancelled = false;
    setCheckingNewVendorGstin(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vendors/search?gstin=${encodeURIComponent(gstin)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const match = (data.vendors ?? []).find((v: any) => v.name.trim().toLowerCase() !== newVendorName.trim().toLowerCase());
        if (!cancelled) setNewVendorGstinWarning(match ? `This GSTIN is already used by "${match.name}" — is this the same vendor under a different name?` : null);
      } finally {
        if (!cancelled) setCheckingNewVendorGstin(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [newVendorFields.gstin, newVendorName]);
  const [quoteNumber, setQuoteNumber] = useState(initialValues?.quoteNumber ?? '');
  const [contactPerson, setContactPerson] = useState(initialValues?.contactPerson ?? '');
  const [contactPhone, setContactPhone] = useState(initialValues?.contactPhone ?? '');
  const [poNumberMode, setPoNumberMode] = useState<'keep' | 'generate' | 'custom'>('keep');
  const [customPoNumber, setCustomPoNumber] = useState('');
  const [poDate, setPoDate] = useState(initialValues?.poDate ?? new Date().toISOString().slice(0, 10));
  const [shipSame, setShipSame] = useState(initialValues?.shipSameAsBill ?? true);
  const [shipToName, setShipToName] = useState(initialValues?.shipToDetails?.name ?? '');
  const [shipToAddress, setShipToAddress] = useState(initialValues?.shipToDetails?.address ?? '');
  const [shipToGstin, setShipToGstin] = useState(initialValues?.shipToDetails?.gstin ?? '');
  const [shipToPan, setShipToPan] = useState(initialValues?.shipToDetails?.pan ?? '');
  const [deliveryTimeline, setDeliveryTimeline] = useState(initialValues?.deliveryTimeline ?? '');
  const [paymentTermsType, setPaymentTermsType] = useState<'credit' | 'pdc' | 'immediate' | ''>(
    initialValues?.paymentTermsType ?? ''
  );
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    initialValues?.paymentTermsDays != null ? String(initialValues.paymentTermsDays) : ''
  );
  // The pre-existing free text, if any (an older PO created before this
  // dropdown existed). Kept as a fallback so editing that PO without
  // touching this field doesn't blank out its terms — only an explicit
  // new selection overwrites it.
  const [legacyPaymentTerms] = useState(initialValues?.paymentTerms ?? '');
  const paymentTerms = (() => {
    if (paymentTermsType === 'immediate') return 'Immediate upon receipt of invoice';
    if (paymentTermsType === 'credit' && paymentTermsDays) return `Credit - ${paymentTermsDays} Days`;
    if (paymentTermsType === 'pdc' && paymentTermsDays) return `PDC - ${paymentTermsDays} Days`;
    return legacyPaymentTerms;
  })();
  const [terms, setTerms] = useState(initialValues?.termsAndConditions ?? '');
  const [lineItems, setLineItems] = useState<LineItemRow[]>(initialValues?.lineItems ?? []);
  const [lineItemColumns, setLineItemColumns] = useState<LineItemColumn[]>(initialValues?.lineItemColumns ?? []);
  const [submitting, setSubmitting] = useState<'draft' | 'issued' | 'pending_approval' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Non-admins can't issue a PO directly — it goes to any-one-Admin
  // approval instead. Admins skip this (no self-approval loop).
  const finalStatus: 'issued' | 'pending_approval' = isAdmin ? 'issued' : 'pending_approval';

  const totals = useMemo(() => {
    const lineTotals = lineItems.map((li) => Number(li.total) || 0);
    return calculateTotals(lineTotals, gstRate);
  }, [lineItems, gstRate]);

  function buildPayload(status: 'draft' | 'issued' | 'pending_approval') {
    return {
      category,
      poDate,
      gstRate,
      vendorId: vendor?.id,
      newVendor: !vendor && newVendorName ? { name: newVendorName, ...newVendorFields } : undefined,
      quoteNumber: quoteNumber || undefined,
      contactPerson: contactPerson || undefined,
      contactPhone: contactPhone || undefined,
      poNumberMode: mode === 'edit' ? poNumberMode : undefined,
      customPoNumber: poNumberMode === 'custom' ? customPoNumber.trim() : undefined,
      shipSameAsBill: shipSame,
      shipToDetails: shipSame ? undefined : { name: shipToName, address: shipToAddress, gstin: shipToGstin, pan: shipToPan },
      deliveryTimeline,
      paymentTerms,
      paymentTermsType: paymentTermsType || undefined,
      paymentTermsDays: paymentTermsType === 'credit' || paymentTermsType === 'pdc' ? Number(paymentTermsDays) || undefined : undefined,
      termsAndConditions: terms,
      lineItems: lineItems.map((li) => ({
        description: String(li.description ?? ''),
        partCode: li.partCode ? String(li.partCode) : undefined,
        qty: Number(li.qty) || 0,
        unitPrice: Number(li.unitPrice) || 0,
        total: Number(li.total) || 0,
        ...li,
      })),
      lineItemColumns,
      status,
    };
  }

  function validate(): string | null {
    if (!vendor && !newVendorName) return 'Select or create a vendor before saving.';
    if (lineItems.length === 0) return 'Add at least one line item.';
    if (mode === 'edit' && poNumberMode === 'custom' && !customPoNumber.trim()) return 'Enter a custom PO number, or choose a different option.';
    if (!shipSame && (!shipToName.trim() || !shipToAddress.trim())) return 'Enter a Ship To name and address, or check "same as Bill To".';
    if ((paymentTermsType === 'credit' || paymentTermsType === 'pdc') && !paymentTermsDays) {
      return 'Enter the number of days for Credit / PDC payment terms.';
    }
    return null;
  }

  async function handleSaveDraft() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting('draft');
    try {
      const payload = buildPayload('draft');
      if (mode === 'edit' && onSubmitEdit) {
        await onSubmitEdit(payload);
      } else {
        await createPurchaseOrder(payload as any);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong saving this draft.');
      setSubmitting(null);
    }
  }

  function handleOpenReview() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setReviewOpen(true);
  }

  async function handleConfirmIssue() {
    setSubmitting(finalStatus);
    try {
      const payload = buildPayload(finalStatus);
      if (mode === 'edit' && onSubmitEdit) {
        await onSubmitEdit(payload);
      } else {
        await createPurchaseOrder(payload as any);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong saving this PO.');
      setSubmitting(null);
      setReviewOpen(false);
    }
  }

  const effectiveVendorName = vendor?.name ?? newVendorName ?? '—';

  // Enter should submit, same as it would in a native <form> — but this
  // component's sticky sidebar and review modal live outside a single
  // <form> wrapper (nesting one around all of it risks subtler layout/CSS
  // breakage than it's worth), so it's handled explicitly here instead.
  // Shift+Enter and Enter inside a textarea still behave normally (new
  // line), since those are genuine multi-line fields.
  function handleFormKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
    e.preventDefault();
    if (submitting !== null) return;
    if (reviewOpen) {
      handleConfirmIssue();
    } else {
      handleOpenReview();
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start" onKeyDown={handleFormKeyDown}>
      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="font-display text-[15px] mb-1">1 · Vendor</h2>
          <div className="h-0.5 w-9 bg-gold rounded mb-3.5" />
          <VendorAutocomplete
            initialValue={initialValues?.vendor?.name}
            onSelect={(v, name) => {
              setVendor(v);
              setNewVendorName(v ? null : name ?? null);
            }}
          />
          {!vendor && newVendorName && (
            <div className="mt-3 border border-dashed border-border rounded-md p-3.5 space-y-2.5">
              <div className="text-xs font-semibold">Creating &quot;{newVendorName}&quot; as a new vendor</div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <input
                    className="input"
                    placeholder="GSTIN"
                    value={newVendorFields.gstin}
                    onChange={(e) => {
                      const gstin = e.target.value;
                      const autoPan = panFromGstin(gstin);
                      setNewVendorFields({
                        ...newVendorFields,
                        gstin,
                        pan: autoPan ?? newVendorFields.pan,
                      });
                    }}
                  />
                  <div className="text-[10.5px] text-muted mt-1">PAN auto-fills once GSTIN is complete (15 characters)</div>
                  {newVendorFields.gstin.trim().length >= 15 && !isValidGstinFormat(newVendorFields.gstin) && (
                    <div className="text-[10.5px] text-danger bg-[#F5E6E4] border border-danger/20 rounded-md px-2 py-1.5 mt-1.5">
                      ⚠ Doesn't look like a valid GSTIN format — double-check it.
                    </div>
                  )}
                  {checkingNewVendorGstin && (
                    <div className="text-[10.5px] text-muted mt-1.5 flex items-center gap-1.5">
                      <Spinner className="w-3 h-3" />
                      Checking GSTIN...
                    </div>
                  )}
                  {newVendorGstinWarning && (
                    <div className="text-[10.5px] text-warn bg-[#FBF2DF] border border-warn/20 rounded-md px-2 py-1.5 mt-1.5">
                      ⚠ {newVendorGstinWarning}
                    </div>
                  )}
                </div>
                <input
                  className="input"
                  placeholder="PAN"
                  value={newVendorFields.pan}
                  onChange={(e) => setNewVendorFields({ ...newVendorFields, pan: e.target.value })}
                />
              </div>
              <textarea
                className="input"
                placeholder="Address"
                value={newVendorFields.address}
                onChange={(e) => setNewVendorFields({ ...newVendorFields, address: e.target.value })}
              />
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={newVendorFields.save}
                  onChange={(e) => setNewVendorFields({ ...newVendorFields, save: e.target.checked })}
                />
                Save this vendor to the Vendor Repository
              </label>
            </div>
          )}
          <div className="mt-3">
            <label className="field-label">Distributor / Quote Number (optional)</label>
            <input
              className="input max-w-xs"
              placeholder="e.g. 10027802"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div>
              <label className="field-label">Vendor Contact Person (optional)</label>
              <input className="input" placeholder="Who to reach for this order" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Vendor Contact Phone (optional)</label>
              <input className="input" placeholder="10-digit mobile" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>
          <div className="text-[10.5px] text-muted mt-1">
            Quote number and contact vary order to order — captured here, not stored on the vendor.
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-display text-[15px] mb-1">2 · Purchase Order Details</h2>
          <div className="h-0.5 w-9 bg-gold rounded mb-3.5" />
          <div className="grid grid-cols-2 gap-3.5 mb-3.5">
            <div>
              <label className="field-label">Category (determines series)</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as 'PRH' | 'PRS')}
                disabled={mode === 'edit'}
              >
                <option value="PRH">Hardware</option>
                <option value="PRS">Software &amp; Licenses</option>
              </select>
              {mode === 'edit' && (
                <div className="text-[10.5px] text-muted mt-1">Category/series is locked once issued — change the PO number below instead if needed.</div>
              )}
            </div>
            {mode === 'edit' && (
              <div className="col-span-2 -mt-1">
                <label className="field-label">PO Number</label>
                <div className="flex gap-3 mb-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" checked={poNumberMode === 'keep'} onChange={() => setPoNumberMode('keep')} />
                    Keep current ({existingPoNumber})
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" checked={poNumberMode === 'generate'} onChange={() => setPoNumberMode('generate')} />
                    Generate new
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" checked={poNumberMode === 'custom'} onChange={() => setPoNumberMode('custom')} />
                    Enter custom
                  </label>
                </div>
                {poNumberMode === 'custom' && (
                  <input
                    className="input max-w-xs"
                    placeholder="e.g. DCIPHERS/26-27/PO/PRS/03"
                    value={customPoNumber}
                    onChange={(e) => setCustomPoNumber(e.target.value)}
                  />
                )}
              </div>
            )}
            <div>
              <label className="field-label">PO date</label>
              <input type="date" className="input" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">GST rate (%)</label>
              <input type="number" className="input" value={gstRate} onChange={(e) => setGstRate(Number(e.target.value) || 0)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={shipSame} onChange={(e) => setShipSame(e.target.checked)} />
            Ship To same as Bill To (company registered address)
          </label>
          {!shipSame && (
            <div className="mt-3 border border-dashed border-border rounded-md p-3.5 space-y-2.5">
              <div className="text-xs font-semibold">Ship To details</div>
              <input
                className="input"
                placeholder="Name (e.g. site / warehouse name)"
                value={shipToName}
                onChange={(e) => setShipToName(e.target.value)}
              />
              <textarea
                className="input"
                placeholder="Address"
                value={shipToAddress}
                onChange={(e) => setShipToAddress(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input className="input" placeholder="GSTIN (optional)" value={shipToGstin} onChange={(e) => setShipToGstin(e.target.value)} />
                <input className="input" placeholder="PAN (optional)" value={shipToPan} onChange={(e) => setShipToPan(e.target.value)} />
              </div>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-display text-[15px] mb-1">3 · Line Items</h2>
          <div className="h-0.5 w-9 bg-gold rounded mb-3.5" />
          <LineItemsEditor
            initialColumns={initialValues?.lineItemColumns}
            initialRows={initialValues?.lineItems}
            onChange={(rows, columns) => {
              setLineItems(rows);
              setLineItemColumns(columns);
            }}
          />
        </section>

        <section className="card p-5">
          <h2 className="font-display text-[15px] mb-1">4 · Delivery &amp; Terms</h2>
          <div className="h-0.5 w-9 bg-gold rounded mb-3.5" />
          <div className="grid grid-cols-2 gap-3.5 mb-3.5">
            <div>
              <label className="field-label">Delivery timeline</label>
              <input
                className="input"
                value={deliveryTimeline}
                onChange={(e) => setDeliveryTimeline(e.target.value)}
                placeholder="e.g. Immediate / 2 Weeks"
              />
            </div>
            <div>
              <label className="field-label">Payment terms</label>
              <select
                className="input"
                value={paymentTermsType}
                onChange={(e) => {
                  const next = e.target.value as 'credit' | 'pdc' | 'immediate' | '';
                  setPaymentTermsType(next);
                  if (next === 'immediate') setPaymentTermsDays('');
                }}
              >
                <option value="">
                  {legacyPaymentTerms ? `Keep existing: "${legacyPaymentTerms}"` : 'Select…'}
                </option>
                <option value="credit">Credit</option>
                <option value="pdc">PDC (Post Dated Cheque)</option>
                <option value="immediate">Immediate</option>
              </select>
              {(paymentTermsType === 'credit' || paymentTermsType === 'pdc') && (
                <input
                  className="input mt-1.5"
                  type="number"
                  min={1}
                  placeholder="Number of days"
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(e.target.value)}
                />
              )}
              {paymentTermsType === 'immediate' && (
                <div className="text-[10.5px] text-muted mt-1">Will show as "Immediate upon receipt of invoice"</div>
              )}
            </div>
          </div>
          <label className="field-label">Additional terms &amp; conditions (optional)</label>
          <div className="text-[10.5px] text-muted mb-1.5">Items 1–5 are standard and appear on every PO automatically. Add any PO-specific terms below.</div>
          {(terms ? terms.split('\n') : ['']).map((line, i, arr) => (
            <div key={i} className="flex items-start gap-1.5 mb-1.5">
              <span className="text-xs text-muted font-mono pt-2 shrink-0 w-6 text-right">{6 + i}.</span>
              <input
                className="input flex-1"
                value={line}
                placeholder={i === 0 ? 'e.g. This contract is non-cancellable.' : ''}
                onChange={(e) => {
                  const lines = terms ? terms.split('\n') : [''];
                  lines[i] = e.target.value;
                  setTerms(lines.join('\n'));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    const lines = terms ? terms.split('\n') : [''];
                    lines.splice(i + 1, 0, '');
                    setTerms(lines.join('\n'));
                    // Focus the new input after render
                    setTimeout(() => {
                      const inputs = e.currentTarget.parentElement?.parentElement?.querySelectorAll('input');
                      inputs?.[i + 1]?.focus();
                    }, 0);
                  }
                  if (e.key === 'Backspace' && !line && arr.length > 1) {
                    e.preventDefault();
                    const lines = terms.split('\n');
                    lines.splice(i, 1);
                    setTerms(lines.join('\n'));
                  }
                }}
              />
              {arr.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-muted hover:text-danger pt-2 shrink-0"
                  onClick={() => {
                    const lines = terms.split('\n');
                    lines.splice(i, 1);
                    setTerms(lines.join('\n'));
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {terms && !terms.endsWith('\n') && (
            <button
              type="button"
              className="text-xs text-navy font-semibold mt-0.5"
              onClick={() => setTerms((terms || '') + '\n')}
            >
              + Add another term
            </button>
          )}
        </section>
      </div>

      <div className="sticky top-4">
        <div className="card p-4.5">
          <div className="text-[11px] uppercase tracking-wide text-muted font-bold mb-2.5">Live Summary</div>
          <Row label="Subtotal" value={totals.subtotal} />
          <Row label={`GST (${gstRate}%)`} value={totals.gstAmount} />
          <Row label="Grand Total" value={totals.grandTotal} bold />
          <div className="text-[11.5px] text-muted mt-1.5 leading-snug">{numberToWordsIndian(totals.grandTotal)}</div>
          {error && <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mt-3">{error}</div>}
          <div className="mt-4 flex flex-col gap-2">
            <button
              className="btn btn-primary w-full justify-center"
              disabled={submitting !== null}
              onClick={handleOpenReview}
            >
              {submitting && submitting !== 'draft' && <Spinner className="w-3.5 h-3.5" />}
              Review &amp; {mode === 'edit' ? 'Save Changes' : isAdmin ? 'Generate PO' : 'Submit for Approval'}
            </button>
            <button
              className="btn btn-outline w-full justify-center"
              disabled={submitting !== null}
              onClick={handleSaveDraft}
            >
              {submitting === 'draft' && <Spinner className="w-3.5 h-3.5" />}
              {submitting === 'draft' ? 'Saving...' : 'Save as Draft'}
            </button>
            {!isAdmin && mode === 'create' && (
              <div className="text-[10.5px] text-muted text-center mt-0.5">
                Any Admin approving is enough — you'll see the status update once they do.
              </div>
            )}
          </div>
        </div>
      </div>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-6 animate-fade-in" onClick={() => !submitting && setReviewOpen(false)}>
          <div className="card bg-white w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg mb-1">Review Purchase Order</h2>
            <div className="h-0.5 w-9 bg-gold rounded mb-4" />

            <div className="text-xs space-y-3 mb-5">
              <div>
                <div className="field-label mb-0.5">Vendor</div>
                <div className="font-semibold">{effectiveVendorName}</div>
                {quoteNumber && <div className="text-muted">Quote #: {quoteNumber}</div>}
                {contactPerson && <div className="text-muted">Contact: {contactPerson}</div>}
                {contactPhone && <div className="text-muted">Phone: {contactPhone}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="field-label mb-0.5">Category</div>
                  <div>{category === 'PRH' ? 'Hardware (PRH)' : 'Software & Licenses (PRS)'}</div>
                </div>
                <div>
                  <div className="field-label mb-0.5">PO Date</div>
                  <div>{poDate}</div>
                </div>
              </div>
              <div>
                <div className="field-label mb-0.5">Line Items ({lineItems.length})</div>
                <table className="ledger w-full text-xs">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li, i) => (
                      <tr key={i}>
                        <td>{String(li.description ?? '').slice(0, 60)}</td>
                        <td className="text-right font-mono">{String(li.qty ?? '')}</td>
                        <td className="text-right font-mono">
                          ₹{Number(li.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border pt-2.5">
                <Row label="Subtotal" value={totals.subtotal} />
                <Row label={`GST (${gstRate}%)`} value={totals.gstAmount} />
                <Row label="Grand Total" value={totals.grandTotal} bold />
              </div>
              <div>
                <div className="field-label mb-0.5">Payment Terms</div>
                <div>{paymentTerms || '—'}</div>
              </div>
              {terms.trim() && (
                <div>
                  <div className="field-label mb-0.5">Additional Terms &amp; Conditions</div>
                  {terms.split('\n').filter(l => l.trim()).map((line, i) => (
                    <div key={i} className="text-muted">{6 + i}. {line}</div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="text-xs text-danger bg-[#F5E6E4] rounded-md px-3 py-2 mb-3">{error}</div>}

            <div className="flex gap-2">
              <button className="btn btn-outline flex-1 justify-center" disabled={submitting !== null} onClick={() => setReviewOpen(false)}>
                ← Back to Edit
              </button>
              <button className="btn btn-primary flex-1 justify-center" disabled={submitting !== null} onClick={handleConfirmIssue}>
                {submitting !== null && <Spinner className="w-3.5 h-3.5" />}
                {submitting !== null
                  ? 'Saving...'
                  : mode === 'edit'
                  ? 'Confirm Changes'
                  : isAdmin
                  ? 'Confirm & Generate PO'
                  : 'Confirm & Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${bold ? 'font-bold text-[14.5px] pt-2.5' : 'border-b border-border'}`}>
      <span>{label}</span>
      <span className="font-mono">₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    </div>
  );
}
