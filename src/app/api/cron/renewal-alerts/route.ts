import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { notifyUsersOfCurrentUrgentRenewals } from '@/lib/renewal-notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // A dedicated secret is preferred, but existing deployments already have
  // AUTH_SECRET inside the container. Falling back to it lets the self-hosted
  // daily workflow authenticate without copying a secret into GitHub.
  const configuredSecret = process.env.CRON_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json({ error: 'CRON_SECRET or AUTH_SECRET is not configured.' }, { status: 500 });
  }

  const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const querySecret = request.nextUrl.searchParams.get('secret')?.trim();
  const providedSecret = bearerToken || querySecret;

  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companies = await sql<{ id: string }[]>`select id from companies`;
  const results = [];

  for (const company of companies) {
    const result = await notifyUsersOfCurrentUrgentRenewals(company.id);
    results.push({ companyId: company.id, ...result });
  }

  return NextResponse.json({
    ok: true,
    companies: results.length,
    results,
  });
}
