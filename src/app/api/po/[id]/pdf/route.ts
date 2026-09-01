import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import PurchaseOrderDocument from '@/pdf/PurchaseOrderDocument';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();

  const [po] = await sql`
    select
      p.*,
      to_jsonb(v.*) as vendors,
      case when creator.id is null then null else jsonb_build_object('full_name', creator.full_name, 'phone', creator.phone) end as creator
    from purchase_orders p
    join vendors v on v.id = p.vendor_id
    left join profiles creator on creator.id = p.created_by
    where p.id = ${params.id}
      and p.company_id = ${user.company_id}
    limit 1
  `;
  if (!po) return new NextResponse('Not found', { status: 404 });

  const lineItems = await sql`select * from po_line_items where po_id = ${po.id} order by sort_order`;

  const buffer = await renderToBuffer(
    createElement(PurchaseOrderDocument, { po: po as any, lineItems: lineItems as any }) as any
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${po.po_number.replace(/\//g, '-')}.pdf"`,
    },
  });
}
