'use client';

import { useState } from 'react';

export interface LineItemColumn {
  key: string;
  label: string;
  fixed?: boolean;
  computed?: boolean;
  type?: 'text' | 'number' | 'date' | 'date_range';
}
export type LineItemRow = Record<string, string | number | undefined>;

const DEFAULT_COLUMNS: LineItemColumn[] = [
  { key: 'description', label: 'Description', fixed: true },
  { key: 'partCode', label: 'Part Code' },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'unitPrice', label: 'Unit Price', type: 'number' },
  { key: 'total', label: 'Total Price', fixed: true, computed: true },
];
const PRESET_COLUMNS: { label: string; type?: LineItemColumn['type'] }[] = [
  { label: 'HSN/SAC Code' },
  { label: 'Term (Start–End)', type: 'date_range' },
  { label: 'Serial Number' },
  { label: 'Co-Term ID' },
];

export default function LineItemsEditor({
  onChange,
  initialColumns,
  initialRows,
}: {
  onChange: (rows: LineItemRow[], columns: LineItemColumn[]) => void;
  initialColumns?: LineItemColumn[];
  initialRows?: LineItemRow[];
}) {
  const [columns, setColumns] = useState<LineItemColumn[]>(
    initialColumns && initialColumns.length ? initialColumns : DEFAULT_COLUMNS
  );
  const [rows, setRows] = useState<LineItemRow[]>(
    initialRows && initialRows.length ? initialRows : [{ description: '', qty: 1, unitPrice: 0, total: 0 }]
  );

  function emit(nextRows: LineItemRow[], nextColumns: LineItemColumn[]) {
    setRows(nextRows);
    setColumns(nextColumns);
    onChange(nextRows, nextColumns);
  }

  function updateCell(ri: number, key: string, value: string) {
    const next = [...rows];
    const isNumeric = key === 'qty' || key === 'unitPrice' || key === 'total';
    next[ri] = { ...next[ri], [key]: isNumeric ? Number(value) || 0 : value };

    const qty = Number(next[ri].qty) || 0;

    if (key === 'total') {
      // User typed into Total Price → derive Unit Price = Total / Qty
      const total = Number(value) || 0;
      next[ri].unitPrice = qty > 0 ? Number((total / qty).toFixed(2)) : 0;
    } else if (key === 'unitPrice' || key === 'qty') {
      // User typed into Unit Price or Qty → derive Total = Unit Price × Qty
      const unitPrice = Number(next[ri].unitPrice) || 0;
      next[ri].total = Number((unitPrice * qty).toFixed(2));
    }

    emit(next, columns);
  }
  function addRow() {
    const hasTermDates = columns.some((c) => c.type === 'date_range');
    const base: LineItemRow = { description: '', qty: 1, unitPrice: 0, total: 0 };
    if (hasTermDates) {
      base.term_start_date = '';
      base.term_end_date = '';
    }
    emit([...rows, base], columns);
  }
  function updateDateRangeCell(ri: number, part: 'term_start_date' | 'term_end_date', value: string) {
    const next = [...rows];
    next[ri] = { ...next[ri], [part]: value };
    emit(next, columns);
  }
  function removeRow(ri: number) {
    emit(rows.filter((_, i) => i !== ri), columns);
  }
  function addColumn(label: string, type?: LineItemColumn['type']) {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key || columns.find((c) => c.key === key)) return;
    const next = [...columns];
    // Insert before the first numeric/price column (Qty, Unit Price, ...) so
    // descriptive/reference columns (Part Code, HSN/SAC, Serial Number, ...)
    // stay grouped together, with the numbers-heavy columns trailing — not
    // wedged awkwardly between Unit Price and Total.
    let insertAt = next.findIndex((c) => c.type === 'number' || c.computed);
    if (insertAt === -1) insertAt = next.length - 1;
    next.splice(insertAt, 0, { key, label, type });
    emit(
      rows.map((r) =>
        type === 'date_range' ? { ...r, term_start_date: r.term_start_date ?? '', term_end_date: r.term_end_date ?? '' } : { ...r, [key]: r[key] ?? '' }
      ),
      next
    );
  }
  function addCustomColumn() {
    const label = window.prompt('Name this column (e.g. "Warranty Period", "Batch No."):');
    if (label && label.trim()) addColumn(label.trim());
  }
  function removeColumn(key: string) {
    emit(rows, columns.filter((c) => c.key !== key));
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="ledger w-full min-w-[640px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>
                  {c.label}
                  {!c.fixed && (
                    <span onClick={() => removeColumn(c.key)} className="ml-1.5 text-danger cursor-pointer">
                      ✕
                    </span>
                  )}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.key === 'total' ? (
                      <input
                        className="border-0 bg-transparent w-full text-sm p-1 focus:outline-none focus:bg-bg rounded text-right font-mono font-semibold"
                        type="number"
                        value={r.total ?? 0}
                        onChange={(e) => updateCell(ri, 'total', e.target.value)}
                      />
                    ) : c.type === 'date_range' ? (
                      <div className="flex items-center gap-1">
                        <input
                          className="border-0 bg-transparent text-sm p-1 focus:outline-none focus:bg-bg rounded w-[124px]"
                          type="date"
                          value={(r.term_start_date as string) ?? ''}
                          onChange={(e) => updateDateRangeCell(ri, 'term_start_date', e.target.value)}
                        />
                        <span className="text-muted text-xs">–</span>
                        <input
                          className="border-0 bg-transparent text-sm p-1 focus:outline-none focus:bg-bg rounded w-[124px]"
                          type="date"
                          value={(r.term_end_date as string) ?? ''}
                          onChange={(e) => updateDateRangeCell(ri, 'term_end_date', e.target.value)}
                        />
                      </div>
                    ) : (
                      <input
                        className="border-0 bg-transparent w-full text-sm p-1 focus:outline-none focus:bg-bg rounded"
                        type={c.type === 'number' ? 'number' : 'text'}
                        value={r[c.key] ?? ''}
                        onChange={(e) => updateCell(ri, c.key, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => removeRow(ri)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-3">
        <button type="button" className="btn btn-outline text-xs px-3 py-1.5" onClick={addRow}>
          + Add Item
        </button>
        <span className="text-xs text-muted ml-1">Add column:</span>
        {PRESET_COLUMNS.map(({ label, type }) => (
          <span
            key={label}
            onClick={() => addColumn(label, type)}
            className="text-xs font-semibold text-muted border border-dashed border-border rounded-full px-2.5 py-1 cursor-pointer hover:border-navy hover:text-navy"
          >
            + {label}
          </span>
        ))}
        <span
          onClick={addCustomColumn}
          className="text-xs font-semibold text-navy border border-dashed border-navy/40 rounded-full px-2.5 py-1 cursor-pointer hover:bg-navy hover:text-white"
        >
          + Custom…
        </span>
      </div>
    </div>
  );
}
