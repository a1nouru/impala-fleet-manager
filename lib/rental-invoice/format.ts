export type InvoiceLine = { code: string; description: string; unit: string; qty: number; unit_price: number }

export const DEFAULT_LINE_DESCRIPTION = 'Prestação de serviço ALUGUER DE AUTOCARRO'
export const DEFAULT_IVA_EXEMPTION = 'Transmissão de bens e serviço não sujeita'

/** Angolan invoice style: 2.850.000,00 Kz (Intl pt-PT groups with spaces, which the sample does not). */
export function formatKz(value: number): string {
  const [int, dec] = Math.abs(value).toFixed(2).split('.')
  return `${value < 0 ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} Kz`
}

export const seriesFor = (prefix: string, issueDate: string) => `${prefix}${issueDate.slice(0, 4)}`
export const invoiceLabel = (series: string, number: number) => `${series}/${number}`

const cents = (n: number) => Math.round(n * 100) / 100

/** Same arithmetic as create_rental_invoice: IVA applies to the subtotal after the discount. */
export function computeTotals(lines: Pick<InvoiceLine, 'qty' | 'unit_price'>[], ivaRate: number, discount = 0) {
  const subtotal = cents(lines.reduce((s, l) => s + cents(l.qty * l.unit_price), 0))
  const base = cents(subtotal - discount)
  const total = cents(base * (1 + ivaRate / 100))
  return { subtotal, iva: cents(total - base), total }
}

export type PaymentState = 'paid' | 'partial' | 'unpaid'
export function paymentState(total: number, paid: number): PaymentState {
  if (paid >= total - 0.005) return 'paid'
  return paid > 0 ? 'partial' : 'unpaid'
}
