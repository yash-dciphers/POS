-- ============================================================================
-- Drafts get their own numbering series.
--
-- Previously every PO reserved a number from the one running series the moment
-- it was created, drafts included — so a draft that was never issued burned a
-- real PO number permanently. Drafts now take a provisional number from a
-- separate per-company/fiscal-year counter, formatted with /DRAFT/ in place of
-- /PO/ so the two series can never be confused:
--
--   real   DCIPHERS/26-27/PO/PRS/04
--   draft  DCIPHERS/26-27/DRAFT/PRS/01
--
-- A draft is given a real number only when it leaves draft status, and it takes
-- whatever the next free number is at that moment. Numbers already handed out
-- are never reshuffled: an issued PO's number may already be printed on a PDF
-- sitting in a vendor's inbox.
-- ============================================================================

alter table po_number_sequences
  add column if not exists last_draft_number integer not null default 0;

-- next_po_sequence previously matched any number ending in "/<digits>", which
-- now also matches a draft number's trailing counter. Anchoring on the /PO/
-- segment keeps the real series blind to drafts.
create or replace function next_po_sequence(
  p_company_id uuid,
  p_series_prefix text,
  p_fiscal_year text
) returns integer as $$
declare
  v_next integer;
  v_live_max integer;
begin
  insert into po_number_sequences (company_id, fiscal_year, last_number)
  values (p_company_id, p_fiscal_year, 0)
  on conflict (company_id, fiscal_year) do nothing;

  perform 1 from po_number_sequences
  where company_id = p_company_id and fiscal_year = p_fiscal_year
  for update;

  select coalesce(max((regexp_match(po_number, '/PO/(?:PRH|PRS)/(\d+)$'))[1]::integer), 0)
  into v_live_max
  from purchase_orders
  where company_id = p_company_id
    and fiscal_year = p_fiscal_year
    and deleted_at is null;

  v_next := v_live_max + 1;

  update po_number_sequences
  set last_number = v_next
  where company_id = p_company_id and fiscal_year = p_fiscal_year;

  return v_next;
end;
$$ language plpgsql;

-- Draft counter. Never reused: promoting a draft leaves a gap in the draft
-- series, which is fine — draft numbers are scratch identifiers, not records.
create or replace function next_draft_sequence(
  p_company_id uuid,
  p_fiscal_year text
) returns integer as $$
declare
  v_next integer;
begin
  insert into po_number_sequences (company_id, fiscal_year, last_number)
  values (p_company_id, p_fiscal_year, 0)
  on conflict (company_id, fiscal_year) do nothing;

  update po_number_sequences
  set last_draft_number = last_draft_number + 1
  where company_id = p_company_id and fiscal_year = p_fiscal_year
  returning last_draft_number into v_next;

  return v_next;
end;
$$ language plpgsql;
