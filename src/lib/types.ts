export interface Vendor {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  quote_number: string | null;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  gstin: string;
  pan: string;
  default_gst_rate: number;
}

export interface Profile {
  id: string;
  company_id: string;
  full_name: string;
  role: 'user' | 'admin';
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  series_prefix: 'PRH' | 'PRS';
  fiscal_year: string;
  po_date: string;
  vendor_id: string;
  currency: string;
  gst_rate: number;
  subtotal: number;
  gst_amount: number;
  grand_total: number;
  amount_in_words: string | null;
  delivery_timeline: string | null;
  payment_terms: string | null;
  service_validity: string | null;
  terms_and_conditions: string | null;
  status: 'draft' | 'issued' | 'cancelled';
}

export interface LineItem {
  id: string;
  po_id: string;
  sort_order: number;
  description: string;
  part_code: string | null;
  hsn_sac_code: string | null;
  qty: number;
  unit_price: number | null;
  total_price: number;
  custom_fields: Record<string, unknown>;
}
