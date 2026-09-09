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
MS_TENANT_ID="ENTER_MICROSOFT_TENANT_ID_HERE"
MS_CLIENT_ID="ENTER_MICROSOFT_CLIENT_ID_HERE"
MS_CLIENT_SECRET="ENTER_MICROSOFT_CLIENT_SECRET_HERE"
MAIL_FROM="DCIPHERS <sender@dciphers.com>"
APP_URL="http://localhost:3000"
CRON_SECRET="ENTER_A_LONG_RANDOM_SECRET_HERE"
```

Use `sslmode=disable` for local Docker Postgres.
For production, set `APP_URL` to the deployed site URL and configure Microsoft Graph application permissions for the sender mailbox.
The scheduled workflow runs on the production self-hosted runner, checks urgent renewals daily at 09:00 India time, and emails every active company user. It uses `CRON_SECRET` when configured and otherwise securely falls back to the container's existing `AUTH_SECRET`.

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
