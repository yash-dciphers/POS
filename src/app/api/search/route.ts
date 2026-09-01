import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ results: [] });

  const vendors = await sql`
    select id, name, gstin
    from vendors
    where company_id = ${user.company_id}
      and name ilike ${`%${q}%`}
    order by name
    limit 6
  `;

  const pos = await sql`
    select distinct p.id, p.po_number, p.status, v.name as vendor_name
    from purchase_orders p
    join vendors v on v.id = p.vendor_id
    where p.company_id = ${user.company_id}
      and p.deleted_at is null
      and (p.po_number ilike ${`%${q}%`} or v.name ilike ${`%${q}%`})
    order by p.po_number
    limit 8
  `;

  return NextResponse.json({
    results: [
      ...pos.map((po) => ({ type: 'po', ...po })),
      ...vendors.map((vendor) => ({ type: 'vendor', ...vendor })),
    ],
  });
}
