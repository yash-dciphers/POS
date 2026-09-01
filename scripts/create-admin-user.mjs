import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dns from 'node:dns';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

dns.setDefaultResultOrder('ipv4first');

const [, , emailArg, passwordArg, ...nameParts] = process.argv;
const fullName = nameParts.join(' ').trim();

if (!emailArg || !passwordArg || !fullName) {
  console.error('Usage: node scripts/create-admin-user.mjs <email> <password> <full name>');
  process.exit(1);
}

if (passwordArg.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const envPath = path.join(process.cwd(), '.env.local');
const envText = await fs.readFile(envPath, 'utf8');
const databaseUrlMatch = envText.match(/^DATABASE_URL=(?:"([^"]+)"|'([^']+)'|(.+))$/m);
const databaseUrl = databaseUrlMatch?.[1] ?? databaseUrlMatch?.[2] ?? databaseUrlMatch?.[3]?.trim();

if (!databaseUrl || databaseUrl.includes('ENTER_DATABASE_URL_HERE')) {
  throw new Error('DATABASE_URL is missing in .env.local');
}

const sql = postgres(databaseUrl, {
  ssl: getSslMode(databaseUrl),
  max: 1,
  idle_timeout: 5,
  connect_timeout: 60,
  prepare: false,
});

try {
  const email = emailArg.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(passwordArg, 12);

  const [{ id: companyId }] = await sql`
    select id from companies order by created_at asc limit 1
  `;

  const rows = await sql`
    insert into app_users (email, password_hash, email_verified_at)
    values (${email}, ${passwordHash}, now())
    on conflict (email) do update
      set password_hash = excluded.password_hash,
          is_active = true,
          email_verified_at = coalesce(app_users.email_verified_at, now())
    returning id
  `;

  const userId = rows[0].id;

  await sql`
    insert into profiles (id, company_id, full_name, role)
    values (${userId}, ${companyId}, ${fullName}, 'admin')
    on conflict (id) do update
      set full_name = excluded.full_name,
          role = 'admin',
          company_id = excluded.company_id
  `;

  console.log(`Admin user ready: ${email}`);
} finally {
  await sql.end({ timeout: 1 });
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
