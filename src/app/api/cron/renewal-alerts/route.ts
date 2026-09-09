import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { notifyAdminsOfCurrentUrgentRenewals } from '@/lib/renewal-notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
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
    const result = await notifyAdminsOfCurrentUrgentRenewals(company.id);
    results.push({ companyId: company.id, ...result });
  }

  return NextResponse.json({
    ok: true,
    companies: results.length,
    results,
  });
}
