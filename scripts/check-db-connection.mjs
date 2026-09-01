import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dns from 'node:dns';
import postgres from 'postgres';

dns.setDefaultResultOrder('ipv4first');

const envText = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf8');
const databaseUrl = envText.match(/^DATABASE_URL="([^"]+)"/m)?.[1];

if (!databaseUrl) {
  console.log('DATABASE_URL_MISSING');
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  ssl: getSslMode(databaseUrl),
  max: 1,
  idle_timeout: 5,
  connect_timeout: 60,
  prepare: false,
});

try {
  const rows = await sql`select 1 as ok`;
  console.log(`POSTGRES_QUERY_OK=${rows[0]?.ok === 1}`);
} catch (error) {
  console.log(`POSTGRES_QUERY_ERROR=${error.code ?? error.message}`);
} finally {
  await sql.end({ timeout: 1 }).catch(() => undefined);
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
