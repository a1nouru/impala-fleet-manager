"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Source_Serif_4 } from "next/font/google";
import { nilo, type Invoice } from "@/lib/nilo/client";
import { buildPurchasesReport, lineTotal, purchasesCsv, supplierName } from "@/lib/nilo/purchases-report";

const serif = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600"], display: "swap" });

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
const cents = (n: number) => Math.round(n * 100) / 100;
const longDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const RANGES = {
  today: () => ({ from: iso(new Date()), to: iso(new Date()) }),
  month: () => {
    const n = new Date();
    return { from: iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1))), to: iso(n) };
  },
  last: () => {
    const n = new Date();
    return {
      from: iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1))),
      to: iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0))),
    };
  },
};
const PRESETS = [
  ["today", "Today"],
  ["month", "This month"],
  ["last", "Last month"],
] as const;

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// Ink on paper. Grey is only for secondary facts; amber and red only for things that need action.
const muted = "text-[#66625B]";
const hair = "border-[#E4E0D8]";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C1B19]";
const th = `pb-1.5 text-[11px] font-normal ${muted}`;

// Purchases report for a date range: every invoice with its lines, unit prices and totals.
// Print → "Save as PDF" is the PDF export; the CSV is for spreadsheets.
function PurchasesReport() {
  const params = useSearchParams();
  const router = useRouter();
  const from = params.get("from") ?? RANGES.month().from;
  const to = params.get("to") ?? RANGES.month().to;
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setInvoices(null);
    setError("");
    nilo<Invoice[]>(`purchases?from=${from}&to=${to}`).then(setInvoices, (e) => setError(String(e.message)));
    document.title = `Nilo purchases ${from} to ${to}`;
  }, [from, to]);

  const go = (f: string, t: string) => router.replace(`/nilo/purchases?from=${f}&to=${t}`);
  const active = PRESETS.find(([k]) => RANGES[k]().from === from && RANGES[k]().to === to)?.[0];

  const report = invoices && buildPurchasesReport(invoices);

  const csv = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([purchasesCsv(invoices ?? [])], { type: "text/csv" }));
    a.download = `nilo-purchases-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const field = `h-9 border-b border-[#1C1B19] bg-transparent px-0.5 text-sm tabular-nums ${focus}`;
  const textBtn = `text-sm underline-offset-4 hover:underline ${focus}`;

  return (
    <div className="min-h-screen bg-[#F2F0EB] text-[#1C1B19] selection:bg-[#E8E2D3] print:min-h-0 print:bg-white">
      <style>{`@page { size: A4; margin: 16mm 15mm } .nilo-keep { break-inside: avoid } .nilo-head { break-after: avoid }`}</style>

      <div className="mx-auto flex max-w-[210mm] flex-wrap items-end gap-x-5 gap-y-3 px-4 pb-2 pt-5 sm:px-0 print:hidden">
        <label className="text-xs">
          <span className={`block ${muted}`}>From</span>
          <input type="date" className={field} value={from} max={to} onChange={(e) => e.target.value && go(e.target.value, to)} />
        </label>
        <label className="text-xs">
          <span className={`block ${muted}`}>To</span>
          <input type="date" className={field} value={to} min={from} onChange={(e) => e.target.value && go(from, e.target.value)} />
        </label>
        <div className="flex gap-3.5 pb-2">
          {PRESETS.map(([k, name]) => (
            <button
              key={k}
              aria-pressed={active === k}
              onClick={() => go(RANGES[k]().from, RANGES[k]().to)}
              className={`${textBtn} ${active === k ? "font-semibold underline" : muted}`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 pb-1">
          <button className={`${textBtn} disabled:opacity-40`} disabled={!invoices?.length} onClick={csv}>
            Download CSV
          </button>
          <button
            className={`h-9 bg-[#1C1B19] px-4 text-sm text-white hover:bg-black disabled:opacity-40 ${focus}`}
            disabled={!invoices}
            onClick={() => window.print()}
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="px-2 pb-12 pt-3 sm:px-6 print:p-0">
        {error && <p className="mx-auto max-w-[210mm] px-2 text-[#9E2B1B]">{error}</p>}
        {!error && !report && <p className={`mx-auto max-w-[210mm] px-2 ${muted}`}>Loading purchases…</p>}
        {report && (
          <article className="mx-auto w-full max-w-[210mm] bg-white px-5 py-8 text-[13px] leading-normal shadow-[0_1px_3px_rgba(28,27,25,0.12)] sm:min-h-[297mm] sm:px-[15mm] sm:py-[16mm] print:min-h-0 print:max-w-none print:p-0 print:text-[9.5pt] print:shadow-none">
            <header className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b ${hair} pb-3 text-xs ${muted}`}>
              <span className="font-semibold text-[#1C1B19]">Nilo Garage</span>
              <span>Parts bought for Royal Express and Impala Express</span>
            </header>

            <h1 className={`${serif.className} mt-8 text-[30px] font-normal leading-tight print:text-[22pt]`}>Purchases</h1>
            <p className="mt-1 text-[15px]">{from === to ? longDay(from) : `${longDay(from)} – ${longDay(to)}`}</p>
            <p className={`mt-4 max-w-[60ch] ${muted}`}>
              {report.invoices.length === 0
                ? "No invoices were recorded between these dates."
                : `${plural(report.invoices.length, "invoice")} from ${plural(report.suppliers.length, "supplier")}, ${plural(report.lineCount, "line")} in all, totalling `}
              {report.invoices.length > 0 && <strong className="font-semibold text-[#1C1B19] tabular-nums">{money(report.grandTotal)} Kz</strong>}
              {report.invoices.length > 0 && "."}
              {report.pendingCount > 0 && (
                <span className="text-[#8A4B00]">
                  {" "}
                  {report.pendingCount === 1
                    ? "One invoice is still awaiting approval; it is counted and marked below."
                    : `${report.pendingCount} invoices are still awaiting approval; they are counted and marked below.`}
                </span>
              )}
            </p>

            {report.invoices.length > 0 && (
              <table className="mt-8 w-full border-collapse">
                <thead className="text-left">
                  <tr className="border-b-[1.5px] border-[#1C1B19]">
                    <th className={`${th} pr-3`}>Item</th>
                    <th className={`${th} w-12 pr-3 text-right max-sm:w-24`}>Qty</th>
                    <th className={`${th} w-28 pr-3 text-right hidden sm:table-cell print:table-cell`}>Unit price</th>
                    <th className={`${th} w-28 text-right`}>Amount (Kz)</th>
                  </tr>
                </thead>
                {report.invoices.map((inv) => {
                  const sum = inv.linesTotal;
                  const mismatch = inv.total !== null && Math.abs(Number(inv.total) - sum) >= 0.01;
                  const subtotalLabel = mismatch ? `Invoice states ${money(Number(inv.total))}; lines add up to` : "Invoice total";
                  return (
                    <tbody key={inv.id} className="nilo-keep">
                      <tr className="nilo-head">
                        <td colSpan={4} className="pb-1 pt-5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                            <span className="font-semibold">{supplierName(inv)}</span>
                            <span className={`text-xs tabular-nums ${muted}`}>
                              {shortDay(inv.invoice_date)} · No. {inv.invoice_no || "—"} · NIF {inv.supplier_nif || "—"}
                            </span>
                          </div>
                          {inv.status !== "approved" && <div className="text-xs text-[#8A4B00]">Awaiting approval</div>}
                        </td>
                      </tr>
                      {inv.lines.map((l) => (
                        <tr key={l.id} className={`border-t ${hair}`}>
                          <td className="py-1.5 pr-3 align-top">
                            {l.item?.name ?? "—"}
                            {l.ocr_description && fold(l.ocr_description) !== fold(l.item?.name ?? "") && (
                              <span className={`block text-xs ${muted}`}>as written: {l.ocr_description}</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-right align-top tabular-nums">
                            {num(Number(l.quantity))}
                            {l.container_size ? (
                              <span className={`block text-xs ${muted}`}>
                                × {num(Number(l.container_size))} {l.item?.measure_unit ?? ""}
                              </span>
                            ) : null}
                            <span className={`block text-xs sm:hidden print:hidden ${muted}`}>× {money(Number(l.unit_cost))}</span>
                          </td>
                          <td className={`py-1.5 pr-3 text-right align-top tabular-nums hidden sm:table-cell print:table-cell ${muted}`}>{money(Number(l.unit_cost))}</td>
                          <td className="py-1.5 text-right align-top tabular-nums">{money(lineTotal(l))}</td>
                        </tr>
                      ))}
                      <tr className={`text-right text-xs ${mismatch ? "text-[#9E2B1B]" : muted}`}>
                        <td colSpan={2} className="pb-1 pt-1.5 pr-3">
                          <span className="sm:hidden print:hidden">{subtotalLabel}</span>
                        </td>
                        <td className="hidden whitespace-nowrap pb-1 pt-1.5 pr-3 sm:table-cell print:table-cell">{subtotalLabel}</td>
                        <td className="border-t border-[#1C1B19] pb-1 pt-1.5 text-[13px] font-semibold tabular-nums text-[#1C1B19] print:text-[9.5pt]">{money(sum)}</td>
                      </tr>
                    </tbody>
                  );
                })}
                <tbody className="nilo-keep">
                  <tr>
                    <td colSpan={2} className="pr-3 pt-6 text-right text-sm font-semibold">
                      <span className="sm:hidden print:hidden">Total for the period</span>
                    </td>
                    <td className="hidden whitespace-nowrap pr-3 pt-6 text-right text-sm font-semibold sm:table-cell print:table-cell">
                      Total for the period
                    </td>
                    <td className="pt-6 text-right">
                      <span className={`${serif.className} inline-block border-b-[3px] border-double border-[#1C1B19] pb-0.5 text-lg font-semibold tabular-nums`}>
                        {money(report.grandTotal)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {report.suppliers.length > 1 && (
              <section className="nilo-keep mt-14">
                <h2 className={`${serif.className} text-lg font-normal`}>By supplier</h2>
                <table className="mt-3 w-full border-collapse">
                  <thead className="text-left">
                    <tr className="border-b-[1.5px] border-[#1C1B19]">
                      <th className={`${th} pr-3`}>Supplier</th>
                      <th className={`${th} w-16 pr-3 text-right`}>Invoices</th>
                      <th className={`${th} w-14 pr-3 text-right hidden sm:table-cell print:table-cell`}>Share</th>
                      <th className={`${th} w-28 text-right`}>Amount (Kz)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.suppliers.map((s) => (
                      <tr key={s.key} className={`border-t ${hair} first:border-0`}>
                        <td className="py-1.5 pr-3">{s.name}</td>
                        <td className={`py-1.5 pr-3 text-right tabular-nums ${muted}`}>{s.invoices}</td>
                        <td className={`py-1.5 pr-3 text-right tabular-nums hidden sm:table-cell print:table-cell ${muted}`}>
                          {report.grandTotal ? Math.round((s.amount / report.grandTotal) * 100) : 0}%
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{money(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <footer className={`nilo-keep mt-20 grid grid-cols-2 gap-12 text-xs ${muted}`}>
              <div className="border-t border-[#1C1B19] pt-1.5">Prepared by</div>
              <div className="border-t border-[#1C1B19] pt-1.5">Approved by</div>
            </footer>
            <p className={`mt-10 text-[11px] ${muted}`}>
              Generated {new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Luanda" })}, Luanda time,
              from the purchase invoices recorded in Nilo.
            </p>
          </article>
        )}
      </div>
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
