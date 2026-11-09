import { createClient } from '@/lib/supabase/client';
import type { InvoiceDoc } from '@/components/rental-invoice/invoice-document';
import type { InvoiceLine } from '@/lib/rental-invoice/format';

const supabase = createClient();

export type NewInvoice = {
  series: string; issue_date: string; due_date: string; rental_start_date: string; rental_end_date: string
  client_name: string; client_nif: string; client_address: string; client_contact: string; notes: string
  discount: number; iva_rate: number; lines: InvoiceLine[]
}
export type InvoiceSummary = { id: string; rental_id: string; series: string; number: number; total: number; public_token: string }

export const rentalInvoiceService = {
  async create(p: NewInvoice): Promise<{ id: string; rental_id: string }> {
    const { data, error } = await supabase.rpc('create_rental_invoice', { p });
    if (error) throw error;
    return data;
  },

  /** Invoice per rental, for the Rental list badges. */
  async summariesByRental(): Promise<Record<string, InvoiceSummary>> {
    const { data, error } = await supabase.from('rental_invoices').select('id, rental_id, series, number, total, public_token');
    if (error) throw error;
    return Object.fromEntries((data ?? []).map(i => [i.rental_id, i]));
  },

  async getById(id: string): Promise<{ doc: InvoiceDoc; rentalId: string }> {
    const { data, error } = await supabase.from('rental_invoices').select('rental_id, public_token').eq('id', id).single();
    if (error) throw error;
    const doc = await this.getPublic(data.public_token);
    if (!doc) throw new Error('Invoice not found');
    return { doc, rentalId: data.rental_id };
  },

  async getPublic(token: string): Promise<InvoiceDoc | null> {
    const { data, error } = await supabase.rpc('public_rental_invoice', { p_token: token });
    if (error) throw error;
    return data;
  },
};
