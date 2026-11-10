import { test } from "node:test";
import assert from "node:assert/strict";
import { checkInvoice, nifAndNumber, type InvoiceDraft, type Known } from "./invoice-checks.ts";

const today = new Date("2026-11-09T12:00:00Z");
const none: Known = { nifAndNumber: new Set(), fileHashes: new Set() };
const inv = (o: Partial<InvoiceDraft> = {}): InvoiceDraft => ({
  supplierNif: "5417 000 123",
  invoiceNo: "FT 2026/88",
  fileSha256: "abc",
  invoiceDate: "2026-11-05",
  total: 450000,
  lines: [{ quantity: 6, unitCost: 75000 }],
  editedByHand: false,
  ...o,
});

test("a clean invoice is approved without a human", () => {
  assert.deepEqual(checkInvoice(inv(), none, today), { status: "approved", checks: [] });
});

test("the same supplier invoice number is blocked even when typed differently", () => {
  const known = { ...none, nifAndNumber: new Set([nifAndNumber("5417000123", "ft 2026/88 ")]) };
  assert.equal(checkInvoice(inv(), known, today).status, "blocked");
});

test("re-uploading the identical file is blocked", () => {
  assert.equal(checkInvoice(inv(), { ...none, fileHashes: new Set(["abc"]) }, today).status, "blocked");
});

test("totals within 1 Kz pass; larger gaps need an approver", () => {
  assert.equal(checkInvoice(inv({ total: 450000.8 }), none, today).status, "approved");
  const v = checkInvoice(inv({ total: 460000 }), none, today);
  assert.equal(v.status, "pending_approval");
  assert.match(v.checks[0].reason, /450000.00 Kz but the invoice total is 460000.00/);
});

test("suspicious dates, zero lines and hand edits each need an approver", () => {
  for (const o of [
    { invoiceDate: "2026-11-20" },
    { invoiceDate: "2026-08-01" },
    { lines: [{ quantity: 6, unitCost: 75000 }, { quantity: 0, unitCost: 1 }] },
    { editedByHand: true },
  ]) assert.equal(checkInvoice(inv(o), none, today).status, "pending_approval", JSON.stringify(o));
});

test("a blocked invoice stays blocked even if it also has flags", () => {
  const v = checkInvoice(inv({ editedByHand: true }), { ...none, fileHashes: new Set(["abc"]) }, today);
  assert.equal(v.status, "blocked");
  assert.equal(v.checks.length, 2);
});
