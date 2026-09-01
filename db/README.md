# Database

This folder contains the PostgreSQL database setup.

## Step 1: Add database connection string

Create `.env.local` in the project root and add:

```env
DATABASE_URL="ENTER_DATABASE_URL_HERE"
```

Replace `ENTER_DATABASE_URL_HERE` with your PostgreSQL connection string. Use
`sslmode=require` for hosted databases and `sslmode=disable` for local Docker
Postgres.

## Step 2: Run schema

Run the schema against a fresh PostgreSQL database:

```bash
npm run db:schema
```

The application enforces authorization in the Next.js server layer.

## Bootstrap first admin

After the schema is applied, create the first admin user:

```bash
npm run db:admin -- admin@example.com "StrongPassword123" "Admin Name"
```

This writes to `app_users` and `profiles`. The app login screen uses this
account immediately.
