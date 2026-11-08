"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { COMPANY } from "@/lib/rental-invoice/company";
import { formatKz, invoiceLabel, paymentState } from "@/lib/rental-invoice/format";

export type InvoiceDoc = {
  series: string; number: number; issue_date: string; due_date: string
  client_name: string; client_nif: string | null; client_address: string | null; notes: string | null
  iva_rate: number; iva_exemption: string | null; subtotal: number; iva_amount: number; total: number
  public_token: string; paid_amount: number; cancelled: boolean
  lines: { code: string | null; description: string; unit: string; qty: number; unit_price: number; line_total: number }[]
}

export const publicInvoiceUrl = (token: string) =>
  `${typeof window === "undefined" ? "" : window.location.origin}/i/${token}`

function Qr({ text }: { text: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  }, [text]);
  return <div role="img" aria-label="QR code da versão online desta fatura" className="size-[92px] [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

const STATUS = {
  paid: { label: "Pago", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  partial: { label: "Pago parcialmente", cls: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  unpaid: { label: "Por pagar", cls: "bg-rose-50 text-rose-700 ring-rose-600/20" },
} as const;

/** The Fatura Pró-Forma itself, A4-proportioned, in Portuguese. Used in the app and on the public QR page. */
export function InvoiceDocument({ d }: { d: InvoiceDoc }) {
  const label = invoiceLabel(d.series, d.number);
  const state = STATUS[paymentState(Number(d.total), Number(d.paid_amount))];
  const rate = Number(d.iva_rate);
  return (
    <article
      aria-label={`Fatura Pró-Forma ${label}`}
      className="invoice-doc relative mx-auto w-full max-w-[820px] overflow-hidden rounded-xl bg-white px-6 py-8 text-[13px] leading-relaxed text-slate-800 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_16px_40px_-16px_rgb(15_23_42/0.18)] ring-1 ring-slate-200 sm:px-12 sm:py-11 print:max-w-none print:rounded-none print:px-0 print:py-0 print:shadow-none print:ring-0"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-[#6d1f3b]" />
      {d.cancelled && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-[110px] font-bold tracking-widest text-rose-600/10 [transform:rotate(-18deg)]">ANULADA</div>
      )}

      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          {COMPANY.logo
            ? <img src={COMPANY.logo} alt={COMPANY.logoAlt} className="h-11 w-auto" />
            : <div className="text-xl font-semibold tracking-tight">{COMPANY.legalName}</div>}
          <div className="text-[12px] leading-snug text-slate-500">
            <div className="font-semibold text-slate-800">{COMPANY.legalName}</div>
            {COMPANY.addressLines.map(l => <div key={l}>{l}</div>)}
            <div>Contribuinte <span className="font-medium text-slate-700">{COMPANY.nif}</span></div>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Fatura Pró-Forma</div>
          <div className="mt-1 font-mono text-[22px] font-semibold tracking-tight text-slate-900">{label}</div>
          <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ring-inset print:hidden ${state.cls}`}>{state.label}</span>
        </div>
      </header>

      <section className="mt-8 grid gap-6 rounded-lg bg-slate-50 p-5 sm:grid-cols-[1.3fr_1fr] print:bg-transparent print:p-0">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Cliente</div>
          <div className="mt-1 text-[15px] font-semibold text-slate-900">{d.client_name}</div>
          {d.client_address && <div className="text-slate-500">{d.client_address}</div>}
          {d.client_nif && <div className="text-slate-500">Contribuinte <span className="font-medium text-slate-700">{d.client_nif}</span></div>}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12.5px]">
          <div><dt className="text-slate-400">Data de emissão</dt><dd className="font-medium">{d.issue_date}</dd></div>
          <div><dt className="text-slate-400">Vencimento</dt><dd className="font-medium">{d.due_date}</dd></div>
          <div className="col-span-2"><dt className="text-slate-400">V/ Ref</dt><dd className="font-mono font-medium">{label}</dd></div>
        </dl>
      </section>

      <p className="mt-5 text-[12px] text-slate-500"><span className="font-semibold text-slate-700">Observações:</span> {d.notes || "Os bens/serviços foram colocados à disposição do adquirente na data do documento."}</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left text-[11px] uppercase tracking-[0.08em] text-slate-500">
              <th className="py-2 pr-3 font-medium">Código</th>
              <th className="py-2 pr-3 font-medium">Descrição</th>
              <th className="py-2 pr-3 text-right font-medium">Pr. Unitário</th>
              <th className="py-2 pr-3 text-center font-medium">Uni.</th>
              <th className="py-2 pr-3 text-center font-medium">Qtd.</th>
              <th className="py-2 pr-3 text-center font-medium">IVA</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-200 align-top">
                <td className="py-3 pr-3 font-medium text-slate-900">{l.code}</td>
                <td className="py-3 pr-3 text-slate-600">{l.description}</td>
                <td className="whitespace-nowrap py-3 pr-3 text-right tabular-nums">{formatKz(Number(l.unit_price))}</td>
                <td className="py-3 pr-3 text-center text-slate-500">{l.unit}</td>
                <td className="py-3 pr-3 text-center tabular-nums">{Number(l.qty)}</td>
                <td className="whitespace-nowrap py-3 pr-3 text-center tabular-nums text-slate-500">{rate}%{rate === 0 && <sup className="ml-0.5">(1)</sup>}</td>
                <td className="whitespace-nowrap py-3 text-right font-semibold tabular-nums text-slate-900">{formatKz(Number(l.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="mt-8 grid gap-8 sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <div className="flex items-end gap-3">
          <Qr text={publicInvoiceUrl(d.public_token)} />
          <p className="max-w-[130px] text-[11px] leading-snug text-slate-400">Digitalize para ver e confirmar esta fatura online</p>
        </div>
        <table className="self-end text-[11.5px] text-slate-500">
          <thead><tr className="border-b border-slate-300 text-left"><th className="pr-5 font-medium">Taxa</th><th className="pr-5 font-medium">Incidência</th><th className="font-medium">IVA</th></tr></thead>
          <tbody><tr><td className="pr-5 pt-1">{rate}%</td><td className="whitespace-nowrap pr-5 pt-1 tabular-nums">{formatKz(Number(d.subtotal))}</td><td className="whitespace-nowrap pt-1 tabular-nums">{formatKz(Number(d.iva_amount))}</td></tr></tbody>
        </table>
        <div className="min-w-[260px] rounded-lg bg-slate-900 px-5 py-4 text-white print:bg-transparent print:px-0 print:text-slate-900">
          <div className="flex justify-between gap-6 text-[12px] text-white/60 print:text-slate-500"><span>S/IVA</span><span className="tabular-nums">{formatKz(Number(d.subtotal))}</span></div>
          <div className="mt-1 flex justify-between gap-6 text-[12px] text-white/60 print:text-slate-500"><span>IVA</span><span className="tabular-nums">{formatKz(Number(d.iva_amount))}</span></div>
          <div className="mt-3 flex items-baseline justify-between gap-6 border-t border-white/15 pt-3 print:border-slate-300">
            <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/60 print:text-slate-500">Total</span>
            <span className="text-[24px] font-semibold tabular-nums tracking-tight">{formatKz(Number(d.total))}</span>
          </div>
        </div>
      </footer>

      <div className="mt-8 flex flex-col gap-1 border-t border-slate-200 pt-4 text-[10.5px] text-slate-400 sm:flex-row sm:justify-between">
        <span>{rate === 0 && <>(1) {d.iva_exemption} · </>}Este documento não serve de fatura.</span>
        <span>{COMPANY.legalName} · NIF {COMPANY.nif}</span>
      </div>
    </article>
  );
}
