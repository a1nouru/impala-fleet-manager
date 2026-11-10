"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { kz, nilo } from "@/lib/nilo/client";
import type { Statement } from "@/lib/nilo/ledger";

type Row = {
  statement_no: string;
  company: "royal" | "impala";
  period: string;
  issued_by: string;
  issued_at: string;
  status: "issued" | "paid";
  paid_at: string | null;
  lines: Statement;
};

const COMPANY = { royal: "Royal Express", impala: "Impala Express" };
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

// Printable billing statement: real text, rows never split across pages.
function StatementView() {
  const params = useSearchParams();
  const [s, setS] = useState<Row | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    nilo<Row>(`statement?id=${params.get("id")}`).then(setS, (e) => setError(String(e.message)));
  }, [params]);

  if (error) return <p className="p-8 text-red-700">{error}</p>;
  if (!s) return <p className="p-8">…</p>;

  const st = s.lines;
  const label = "font-mono text-[8pt] uppercase tracking-[0.18em] text-gray-500";
  const month = new Date(`${s.period}T00:00:00Z`).toLocaleDateString("pt-AO", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <style>{`@page { size: A4; margin: 16mm 14mm } tr { break-inside: avoid }`}</style>
      <div className="p-4 print:hidden">
        <button className="rounded bg-black px-4 py-2 text-white" onClick={() => window.print()}>
          Print / PDF
        </button>
      </div>
      <article className="mx-auto max-w-[182mm] bg-white text-[10pt] text-gray-900">
        <header className="flex items-start justify-between border-b border-gray-300 pb-3">
          <div className={label}>Nilo Garage · Parts &amp; Services</div>
          <div className={`${label} border border-gray-400 px-2 py-0.5 text-gray-800`}>
            {s.status === "paid" ? "Statement · Paid" : "Statement"}
          </div>
        </header>
        <h1 className="mt-6 font-serif text-[24pt] leading-tight">Parts Statement — {COMPANY[s.company]}</h1>
        <p className={`${label} mt-2`}>
          Period · {month} · Statement {s.statement_no} · Issued {day(s.issued_at)}
        </p>
        <p className="mt-5 max-w-[150mm] leading-relaxed">
          In {month}, {COMPANY[s.company]} used {st.lines.filter((l) => l.quantity > 0).length} parts from Nilo stock across{" "}
          {st.byVehicle.length} vehicles. The amount due is <strong>{kz(st.total)}</strong>, priced at the unit cost on each
          part&apos;s purchase invoice. Parts returned from edited jobs are credited.
        </p>

        <h2 className={`${label} mt-8 border-b border-gray-300 pb-1`}>By vehicle</h2>
        <table className="mt-2 w-full border-collapse">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-2 py-1 font-medium">Vehicle</th>
              <th className="px-2 py-1 text-right font-medium">Parts</th>
              <th className="px-2 py-1 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {st.byVehicle.map((v) => (
              <tr key={v.vehiclePlate} className="border-b border-gray-200">
                <td className="px-2 py-1 font-mono">{v.vehiclePlate || "—"}</td>
                <td className="px-2 py-1 text-right tabular-nums">{v.parts}</td>
                <td className="px-2 py-1 text-right tabular-nums">{kz(v.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className={`${label} mt-8 border-b border-gray-300 pb-1`}>Detail</h2>
        <table className="mt-2 w-full border-collapse text-[8.5pt]">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-1.5 py-1 font-medium">Date</th>
              <th className="px-1.5 py-1 font-medium">Code</th>
              <th className="px-1.5 py-1 font-medium">Item</th>
              <th className="px-1.5 py-1 font-medium">Vehicle</th>
              <th className="px-1.5 py-1 text-right font-medium">Qty</th>
              <th className="px-1.5 py-1 text-right font-medium">Unit</th>
              <th className="px-1.5 py-1 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {st.lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="px-1.5 py-1 whitespace-nowrap">{l.at.slice(0, 10)}</td>
                <td className="px-1.5 py-1 font-mono">{l.code}</td>
                <td className="px-1.5 py-1">{l.itemName}</td>
                <td className="px-1.5 py-1 font-mono">{l.vehiclePlate}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{l.quantity}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{kz(l.unitPrice)}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{kz(l.amount)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={6} className="px-1.5 py-2 text-right">
                Total due
              </td>
              <td className="px-1.5 py-2 text-right tabular-nums">{kz(st.total)}</td>
            </tr>
          </tbody>
        </table>

        <footer className={`${label} mt-10 flex justify-between border-t border-gray-300 pt-2`}>
          <span>Issued by {s.issued_by}</span>
          <span>{s.status === "paid" && s.paid_at ? `Paid ${day(s.paid_at)}` : "Nilo"}</span>
        </footer>
      </article>
    </>
  );
}

export default function StatementPage() {
  return (
    <Suspense>
      <StatementView />
    </Suspense>
  );
}
