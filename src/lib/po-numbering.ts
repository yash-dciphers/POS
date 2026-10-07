import type { Sql, TransactionSql } from 'postgres';
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
// Either the module-level client or a transaction handed in by a caller.
type SqlClient = Sql<Record<string, unknown>> | TransactionSql<Record<string, unknown>>;

// `client` lets a caller run this inside its own transaction. next_po_sequence()
// locks the fiscal year's sequence row, and that lock only holds for as long as
// the surrounding transaction — so reserving a number in the same transaction
// that writes it is what actually stops two POs claiming the same number.
export async function getNextPoNumber(
  params: NextPoNumberParams,
  client: SqlClient = sql
): Promise<{ poNumber: string; fiscalYear: string; sequence: number }> {
  const fiscalYear = currentFiscalYear(params.poDate);

  const [{ next_po_sequence: sequence }] = await client<{ next_po_sequence: number }[]>`
    select next_po_sequence(${params.companyId}, ${params.seriesPrefix}, ${fiscalYear})
  `;

  const poNumber = `${params.companyCode}/${fiscalYear}/PO/${params.seriesPrefix}/${String(sequence).padStart(2, '0')}`;
  return { poNumber, fiscalYear, sequence };
}

// ---------------------------------------------------------------------------
// Draft numbering
//
// Drafts are provisional, so they must not consume a number from the real
// running series — a draft that is abandoned would otherwise leave a permanent
// hole in the company's PO numbering. They take a counter of their own and are
// formatted with /DRAFT/ where a real PO has /PO/, so the two can never be
// mistaken for each other (and so the real series' max() query can ignore them):
//
//   real   DCIPHERS/26-27/PO/PRS/12
//   draft  DCIPHERS/26-27/DRAFT/PRS/01
//
// A draft is given a real number only when it leaves draft status, and it takes
// whatever the next free number is at that moment. Numbers already handed out
// are never reshuffled: an issued PO's number may already be on a PDF sitting
// in a vendor's inbox, so it has to stay put.
// ---------------------------------------------------------------------------

export function isDraftNumber(poNumber: string): boolean {
  return /\/DRAFT\/(?:PRH|PRS)\/\d+$/.test(poNumber);
}

export async function getNextDraftNumber(
  params: NextPoNumberParams
): Promise<{ poNumber: string; fiscalYear: string; sequence: number }> {
  const fiscalYear = currentFiscalYear(params.poDate);

  const [{ next_draft_sequence: sequence }] = await sql<{ next_draft_sequence: number }[]>`
    select next_draft_sequence(${params.companyId}, ${fiscalYear})
  `;

  const poNumber = `${params.companyCode}/${fiscalYear}/DRAFT/${params.seriesPrefix}/${String(sequence).padStart(2, '0')}`;
  return { poNumber, fiscalYear, sequence };
}
