"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { nilo, type Invoice } from "@/lib/nilo/client";
import { buildPurchasesReport, lineTotal, purchasesCsv, supplierName } from "@/lib/nilo/purchases-report";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
const cents = (n: number) => Math.round(n * 100) / 100;
const longDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const monthStart = (d = new Date()) => iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
const lastMonth = () => {
  const n = new Date();
  return { from: iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1))), to: iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0))) };
};

const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const label = "font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500";
const cell = "border border-gray-300 px-2 py-1.5";

// Purchases report for a date range: every invoice with its lines, unit prices and totals.
// Print → "Save as PDF" is the PDF export; the CSV is for spreadsheets.
function PurchasesReport() {
  const params = useSearchParams();
  const router = useRouter();
  const from = params.get("from") ?? monthStart();
  const to = params.get("to") ?? today();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setInvoices(null);
    setError("");
    nilo<Invoice[]>(`purchases?from=${from}&to=${to}`).then(setInvoices, (e) => setError(String(e.message)));
    document.title = `Nilo purchases ${from} to ${to}`;
  }, [from, to]);

  const go = (f: string, t: string) => router.replace(`/nilo/purchases?from=${f}&to=${t}`);

  const report = invoices && buildPurchasesReport(invoices);

  const csv = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([purchasesCsv(invoices ?? [])], { type: "text/csv" }));
    a.download = `nilo-purchases-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const btn = "min-h-11 rounded border border-gray-300 bg-white px-3 py-2 text-sm sm:min-h-9 sm:py-1.5";

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 p-4 print:hidden">
        <label className="text-sm">
          <span className="block text-xs text-gray-500">From</span>
          <input type="date" className={btn} value={from} max={to} onChange={(e) => e.target.value && go(e.target.value, to)} />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-gray-500">To</span>
          <input type="date" className={btn} value={to} min={from} onChange={(e) => e.target.value && go(from, e.target.value)} />
        </label>
        <button className={btn} onClick={() => go(today(), today())}>Today</button>
        <button className={btn} onClick={() => go(monthStart(), today())}>This month</button>
        <button className={btn} onClick={() => { const m = lastMonth(); go(m.from, m.to); }}>Last month</button>
        <div className="ml-auto flex gap-2">
          <button className={btn} disabled={!invoices?.length} onClick={csv}>Download CSV</button>
          <button className="min-h-11 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40 sm:min-h-9 sm:py-1.5" disabled={!invoices} onClick={() => window.print()}>
            Download PDF
          </button>
        </div>
      </div>

      <div className="px-4 pb-10 sm:px-6 print:p-0">
        {error && <p className="p-4 text-red-700">{error}</p>}
        {!error && !report && <p className="p-4">Loading…</p>}
        {report && (
          <article className="mx-auto w-full max-w-[186mm] bg-white text-[13px] text-gray-900 print:text-[9.5pt]">
            <style>{`@page { size: A4; margin: 14mm 12mm } .nilo-keep { break-inside: avoid } .nilo-head { break-after: avoid }`}</style>

            <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-gray-900 pb-3">
              <div>
                <div className="text-lg font-bold tracking-tight">NILO GARAGE</div>
                <div className={label}>Parts purchases</div>
              </div>
              <div className="text-right">
                <div className="text-base font-semibold">Purchases Report</div>
                <div className="text-sm">{from === to ? longDay(from) : `${longDay(from)} – ${longDay(to)}`}</div>
                <div className="text-xs text-gray-500">Generated {new Date().toLocaleString("en-GB", { timeZone: "Africa/Luanda" })}</div>
              </div>
            </header>

            <section className="nilo-keep mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat k="Invoices" v={String(report.invoices.length)} />
              <Stat k="Line items" v={String(report.lineCount)} />
              <Stat k="Suppliers" v={String(report.suppliers.length)} />
              <Stat k="Total spent" v={`${money(report.grandTotal)} Kz`} strong />
            </section>
            {report.pendingCount > 0 && (
              <p className="mt-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {report.pendingCount} invoice{report.pendingCount > 1 ? "s" : ""} still need approval and are marked below. They are included in the totals.
              </p>
            )}

            {report.invoices.length === 0 && <p className="py-8 text-center text-gray-500">No purchases in this period.</p>}

            {report.invoices.map((inv, i) => {
              const sum = inv.linesTotal;
              const mismatch = inv.total !== null && Math.abs(Number(inv.total) - sum) >= 0.01;
              return (
                <section key={inv.id} className="mt-6">
                  <div className="nilo-keep nilo-head flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-t-md bg-gray-100 px-3 py-2">
                    <span className="font-semibold">
                      {i + 1}. {supplierName(inv)}
                      {inv.status !== "approved" && (
                        <span className="ml-2 rounded border border-red-500 px-1.5 py-0.5 text-[10px] font-medium text-red-700">NEEDS APPROVAL</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-600">
                      {longDay(inv.invoice_date)} · Invoice {inv.invoice_no || "—"} · NIF {inv.supplier_nif || "—"}
                    </span>
                  </div>
                  <table className="w-full border-collapse">
                    <thead className="nilo-head bg-gray-50 text-left text-xs text-gray-600">
                      <tr>
                        <th className={`${cell} w-8 text-center font-medium`}>#</th>
                        <th className={`${cell} font-medium`}>Description</th>
                        <th className={`${cell} w-16 text-right font-medium`}>Qty</th>
                        <th className={`${cell} w-32 text-right font-medium`}>Unit price (Kz)</th>
                        <th className={`${cell} w-32 text-right font-medium`}>Total (Kz)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.lines.map((l, li) => (
                        <tr key={l.id} className="nilo-keep">
                          <td className={`${cell} text-center text-gray-500`}>{li + 1}</td>
                          <td className={cell}>
                            {l.item?.name ?? "—"}
                            {l.ocr_description && fold(l.ocr_description) !== fold(l.item?.name ?? "") && (
                              <span className="block text-[11px] text-gray-500">On invoice: {l.ocr_description}</span>
                            )}
                          </td>
                          <td className={`${cell} text-right tabular-nums`}>
                            {num(Number(l.quantity))}
                            {l.container_size ? <span className="block text-[11px] text-gray-500">× {num(Number(l.container_size))} {l.item?.measure_unit ?? ""}</span> : null}
                          </td>
                          <td className={`${cell} text-right tabular-nums`}>{money(Number(l.unit_cost))}</td>
                          <td className={`${cell} text-right tabular-nums`}>{money(lineTotal(l))}</td>
                        </tr>
                      ))}
                      <tr className="nilo-keep font-semibold">
                        <td className={`${cell} text-right`} colSpan={4}>
                          Invoice total
                        </td>
                        <td className={`${cell} text-right tabular-nums`}>{money(sum)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {mismatch && (
                    <p className="nilo-keep mt-1 text-xs text-red-700">
                      The total printed on the invoice is {money(Number(inv.total))} Kz, which differs from its lines by {money(cents(Number(inv.total) - sum))} Kz.
                    </p>
                  )}
                </section>
              );
            })}

            {report.suppliers.length > 1 && (
              <section className="nilo-keep mt-8">
                <h2 className={`${label} border-b border-gray-300 pb-1`}>By supplier</h2>
                <table className="mt-1 w-full border-collapse">
                  <tbody>
                    {report.suppliers.map((s) => (
                      <tr key={s.key} className="border-t border-gray-200">
                        <td className="py-1.5 pr-2">{s.name}</td>
                        <td className="py-1.5 pr-2 text-right text-gray-600 tabular-nums">
                          {s.invoices} invoice{s.invoices > 1 ? "s" : ""}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{money(s.amount)} Kz</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {report.invoices.length > 0 && (
              <div className="nilo-keep mt-6 flex items-center justify-between rounded-md bg-gray-900 px-3 py-3 text-white">
                <span className="font-semibold">Grand total</span>
                <span className="text-lg font-bold tabular-nums">{money(report.grandTotal)} Kz</span>
              </div>
            )}

            <footer className="nilo-keep mt-10 grid grid-cols-2 gap-8 text-xs text-gray-600">
              <div className="border-t border-gray-400 pt-1">Prepared by</div>
              <div className="border-t border-gray-400 pt-1">Approved by</div>
            </footer>
          </article>
        )}
      </div>
    </>
  );
}

function Stat({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-gray-300 px-3 py-2">
      <div className={label}>{k}</div>
      <div className={`tabular-nums ${strong ? "text-base font-bold" : "font-semibold"}`}>{v}</div>
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense>
      <PurchasesReport />
    </Suspense>
  );
}
