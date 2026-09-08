-- ============================================================================
-- DCIPHERS Purchase Order Management System
-- PostgreSQL bootstrap schema
--
-- Run this on a fresh PostgreSQL database.
--   - Authorization must be enforced by the Next.js application layer.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- app_users: application-owned login table.
-- password_hash stays nullable until the auth replacement phase wires password
-- creation/reset flows.
-- ----------------------------------------------------------------------------
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  email_verified_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_sessions_user on app_sessions(user_id);
create index if not exists idx_app_sessions_expires_at on app_sessions(expires_at);

-- ----------------------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  gstin text not null,
  pan text not null,
  logo_url text,
  stamp_signature_url text,
  default_signatory_name text,
  default_signatory_phone text,
  default_gst_rate numeric(5,2) not null default 18.00,
  contact_email text,
  contact_phone text,
  renewal_window_days integer not null default 90,
  renewal_urgent_days integer not null default 30,
  debits_due_soon_days integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- profiles: role and company scope for app_users.
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references app_users(id) on delete cascade,
  company_id uuid not null references companies(id),
  full_name text not null,
  role text not null check (role in ('user', 'admin')),
  phone text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- vendors
-- ----------------------------------------------------------------------------
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  address text,
  gstin text,
  pan text,
  contact_person text,
  contact_phone text,
  contact_email text,
  quote_number text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vendors_company on vendors(company_id);
create index if not exists idx_vendors_name_trgm on vendors using gin (name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- po_number_sequences: one unified sequence per company and fiscal year.
-- ----------------------------------------------------------------------------
create table if not exists po_number_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  fiscal_year text not null,
  last_number integer not null default 0,
  unique (company_id, fiscal_year)
);

-- ----------------------------------------------------------------------------
-- purchase_orders
-- ----------------------------------------------------------------------------
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  po_number text not null,
  series_prefix text not null check (series_prefix in ('PRH', 'PRS')),
  fiscal_year text not null,
  po_date date not null,
  vendor_id uuid not null references vendors(id),
  quote_number text,
  vendor_contact_person text,
  vendor_contact_phone text,
  bill_to_snapshot jsonb not null,
  ship_to_snapshot jsonb,
  currency text not null default 'INR',
  gst_rate numeric(5,2) not null default 18.00,
  subtotal numeric(14,2) not null default 0,
  gst_amount numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  amount_in_words text,
  delivery_timeline text,
  payment_terms text,
  payment_terms_type text check (payment_terms_type in ('credit', 'pdc', 'immediate')),
  payment_terms_days integer,
  service_validity text,
  terms_and_conditions text,
  line_item_columns jsonb not null default '[]'::jsonb,
  status text not null default 'issued' check (status in ('draft', 'pending_approval', 'issued', 'cancelled')),
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  requested_approver_id uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references profiles(id) on delete set null,
  rejection_reason text,
  rejected_by uuid references profiles(id) on delete set null,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table purchase_orders
  add column if not exists requested_approver_id uuid references profiles(id) on delete set null;

create unique index if not exists purchase_orders_po_number_live_key on purchase_orders (po_number) where deleted_at is null;
create index if not exists idx_po_company on purchase_orders(company_id);
create index if not exists idx_po_vendor on purchase_orders(vendor_id);
create index if not exists idx_po_created_at on purchase_orders(created_at desc);
create index if not exists idx_po_status on purchase_orders(status);
create index if not exists idx_po_requested_approver on purchase_orders(requested_approver_id);

-- ----------------------------------------------------------------------------
-- po_line_items
-- ----------------------------------------------------------------------------
create table if not exists po_line_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  sort_order integer not null default 0,
  description text not null,
  part_code text,
  hsn_sac_code text,
  qty numeric(12,2) not null default 1,
  unit_price numeric(14,2),
  total_price numeric(14,2) not null default 0,
  term_start_date date,
  term_end_date date,
  custom_fields jsonb not null default '{}'::jsonb
);

create index if not exists idx_line_items_po on po_line_items(po_id);

-- ----------------------------------------------------------------------------
-- po_audit_log
-- ----------------------------------------------------------------------------
create table if not exists po_audit_log (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  changed_by uuid references profiles(id) on delete set null,
  action text not null,
  diff jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists idx_audit_po on po_audit_log(po_id);

-- ----------------------------------------------------------------------------
-- po_payments
-- ----------------------------------------------------------------------------
create table if not exists po_payments (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  remark text,
  recorded_by uuid references profiles(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_po_payments_po on po_payments(po_id);

-- ----------------------------------------------------------------------------
-- updated_at maintenance trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_users_updated_at on app_users;
create trigger trg_app_users_updated_at before update on app_users
  for each row execute function set_updated_at();

drop trigger if exists trg_companies_updated_at on companies;
create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();

drop trigger if exists trg_vendors_updated_at on vendors;
create trigger trg_vendors_updated_at before update on vendors
  for each row execute function set_updated_at();

drop trigger if exists trg_po_updated_at on purchase_orders;
create trigger trg_po_updated_at before update on purchase_orders
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- PO number reservation
-- ----------------------------------------------------------------------------
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

  select coalesce(max((regexp_match(po_number, '/(\d+)$'))[1]::integer), 0)
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

-- ----------------------------------------------------------------------------
-- Seed data
-- ----------------------------------------------------------------------------
insert into companies (
  name,
  address,
  gstin,
  pan,
  default_signatory_name,
  default_signatory_phone,
  contact_email,
  contact_phone
)
select
  'DCIPHERS IT SOLUTIONS PVT. LTD.',
  'OC-825, Gaur City Center, Gr Noida-(W), UP-201318',
  '09AAHCD6786G1Z5',
  'AAHCD6786G',
  'Shraddha Nand',
  '9971320368',
  'contact@dciphers.com',
  '+91 120 3678741'
where not exists (select 1 from companies);

insert into po_number_sequences (company_id, fiscal_year, last_number)
select id, '26-27', 7 from companies
where not exists (
  select 1 from po_number_sequences
  where po_number_sequences.company_id = companies.id
    and po_number_sequences.fiscal_year = '26-27'
)
limit 1;
