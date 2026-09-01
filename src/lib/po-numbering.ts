import { sql } from '@/lib/db';

// Indian fiscal year: April–March. Matches the "26-27" pattern in the
// reference POs (FY starting April 2026 runs to March 2027).
export function currentFiscalYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  return month >= 4
    ? `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`
    : `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

export interface NextPoNumberParams {
  companyId: string;
  companyCode: string;   // e.g. 'DCIPHERS'
  seriesPrefix: 'PRH' | 'PRS';
  poDate: Date;
}

// Atomically reserves the next number for a company/fiscal year via the
// next_po_sequence() Postgres function. PRH/PRS are labels; numbering is unified.
export async function getNextPoNumber(
  params: NextPoNumberParams
): Promise<{ poNumber: string; fiscalYear: string; sequence: number }> {
  const fiscalYear = currentFiscalYear(params.poDate);

  const [{ next_po_sequence: sequence }] = await sql<{ next_po_sequence: number }[]>`
    select next_po_sequence(${params.companyId}, ${params.seriesPrefix}, ${fiscalYear})
  `;

  const poNumber = `${params.companyCode}/${fiscalYear}/PO/${params.seriesPrefix}/${String(sequence).padStart(2, '0')}`;
  return { poNumber, fiscalYear, sequence };
}
