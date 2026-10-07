-- ============================================================================
-- Quantity is a count of things, so it is a whole number by definition.
--
-- It was declared numeric(12,2), which meant the driver returned every
-- quantity as a string like "1.00" and the PO page and PDF printed quantities
-- with a decimal part. The application layer already refuses a non-integer
-- quantity (see lineTotal() in src/lib/gst.ts and the form's own validation),
-- so no stored value needs rounding — this makes the column match the rule the
-- rest of the system has always enforced, and makes a fractional quantity
-- impossible to store at all.
--
-- Guarded so re-running the whole migration set stays a no-op once applied.
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'po_line_items'
      and column_name = 'qty'
      and data_type <> 'integer'
  ) then
    alter table po_line_items
      alter column qty type integer using round(qty)::integer,
      alter column qty set default 1;
  end if;
end $$;
