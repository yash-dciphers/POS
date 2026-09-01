import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dns from 'node:dns';
import postgres from 'postgres';

dns.setDefaultResultOrder('ipv4first');

const envPath = path.join(process.cwd(), '.env.local');
const schemaPath = path.join(process.cwd(), 'db', 'migrations', '001_schema.sql');

const envText = await fs.readFile(envPath, 'utf8');
const databaseUrlMatch = envText.match(/^DATABASE_URL=(?:"([^"]+)"|'([^']+)'|(.+))$/m);
const databaseUrl = databaseUrlMatch?.[1] ?? databaseUrlMatch?.[2] ?? databaseUrlMatch?.[3]?.trim();

if (!databaseUrl || databaseUrl.includes('ENTER_DATABASE_URL_HERE')) {
  throw new Error('DATABASE_URL is missing in .env.local');
}

const schema = await fs.readFile(schemaPath, 'utf8');
const sql = postgres(databaseUrl, {
  ssl: getSslMode(databaseUrl),
  max: 1,
  idle_timeout: 5,
  connect_timeout: 60,
  prepare: false,
});

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(schema);
  });

  const [{ table_count: tableCount }] = await sql`
    select count(*)::int as table_count
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'app_users',
        'app_sessions',
        'companies',
        'profiles',
        'vendors',
        'po_number_sequences',
        'purchase_orders',
        'po_line_items',
        'po_audit_log',
        'po_payments'
      )
  `;

  const [{ company_count: companyCount }] = await sql`
    select count(*)::int as company_count from companies
  `;

  console.log(`Database schema applied. Tables ready: ${tableCount}/10. Companies: ${companyCount}.`);
} finally {
  await sql.end();
}

function getSslMode(url) {
  const parsed = new URL(url);
  const sslMode = parsed.searchParams.get('sslmode');
  const hostname = parsed.hostname.toLowerCase();

  if (sslMode === 'disable' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return false;
  }

  return 'require';
}
