import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const gstin = searchParams.get('gstin')?.trim() ?? '';

  if (gstin) {
    const vendors = await sql`
      select id, name
      from vendors
      where company_id = ${user.company_id}
        and gstin = ${gstin}
      order by name
      limit 5
    `;
    return NextResponse.json({ vendors });
  }

  if (!q) return NextResponse.json({ vendors: [] });

  const vendors = await sql`
    select *
    from vendors
    where company_id = ${user.company_id}
      and name ilike ${`%${q}%`}
    order by name
    limit 8
  `;
  return NextResponse.json({ vendors });
}
