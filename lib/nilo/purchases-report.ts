// The purchases report for a date range: every invoice's line totals, a per-supplier summary
// and the grand total, plus the same lines flattened for CSV. Pure; the page only renders it.
import type { Invoice, InvoiceLine } from "./client";

const cents = (n: number) => Math.round(n * 100) / 100;

export const lineTotal = (l: InvoiceLine) => cents(Number(l.quantity) * Number(l.unit_cost));

export const supplierName = (inv: Invoice) => inv.supplier?.trim() || (inv.supplier_nif ? `NIF ${inv.supplier_nif}` : "—");

export type ReportInvoice = Invoice & { linesTotal: number };

export type PurchasesReport = {
  invoices: ReportInvoice[];
  suppliers: { key: string; name: string; invoices: number; amount: number }[];
  lineCount: number;
  pendingCount: number;
  grandTotal: number;
};

export function buildPurchasesReport(invoices: Invoice[]): PurchasesReport {
  const withTotals = invoices.map((inv) => ({ ...inv, linesTotal: cents(inv.lines.reduce((n, l) => n + lineTotal(l), 0)) }));
  // Keyed by NIF: the same supplier is often typed with different spellings.
  const suppliers = new Map<string, PurchasesReport["suppliers"][number]>();
  for (const inv of withTotals) {
    const key = inv.supplier_nif || inv.supplier || "—";
    const s = suppliers.get(key) ?? { key, name: supplierName(inv), invoices: 0, amount: 0 };
    suppliers.set(key, { ...s, invoices: s.invoices + 1, amount: cents(s.amount + inv.linesTotal) });
  }
  return {
    invoices: withTotals,
    suppliers: [...suppliers.values()].sort((a, b) => b.amount - a.amount),
    lineCount: invoices.reduce((n, i) => n + i.lines.length, 0),
    pendingCount: invoices.filter((i) => i.status !== "approved").length,
    grandTotal: cents(withTotals.reduce((n, i) => n + i.linesTotal, 0)),
  };
}

const CSV_HEADER = ["Date", "Supplier", "NIF", "Invoice no.", "Status", "Item", "Description on invoice", "Qty", "Unit price (Kz)", "Total (Kz)"];

// One row per invoice line; BOM so Excel opens the accents correctly.
export function purchasesCsv(invoices: Invoice[]): string {
  const rows = invoices.flatMap((inv) =>
    inv.lines.map((l) => [
      inv.invoice_date,
      supplierName(inv),
      inv.supplier_nif ?? "",
      inv.invoice_no ?? "",
      inv.status === "approved" ? "Approved" : "Needs approval",
      l.item?.name ?? "",
      l.ocr_description ?? "",
      String(Number(l.quantity)),
      Number(l.unit_cost).toFixed(2),
      lineTotal(l).toFixed(2),
    ]),
  );
  const q = (v: string) => `"${v.replaceAll('"', '""')}"`;
  return "﻿" + [CSV_HEADER, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
}
