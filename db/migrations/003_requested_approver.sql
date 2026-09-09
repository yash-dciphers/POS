-- Upgrade existing databases for the selected approval-admin workflow.
-- Existing POs keep a null approver; no PO records are changed or removed.
alter table purchase_orders
  add column if not exists requested_approver_id uuid references profiles(id) on delete set null;

create index if not exists idx_po_requested_approver
  on purchase_orders(requested_approver_id);
