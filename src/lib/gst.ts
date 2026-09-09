export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface LineItemLike {
  qty: number;
  unitPrice: number;
}

export function lineTotal(item: LineItemLike): number {
  const qty = Number(item.qty);
  const unitPrice = Number(item.unitPrice);
  if (!Number.isInteger(qty) || qty < 1) {
    throw new Error('Quantity must be a positive whole number.');
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error('Unit price cannot be negative.');
  }
  return round2(qty * unitPrice);
}

export interface Totals {
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
}

// Flat-rate GST only (per confirmed decision — no CGST/SGST vs IGST split
// in MVP; see Section 21 of the SRS for how to extend this later).
export function calculateTotals(lineTotals: number[], gstRatePercent: number): Totals {
  if (!Number.isFinite(gstRatePercent) || gstRatePercent < 0) {
    throw new Error('GST rate cannot be negative.');
  }
  if (lineTotals.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Line item totals cannot be negative.');
  }
  const subtotal = round2(lineTotals.reduce((sum, n) => sum + (n || 0), 0));
  const gstAmount = round2(subtotal * (gstRatePercent / 100));
  const grandTotal = round2(subtotal + gstAmount);
  return { subtotal, gstAmount, grandTotal };
}
