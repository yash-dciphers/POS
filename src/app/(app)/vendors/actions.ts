'use server';

import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

export interface CreateVendorInput {
  name: string;
  address?: string;
  gstin?: string;
  pan?: string;
}

export async function createVendor(input: CreateVendorInput) {
  const user = await requireUser();

  if (!input.name?.trim()) throw new Error('Vendor name is required');

  const [data] = await sql`
    insert into vendors (company_id, name, address, gstin, pan, created_by)
    values (${user.company_id}, ${input.name.trim()}, ${input.address || null}, ${input.gstin || null}, ${input.pan || null}, ${user.id})
    returning *
  `;

  revalidatePath('/vendors');
  return data;
}

export interface UpdateVendorInput {
  id: string;
  name: string;
  address?: string;
  gstin?: string;
  pan?: string;
}

// Available to any user in the company, not just Admins — vendor records
// aren't sensitive the way company settings are, and anyone creating POs
// for a vendor should be able to fix a stale address or GSTIN.
export async function updateVendor(input: UpdateVendorInput) {
  const user = await requireUser();

  if (!input.name?.trim()) throw new Error('Vendor name is required');

  const [data] = await sql`
    update vendors
    set name = ${input.name.trim()},
        address = ${input.address || null},
        gstin = ${input.gstin || null},
        pan = ${input.pan || null}
    where id = ${input.id}
      and company_id = ${user.company_id}
    returning *
  `;
  if (!data) throw new Error('Vendor not found');

  revalidatePath('/vendors');
  return data;
}
