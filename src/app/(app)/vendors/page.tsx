import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import VendorsClient from './VendorsClient';

export default async function VendorsPage() {
  const user = await requireUser();
  const vendors = await sql`
    select *
    from vendors
    where company_id = ${user.company_id}
    order by name
  `;

  return <VendorsClient initialVendors={vendors as any} />;
}
