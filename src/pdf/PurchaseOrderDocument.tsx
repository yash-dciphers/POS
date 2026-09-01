import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image, Link } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';
import { resolveColumns, getLineItemValue, formatLineItemValue, NUMERIC_KEYS, type StoredColumn } from '@/lib/line-items';
import { formatPhone } from '@/lib/phone';

const LOGO_PATH = path.join(process.cwd(), 'src/pdf/assets/logo.png');
const STAMP_PATH = path.join(process.cwd(), 'src/pdf/assets/stamp.png');
const LOGO_SRC = `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`;
const STAMP_SRC = `data:image/png;base64,${fs.readFileSync(STAMP_PATH).toString('base64')}`;
// Actual pixel dimensions of the stamp source file, used to size it in the
// PDF without distorting its aspect ratio. (The logo uses fixed dimensions
// instead — see logoImage style — since a strict aspect-ratio scale of the
// source file read as too narrow/tall in practice.)
const STAMP_ASPECT = 260 / 214;

// Without this, react-pdf can only wrap text at whitespace. Vendor part
// codes / SKUs (e.g. "FLEX-APPTS2-TS21BASE-100-1Y-R-SRV1") are frequently
// one long token with no spaces — when a token like that doesn't fit its
// column, the default layout has no break point to use and lets it spill
// out over whatever's next to it instead of wrapping. Registering a
// per-character fallback means long unbreakable tokens wrap onto a second
// line as a last resort instead of overlapping the next column.
Font.registerHyphenationCallback((word) => (word.length > 14 ? Array.from(word) : [word]));

