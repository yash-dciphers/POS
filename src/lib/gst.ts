export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface LineItemLike {
  qty: number;
  unitPrice: number;
}

export function lineTotal(item: LineItemLike): number {
  return round2((item.qty || 0) * (item.unitPrice || 0));
}

export interface Totals {
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
}

// Flat-rate GST only (per confirmed decision — no CGST/SGST vs IGST split
// in MVP; see Section 21 of the SRS for how to extend this later).
export function calculateTotals(lineTotals: number[], gstRatePercent: number): Totals {
  const subtotal = round2(lineTotals.reduce((sum, n) => sum + (n || 0), 0));
  const gstAmount = round2(subtotal * (gstRatePercent / 100));
  const grandTotal = round2(subtotal + gstAmount);
  return { subtotal, gstAmount, grandTotal };
}
