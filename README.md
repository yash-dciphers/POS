# DCIPHERS Purchase Order Management System

Internal PO generator and repository, replacing the previous Excel-based
process. Built with Next.js (App Router), TypeScript, Tailwind, PostgreSQL,
app-owned email/password auth, and `@react-pdf/renderer` for PDF generation.

## Setup

1. Create a PostgreSQL database. Docker Postgres works locally; Neon or any hosted PostgreSQL provider works in production.
2. Copy `.env.local.example` to `.env.local`.
3. Fill in:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require"
```

Use `sslmode=disable` for local Docker Postgres.

4. Apply the schema:

```bash
npm run db:schema
```

5. Create the first admin:

```bash
npm run db:admin -- admin@example.com "StrongPassword123" "Admin Name"
```

6. Install and run:

```bash
npm install
npm run dev
```

Visit the local URL printed by Next.js and sign in.

## Project Structure

```text
src/
  app/
    login/              Sign-in screen
    (app)/              Authenticated shell
      dashboard/        PO list, search/filter, stat cards
      po/new/           PO creation form + server action
      po/[id]/          PO detail / document view
      vendors/          Vendor repository
      settings/         Company profile + numbering series
      users/            User creation and role management
      audit-log/        Change history
    api/                PDF, search, and vendor lookup routes
  components/           Sidebar, TopBar, VendorAutocomplete, LineItemsEditor
  lib/
    auth/               Password hashing and cookie sessions
    db.ts               PostgreSQL client
    po-numbering.ts     Fiscal-year calc + atomic next-number reservation
    gst.ts              Subtotal/GST/total calculation
    number-to-words.ts  Indian lakh/crore amount-in-words
    types.ts            Shared TypeScript types
  pdf/
    PurchaseOrderDocument.tsx
db/migrations/          PostgreSQL schema
scripts/                Schema and admin-user helpers
```

## Business Rules

- PO numbering resets every fiscal year (April-March, Indian FY).
- PRH and PRS are category labels only; both share one running number per
  fiscal year.
- Non-admin-created issued POs go to Admin approval first.
- PO deletion is soft delete, so audit history is preserved.
- Flat GST rate only.
- Paise-level precision is preserved throughout.
