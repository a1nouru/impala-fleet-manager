import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTotals, formatKz, invoiceLabel, paymentState, seriesFor } from './format.ts'

test('formats like the AGT sample', () => {
  assert.equal(formatKz(2850000), '2.850.000,00 Kz')
  assert.equal(formatKz(15300000), '15.300.000,00 Kz')
  assert.equal(formatKz(0), '0,00 Kz')
  assert.equal(formatKz(999.5), '999,50 Kz')
})

test('numbers per yearly series', () => {
  assert.equal(seriesFor('PP 01P', '2026-09-25'), 'PP 01P2026')
  assert.equal(invoiceLabel('PP 01P2026', 61), 'PP 01P2026/61')
})

test('totals match the ENAPP sample', () => {
  const lines = [2850000, 2400000, 2850000, 2100000, 2100000, 3000000].map(p => ({ qty: 1, unit_price: p }))
  assert.deepEqual(computeTotals(lines, 0), { subtotal: 15300000, iva: 0, total: 15300000 })
  assert.deepEqual(computeTotals([{ qty: 2, unit_price: 100.25 }], 14), { subtotal: 200.5, iva: 28.07, total: 228.57 })
})

test('payment state from receipts', () => {
  assert.equal(paymentState(100, 0), 'unpaid')
  assert.equal(paymentState(100, 40), 'partial')
  assert.equal(paymentState(100, 100), 'paid')
})
