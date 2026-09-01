// Shared between the PO detail view and the PDF template so both render the
// same per-PO column set that was chosen at creation time (see
// LineItemsEditor.tsx). Without this, custom columns (HSN/SAC, Serial
// Number, Term dates, etc.) would save correctly to the database but never
// actually appear anywhere after that — the whole point of letting users
// configure columns per PO.

export interface StoredColumn {
  key: string;
  label: string;
  fixed?: boolean;
  computed?: boolean;
  type?: 'text' | 'number' | 'date' | 'date_range';
}

// Only these keys live as real columns on po_line_items; everything else
// was stored in custom_fields at creation time. term_start_date/
// term_end_date are handled specially below (see getLineItemValue) since
// one logical "Term" column maps to two real date columns.
const DB_FIELD_MAP: Record<string, string> = {
  description: 'description',
  partCode: 'part_code',
  qty: 'qty',
  unitPrice: 'unit_price',
  total: 'total_price',
};

const MONEY_KEYS = new Set(['unitPrice', 'total']);
export const NUMERIC_KEYS = new Set(['qty', 'unitPrice', 'total']);

export const DEFAULT_LINE_ITEM_COLUMNS: StoredColumn[] = [
  { key: 'description', label: 'Description', fixed: true },
  { key: 'partCode', label: 'Part Code' },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'unitPrice', label: 'Unit Price', type: 'number' },
  { key: 'total', label: 'Total Price', fixed: true, computed: true },
];

// Older/edge-case POs (or ones created before this column was populated)
// fall back to the default set rather than rendering an empty table.
export function resolveColumns(stored: unknown): StoredColumn[] {
  if (Array.isArray(stored) && stored.length > 0) return stored as StoredColumn[];
  return DEFAULT_LINE_ITEM_COLUMNS;
}

export function getLineItemValue(li: Record<string, any>, key: string): unknown {
  if (key === 'term_start_end') {
    return { start: li.term_start_date, end: li.term_end_date };
  }
  const dbKey = DB_FIELD_MAP[key];
  if (dbKey) return li[dbKey];
  return li.custom_fields ? li.custom_fields[key] : undefined;
}

function formatDateShort(d: string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function formatLineItemValue(key: string, value: unknown): string {
  if (key === 'term_start_end') {
    const { start, end } = (value as { start?: string; end?: string }) ?? {};
    if (!start && !end) return '—';
    return `${formatDateShort(start) || '—'} – ${formatDateShort(end) || '—'}`;
  }
  if (value === null || value === undefined || value === '') return '—';
  if (MONEY_KEYS.has(key)) {
    return '₹' + Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}