// Base14 PDF fonts (Helvetica etc.) only support WinAnsi encoding, which has
// no glyph for ₹ (Indian Rupee sign, U+20B9) — every currency figure would
// silently render as a missing/wrong character. Noto Sans has full Unicode
// coverage, so it's registered here and used for all text in this document.
Font.register({
  family: 'NotoSans',
  fonts: [
    { src: path.join(process.cwd(), 'src/pdf/fonts/NotoSans-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(process.cwd(), 'src/pdf/fonts/NotoSans-Bold.ttf'), fontWeight: 'bold' },
  ],
});


const NAVY = '#14213D';
const INK = '#3A4F8A';
const MUTED = '#6B7280';
const BORDER = '#DADDE3';

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 50, paddingHorizontal: 44, fontSize: 9.5, fontFamily: 'NotoSans', color: '#1A1D23' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 14,
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', flexGrow: 1, flexShrink: 1, paddingRight: 20, alignItems: 'center' },
  logoBox: { width: 48, height: 49, marginRight: 12, flexGrow: 0, flexShrink: 0 },
  logoImage: { width: '100%', height: '100%', objectFit: 'contain' },
  // Explicit width rather than flex:1 — flex-based sizing for this block
  // proved unreliable across react-pdf/Yoga versions (same lesson as the
  // table columns above): 507 (content width) - 190 (metaBlock) - 48
  // (logo) - 12 (logo margin) - 20 (headerLeft paddingRight) = 237.
  headerTextBlock: { width: 237, flexGrow: 0, flexShrink: 0 },
  companyName: { fontSize: 12.5, fontFamily: 'NotoSans', fontWeight: 'bold', marginBottom: 3 },
  websiteLink: { fontSize: 8.5, color: INK, marginTop: 2 },
  metaBlock: { width: 190, flexShrink: 0 },
  metaLine: { fontSize: 9, color: MUTED, marginTop: 2, textAlign: 'right' },
  poNumber: { fontSize: 11, fontFamily: 'NotoSans', fontWeight: 'bold', textAlign: 'right' },

  small: { fontSize: 8.5, color: MUTED, lineHeight: 1.5 },
  bold: { fontFamily: 'NotoSans', fontWeight: 'bold' },

  vendorBlock: { marginBottom: 14 },
  partiesRow: { flexDirection: 'row', marginBottom: 18 },
  partyBlock: { flex: 1 },
  partyBlockGap: { width: 28, flexShrink: 0 },
  partyLabel: { fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 1, color: MUTED, marginBottom: 5, fontFamily: 'NotoSans', fontWeight: 'bold' },
  partyName: { fontSize: 10, fontFamily: 'NotoSans', fontWeight: 'bold', marginBottom: 3 },

  table: { marginBottom: 16, borderTopWidth: 1, borderTopColor: '#1A1D23' },
  tableHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAFAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D23',
    paddingVertical: 6,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 7,
  },
  trAlt: { backgroundColor: '#FBFBFC' },
  th: { fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 0.5, color: MUTED, fontFamily: 'NotoSans', fontWeight: 'bold', textAlign: 'center' },
  cellText: { fontSize: 9, lineHeight: 1.35 },
  descriptionText: { fontSize: 9, lineHeight: 1.45, textAlign: 'justify' },
  cellTextSmall: { fontSize: 7.8, lineHeight: 1.3, color: '#33363D' },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },

  totalsBox: { width: 230, alignSelf: 'flex-end', marginTop: 4 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5 },
  totalsRowFinal: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, marginTop: 3,
    borderTopWidth: 1, borderTopColor: '#1A1D23',
  },
  totalsLabel: { fontSize: 9.5 },
  totalsValue: { fontSize: 9.5 },
  totalsLabelFinal: { fontSize: 10.5, fontFamily: 'NotoSans', fontWeight: 'bold' },
  totalsValueFinal: { fontSize: 10.5, fontFamily: 'NotoSans', fontWeight: 'bold' },

  paymentInfoBlock: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  footerLine: { fontSize: 8.5, color: MUTED, marginTop: 3, lineHeight: 1.5 },

  tncBlock: { marginTop: 16 },
  tncLabel: { fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 1, color: MUTED, marginBottom: 5, fontFamily: 'NotoSans', fontWeight: 'bold' },
  tncText: { fontSize: 8, lineHeight: 1.55, color: '#33363D', marginBottom: 2 },

  footerRow: { flexDirection: 'row', marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  footerLeft: { flex: 1 },
  footerRight: { width: 130, alignItems: 'center', justifyContent: 'flex-end' },

  stampImage: { width: 110, height: 110 / STAMP_ASPECT },
  signatoryName: { fontSize: 8, fontFamily: 'NotoSans', fontWeight: 'bold', textAlign: 'center', marginTop: 6, width: 110 },
  signatureCaption: { fontSize: 7.5, color: MUTED, textAlign: 'center', marginTop: 2, width: 110 },

  watermark: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  watermarkText: {
    fontSize: 54,
    fontFamily: 'NotoSans',
    fontWeight: 'bold',
    color: '#E8CFCF',
    transform: 'rotate(-35deg)',
    opacity: 0.45,
  },
  statusBanner: {
    backgroundColor: '#F5E6E4',
    borderWidth: 1,
    borderColor: '#B3423A',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  statusBannerText: {
    fontSize: 8,
    fontFamily: 'NotoSans',
    fontWeight: 'bold',
    color: '#B3423A',
    textAlign: 'center',
  },
  runningFooter: {
    position: 'absolute',
    bottom: 20,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.75,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  runningFooterText: { fontSize: 7.5, color: MUTED },

  continuationHeader: {
    position: 'absolute',
    top: 16,
    left: 44,
    right: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D23',
    paddingBottom: 5,
  },
});

interface Party {
  name: string;
  address: string;
  gstin?: string | null;
  pan?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
}

interface PoForPdf {
  po_number: string;
  po_date: string;
  currency: string;
  status: string;
  gst_rate: number;
  subtotal: number;
  gst_amount: number;
  grand_total: number;
  amount_in_words: string | null;
  payment_terms: string | null;
  delivery_timeline: string | null;
  service_validity: string | null;
  terms_and_conditions: string | null;
  line_item_columns: unknown;
  bill_to_snapshot: Party | null;
  ship_to_snapshot: Party | null;
  quote_number: string | null;
  vendor_contact_person: string | null;
  vendor_contact_phone: string | null;
  vendors: {
    name: string;
    address: string | null;
    gstin: string | null;
    pan: string | null;
  } | null;
  creator: { full_name: string; phone: string | null } | null;
}
interface LineItemForPdf {
  id: string;
  [key: string]: unknown;
}

function money(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Fixed point widths for known column types. Every column — including
// Description — gets an explicit computed width; none of them use
// flexGrow. Mixing flexGrow with several sibling cells that ALL wrap
// (long descriptions + long part codes + date ranges) triggers a real
// react-pdf/Yoga measurement bug where text from different cells gets
// interleaved into one broken flow instead of staying in its own column.
// Giving every cell a known width up front avoids that two-pass
// measurement entirely.
const PAGE_CONTENT_WIDTH_PT = 507; // A4 width (595.28pt) minus left+right page padding, with a small safety margin

const MIN_DESCRIPTION_WIDTH_PT = 110;
const MIN_COLUMN_WIDTH_PT = 34;
const MAX_COLUMN_WIDTH_PT = 110;
const HEADER_CHAR_WIDTH_PT = 5.0; // bold, uppercase, 7.5pt
const DATA_CHAR_WIDTH_PT = 4.6; // regular, 9pt (roomier than the hyphenation estimate — this sizes columns, not wraps them)
const COLUMN_PADDING_PT = 12; // horizontal breathing room inside a cell
// Reference-code-style columns read better small — they're secondary data,
// not the primary content of the row.
const SMALL_FONT_KEYS = new Set(['partCode', 'hsn_sac_code', 'serial_number', 'co_term_id']);

// Columns size themselves to whatever's actually in them for this specific
// PO — the header label or the longest cell value, whichever needs more
// room — instead of a one-size-fits-all lookup. This is what fixes short
// data (e.g. a 6-digit HSN/SAC code) getting stuck in an oversized column,
// or a header wrapping to two lines while its neighbors stay on one.
//
// When several optional columns are combined on one PO (e.g. Term dates +
// HSN/SAC + Part Code, a common real combination for a software renewal),
// their combined "natural" width can exceed the page. Clamping each column
// independently in that case just squeezes whichever one happens to come
// last below its own header's minimum — which is exactly the bug this
// found. Instead, when there isn't enough room, every column gives up its
// "extra" space (above what its own header strictly needs) proportionally,
// so a header only ever wraps as an absolute last resort, not just because
// it was unlucky in column order.
function computeColumnWidths(columns: StoredColumn[], lineItems: LineItemForPdf[]): Record<string, number> {
  const widths: Record<string, number> = {};
  const optionalColumns = columns.slice(1);

  const measurements = optionalColumns.map((c) => {
    const headerMin = Math.max(c.label.length * HEADER_CHAR_WIDTH_PT + COLUMN_PADDING_PT, MIN_COLUMN_WIDTH_PT);
    const maxDataLen = lineItems.reduce((max, li) => {
      const value = formatLineItemValue(c.key, getLineItemValue(li, c.key));
      return Math.max(max, String(value).length);
    }, 0);
    const dataWidth = maxDataLen * DATA_CHAR_WIDTH_PT + COLUMN_PADDING_PT;
    const natural = Math.min(Math.max(headerMin, dataWidth), MAX_COLUMN_WIDTH_PT);
    return { key: c.key, headerMin, natural };
  });

  const available = PAGE_CONTENT_WIDTH_PT - MIN_DESCRIPTION_WIDTH_PT - 28; // 28pt reserved for S.No. column
  const totalNatural = measurements.reduce((sum, m) => sum + m.natural, 0);
  const totalHeaderMin = measurements.reduce((sum, m) => sum + m.headerMin, 0);

  let usedWidth = 0;
  if (totalNatural <= available) {
    // Plenty of room — everyone gets their natural width.
    measurements.forEach((m) => {
      widths[m.key] = m.natural;
      usedWidth += m.natural;
    });
  } else if (totalHeaderMin <= available) {
    // Tight, but every header can still fit on one line — shrink the
    // "extra" above headerMin proportionally to make everything fit.
    const totalExtra = totalNatural - totalHeaderMin;
    const availableExtra = available - totalHeaderMin;
    const scale = totalExtra > 0 ? availableExtra / totalExtra : 0;
    measurements.forEach((m) => {
      const width = m.headerMin + (m.natural - m.headerMin) * scale;
      widths[m.key] = width;
      usedWidth += width;
    });
  } else {
    // Extreme case: even bare header widths don't fit this many columns.
    // Scale headerMin itself down — some wrapping becomes unavoidable, but
    // distributed fairly rather than dumping it all on one column.
    const scale = available / totalHeaderMin;
    measurements.forEach((m) => {
      const width = m.headerMin * scale;
      widths[m.key] = width;
      usedWidth += width;
    });
  }

  if (columns[0]) {
    widths[columns[0].key] = Math.max(PAGE_CONTENT_WIDTH_PT - usedWidth - 28, MIN_DESCRIPTION_WIDTH_PT);
  }
  return widths;
}

// react-pdf's `fixed` prop repeats an element on every physical page the
// document produces — there's no built-in way to scope it to "only pages
// where this particular table continues," because react-pdf doesn't expose
// real layout results back to JS before the final render. So this estimates
// it instead: roughly how tall each row will render (based on how many
// lines its longest cell will wrap to, at the known column widths), how
// much table space is available on page 1 vs. continuation pages, and from
// that, how many pages the table itself actually needs. The repeat header
// is then only shown on pages within that count.
//
// This is a heuristic, not an exact layout calculation — calibrated against
// real rendered output. It errs toward slightly over-estimating page count
// rather than under, since a missing header on a real continuation page is
// worse than an extra one occasionally appearing on a page that turned out
// not to need it.
const AVG_CHAR_WIDTH_PT = 4.3;
const FIRST_PAGE_TABLE_CAPACITY_PT = 480;
const CONTINUATION_PAGE_CAPACITY_PT = 700;

function estimateRowHeightPt(li: LineItemForPdf, columns: StoredColumn[], widths: Record<string, number>): number {
  let maxLines = 1;
  columns.forEach((c) => {
    const value = formatLineItemValue(c.key, getLineItemValue(li, c.key));
    const colWidth = Math.max((widths[c.key] ?? MIN_COLUMN_WIDTH_PT) - 10, 30);
    const charsPerLine = Math.max(Math.floor(colWidth / AVG_CHAR_WIDTH_PT), 8);
    const lines = Math.max(1, Math.ceil(String(value).length / charsPerLine));
    if (lines > maxLines) maxLines = lines;
  });
  return 14 + maxLines * 13;
}

function estimateTablePageCount(lineItems: LineItemForPdf[], columns: StoredColumn[], widths: Record<string, number>): number {
  let remaining = FIRST_PAGE_TABLE_CAPACITY_PT;
  let pages = 1;
  for (const li of lineItems) {
    const h = estimateRowHeightPt(li, columns, widths);
    if (h > remaining) {
      pages += 1;
      remaining = CONTINUATION_PAGE_CAPACITY_PT - h;
    } else {
      remaining -= h;
    }
  }
  return pages;
}

function PartyBlock({ label, party, fallback }: { label: string; party: Party | null; fallback?: Party | null }) {
  const effective = party ?? fallback ?? null;
  return (
    <View style={styles.partyBlock}>
      <Text style={styles.partyLabel}>{label}</Text>
      {effective ? (
        <>
          <Text style={styles.partyName}>{effective.name}</Text>
          <Text style={styles.small}>{effective.address}</Text>
          {effective.gstin ? <Text style={styles.small}>GSTIN: {effective.gstin}</Text> : null}
          {effective.pan ? <Text style={styles.small}>PAN: {effective.pan}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

export default function PurchaseOrderDocument({ po, lineItems }: { po: PoForPdf; lineItems: LineItemForPdf[] }) {
  const columns: StoredColumn[] = resolveColumns(po.line_item_columns);
  const widths = computeColumnWidths(columns, lineItems);
  const tablePageCount = estimateTablePageCount(lineItems, columns, widths);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {po.status !== 'issued' && (
          <View style={styles.watermark} fixed>
            <Text style={styles.watermarkText}>
              {po.status === 'pending_approval' ? 'PENDING APPROVAL' : po.status === 'draft' ? 'DRAFT' : po.status?.toUpperCase()}
            </Text>
          </View>
        )}
        {po.status !== 'issued' && (
          <View style={styles.statusBanner} fixed>
            <Text style={styles.statusBannerText}>
              {po.status === 'pending_approval'
                ? '⚠ THIS PURCHASE ORDER IS PENDING ADMIN APPROVAL AND HAS NOT BEEN VERIFIED'
                : po.status === 'draft'
                ? '⚠ THIS IS A DRAFT AND HAS NOT BEEN ISSUED'
                : `⚠ STATUS: ${po.status?.toUpperCase()}`}
            </Text>
          </View>
        )}
        <View
          style={styles.continuationHeader}
          fixed
          render={({ pageNumber }: { pageNumber: number }) =>
            pageNumber > 1 && pageNumber <= tablePageCount
              ? [
                  <View key="sno" style={{ width: 28, flexShrink: 0, paddingRight: 5 }}>
                    <Text style={styles.th}>S.No</Text>
                  </View>,
                  ...columns.map((c) => (
                    <View key={c.key} style={{ width: widths[c.key], flexShrink: 0, paddingRight: 10 }}>
                      <Text style={styles.th}>{c.label}</Text>
                    </View>
                  )),
                ]
              : null
          }
        />

        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}>
              <Image src={LOGO_SRC} style={styles.logoImage} />
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.companyName}>{po.bill_to_snapshot?.name}</Text>
              <Text style={styles.small}>{po.bill_to_snapshot?.address}</Text>
              {(po.bill_to_snapshot?.contact_phone || po.bill_to_snapshot?.contact_email) ? (
                <Text style={styles.small}>
                  {[po.bill_to_snapshot?.contact_phone, po.bill_to_snapshot?.contact_email].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              <Link src="https://www.dciphers.com/" style={styles.websiteLink}>
                www.dciphers.com
              </Link>
            </View>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.poNumber}>{po.po_number}</Text>
            <Text style={styles.metaLine}>PO Date: {new Date(po.po_date).toLocaleDateString('en-IN')}</Text>
            <Text style={styles.metaLine}>Currency: {po.currency}</Text>
          </View>
        </View>

        <View style={styles.vendorBlock}>
          <Text style={styles.partyLabel}>Vendor</Text>
          <Text style={styles.partyName}>{po.vendors?.name}</Text>
          <Text style={styles.small}>{po.vendors?.address}</Text>
          {po.vendors?.gstin ? <Text style={styles.small}>GSTIN: {po.vendors.gstin}</Text> : null}
          {po.vendors?.pan ? <Text style={styles.small}>PAN: {po.vendors.pan}</Text> : null}
          {po.vendor_contact_person ? <Text style={styles.small}>Contact Person: {po.vendor_contact_person}</Text> : null}
          {po.vendor_contact_phone ? <Text style={styles.small}>Phone Number: {formatPhone(po.vendor_contact_phone)}</Text> : null}
          {po.quote_number ? <Text style={styles.small}>Quote #: {po.quote_number}</Text> : null}
        </View>

        <View style={styles.partiesRow}>
          <PartyBlock label="Bill To" party={po.bill_to_snapshot} />
          <View style={styles.partyBlockGap} />
          <PartyBlock label="Ship To" party={po.ship_to_snapshot} fallback={po.bill_to_snapshot} />
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <View style={{ width: 28, flexShrink: 0, paddingRight: 5 }}>
              <Text style={styles.th}>S.No</Text>
            </View>
            {columns.map((c) => (
              <View key={c.key} style={{ width: widths[c.key], flexShrink: 0, paddingRight: 10 }}>
                <Text style={styles.th}>{c.label}</Text>
              </View>
            ))}
          </View>
          {lineItems.map((li, rowIndex) => (
            <View style={[styles.tr, rowIndex % 2 === 1 ? styles.trAlt : {}]} key={li.id} wrap={false}>
              <View style={{ width: 28, flexShrink: 0, paddingRight: 5 }}>
                <Text style={[styles.cellText, styles.center]}>{rowIndex + 1}</Text>
              </View>
              {columns.map((c, i) => (
                <View key={c.key} style={{ width: widths[c.key], flexShrink: 0, paddingRight: 10 }}>
                  <Text
                    style={[
                      i === 0 ? styles.descriptionText : SMALL_FONT_KEYS.has(c.key) ? styles.cellTextSmall : styles.cellText,
                      c.key === 'qty' ? styles.center : NUMERIC_KEYS.has(c.key) ? styles.right : {},
                    ]}
                  >
                    {formatLineItemValue(c.key, getLineItemValue(li, c.key))}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>₹{money(po.subtotal)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>GST @ {po.gst_rate}%</Text>
              <Text style={styles.totalsValue}>₹{money(po.gst_amount)}</Text>
            </View>
            <View style={styles.totalsRowFinal}>
              <Text style={styles.totalsLabelFinal}>Grand Total</Text>
              <Text style={styles.totalsValueFinal}>₹{money(po.grand_total)}</Text>
            </View>
          </View>

          <Text style={[styles.small, { marginTop: 12 }]}>Value in words: {po.amount_in_words}</Text>
        </View>

        <View wrap={false}>
          <View style={styles.tncBlock}>
          <Text style={styles.tncLabel}>Terms &amp; Conditions</Text>
          <Text style={styles.tncText}>1. Purchase Order no &amp; date shall be mentioned along with each item on the invoice.</Text>
          <Text style={styles.tncText}>2. HSN/SAC code and item code as per P.O for each item shall be mentioned on the invoice.</Text>
          <Text style={styles.tncText}>3. Service Provider shall acknowledge the receipt of PO through e-mail within 3 (three) days of receipt of PO, failing which PO shall be considered as acknowledged.</Text>
          <Text style={styles.tncText}>4. The license and/or support documentation, along with the tax invoice, must be submitted to operations@dciphers.com</Text>
          <Text style={styles.tncText}>5. Material to be delivered shall accompany a copy of Purchase Order.</Text>
          {po.terms_and_conditions?.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
            <Text key={i} style={styles.tncText}>{6 + i}. {line}</Text>
          ))}
        </View>

        <View style={styles.footerRow} wrap={false}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerLine}>Invoice to be raised on :</Text>
            <Text style={[styles.footerLine, { fontFamily: 'NotoSans', fontWeight: 'bold' }]}>DCIPHERS IT SOLUTIONS PVT. LTD.</Text>
            {po.payment_terms ? <Text style={[styles.footerLine, { marginTop: 8 }]}>Payment Terms: {po.payment_terms}</Text> : null}
            {po.delivery_timeline ? <Text style={styles.footerLine}>Delivery: {po.delivery_timeline}</Text> : null}
            {po.service_validity ? <Text style={styles.footerLine}>Service Validity: {po.service_validity}</Text> : null}
            {po.creator?.full_name ? (
              <Text style={[styles.footerLine, { marginTop: 8 }]}>
                Ordered By:{'\n'}
                <Text style={{ fontFamily: 'NotoSans', fontWeight: 'bold' }}>{po.creator.full_name}</Text>
                {po.creator.phone ? ` (${formatPhone(po.creator.phone)})` : ''}
                {'\n'}DCIPHERS IT SOLUTIONS PVT. LTD.
              </Text>
            ) : null}
          </View>
          <View style={styles.footerRight}>
            <Image src={STAMP_SRC} style={styles.stampImage} />
            <Text style={styles.signatoryName}>Authorized Signatory</Text>
            <Text style={styles.signatureCaption}>DCIPHERS IT SOLUTIONS PVT. LTD.</Text>
          </View>
        </View>
        </View>

        <View style={styles.runningFooter} fixed>
          <Text style={styles.runningFooterText}>This is a system-generated Purchase Order.</Text>
          <Text
            style={styles.runningFooterText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
