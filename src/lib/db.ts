import dns from 'dns';
import postgres from 'postgres';

dns.setDefaultResultOrder('ipv4first');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Add your PostgreSQL connection string to .env.local.');
}

declare global {
  // eslint-disable-next-line no-var
  var dciphersSql: postgres.Sql | undefined;
}

export const sql =
  globalThis.dciphersSql ??
  postgres(connectionString, {
    ssl: getSslMode(connectionString),
    max: 10,
    idle_timeout: 20,
    connect_timeout: 60,
    prepare: false,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.dciphersSql = sql;
}

export type Db = typeof sql;

export function jsonb(value: unknown) {
  return JSON.stringify(value);
}

function getSslMode(url: string) {
  const parsed = new URL(url);
  const sslMode = parsed.searchParams.get('sslmode');
  const hostname = parsed.hostname.toLowerCase();

  if (sslMode === 'disable' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return false;
  }

  return 'require';
}

export function one<T>(rows: T[]) {
  return rows[0] ?? null;
}
