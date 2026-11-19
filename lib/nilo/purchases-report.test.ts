import { test } from "node:test";
import assert from "node:assert/strict";
import type { Invoice, InvoiceLine } from "./client.ts";
import { buildPurchasesReport, purchasesCsv } from "./purchases-report.ts";

const line = (quantity: number, unit_cost: number, name = "Silicone"): InvoiceLine => ({
  id: name + quantity, ocr_description: name, quantity, unit_cost, container_size: null, labels_generated: 0,
  item: { name, kind: "unit", measure_unit: null },
});
const inv = (supplier: string, nif: string, lines: InvoiceLine[], status: Invoice["status"] = "approved"): Invoice => ({
  id: supplier + lines.length, supplier, supplier_nif: nif, invoice_no: "FR 1", invoice_date: "2026-11-12", total: null,
  file_path: null, status, checks: [], approved_by: null, uploaded_by: "x", source_company: "impala", lines,
});

test("totals come from qty × unit price, suppliers merge by NIF despite spelling", () => {
  const r = buildPurchasesReport([
    inv("VIGOR AUTO-COMÉRCIO E SERVIÇOS (SU), LDA", "5003130460", [line(3, 3420), line(2, 6840, "Retentor")]),
    inv("VIGOR AUTO-COMÉRCIO E SERVIÇOS ", "5003130460", [line(20, 3420)]),
    inv("CHS", "5417561592", [line(1, 350000, "Cupla")], "pending_approval"),
  ]);
  assert.deepEqual(r.invoices.map((i) => i.linesTotal), [23940, 68400, 350000]);
  assert.equal(r.grandTotal, 442340);
  assert.equal(r.lineCount, 4);
  assert.equal(r.pendingCount, 1);
  assert.deepEqual(r.suppliers.map((s) => [s.name, s.invoices, s.amount]), [
    ["CHS", 1, 350000],
    ["VIGOR AUTO-COMÉRCIO E SERVIÇOS (SU), LDA", 2, 92340],
  ]);
});

test("CSV has one quoted row per line and escapes quotes", () => {
  const csv = purchasesCsv([inv('Loja "A"', "1", [line(2, 1500.5)])]);
  const [head, row] = csv.slice(1).split("\r\n");
  assert.ok(head.startsWith('"Date","Supplier"'));
  assert.equal(row, '"2026-11-12","Loja ""A""","1","FR 1","Approved","Silicone","Silicone","2","1500.50","3001.00"');
});
