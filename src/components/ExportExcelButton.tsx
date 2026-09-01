'use client';

interface ExportRow {
  po_number: string;
  po_date: string;
  vendor_name: string;
  subtotal: number;
  grand_total: number;
  status: string;
}

const HEADER = ['PO Number', 'Date', 'Vendor', 'Subtotal', 'Grand Total', 'Status'];

export default function ExportExcelButton({ rows, filename }: { rows: ExportRow[]; filename: string }) {
  async function handleExport() {
    // Loaded on demand rather than bundled into every dashboard page load
    // — it's a genuinely large library, and most visits never click this.
    const XLSX = await import('xlsx');

    const data = rows.map((r) => [
      r.po_number,
      new Date(r.po_date), // real Date object — Excel renders this as an actual date cell, not text
      r.vendor_name,
      r.subtotal,
      r.grand_total,
      r.status.replace('_', ' '),
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([HEADER, ...data]);

    // Reasonable column widths so it doesn't open looking like a wall of
    // truncated text — 'wch' is approximate character width, the unit
    // SheetJS uses for this.
    worksheet['!cols'] = [
      { wch: 26 }, // PO Number
      { wch: 12 }, // Date
      { wch: 28 }, // Vendor
      { wch: 14 }, // Subtotal
      { wch: 14 }, // Grand Total
      { wch: 16 }, // Status
    ];

    // Real number and date formats, so Excel treats amounts as numbers
    // (sortable, summable) and dates as dates rather than plain text.
    // Note: cell background/bold styling isn't applied here — the free
    // SheetJS package silently drops style writes (confirmed directly,
    // not assumed), so a bold header isn't something this can actually
    // deliver without a paid dependency; not worth the added weight for
    // what's cosmetic on an internal export.
    const range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let row = 1; row <= range.e.r; row++) {
      const dateCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
      if (dateCell) dateCell.z = 'dd-mmm-yyyy';
      const subtotalCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 3 })];
      if (subtotalCell) subtotalCell.z = '#,##0.00';
      const grandTotalCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 4 })];
      if (grandTotalCell) grandTotalCell.z = '#,##0.00';
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Orders');
    XLSX.writeFile(workbook, filename);
  }

  return (
    <button type="button" className="btn btn-outline text-xs" onClick={handleExport} disabled={rows.length === 0}>
      Export Excel
    </button>
  );
}
