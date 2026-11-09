"use client";

import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { COMPANY } from "@/lib/rental-invoice/company";
import { formatKz, invoiceLabel, paymentState } from "@/lib/rental-invoice/format";

export type InvoiceDoc = {
  series: string; number: number; issue_date: string; due_date: string
  client_name: string; client_nif: string | null; client_address: string | null; notes: string | null
  iva_rate: number; iva_exemption: string | null; subtotal: number; discount: number; iva_amount: number; total: number
  public_token: string; paid_amount: number; cancelled: boolean
  lines: { code: string | null; description: string; unit: string; qty: number; unit_price: number; line_total: number }[]
}

export const publicInvoiceUrl = (token: string) =>
  `${typeof window === "undefined" ? "" : window.location.origin}/i/${token}`

/** Encodes the absolute public URL, which only exists in the browser, so it renders after mount. */
function Qr({ token }: { token: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    const qr = qrcode(0, "M");
    qr.addData(publicInvoiceUrl(token));
    qr.make();
    setSvg(qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true }));
  }, [token]);
  return <div role="img" aria-label="QR code da versão online desta fatura" className="size-24 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

const STATUS = {
  paid: { label: "Pago", cls: "bg-emerald-50 text-emerald-700" },
  partial: { label: "Pago parcialmente", cls: "bg-amber-50 text-amber-800" },
  unpaid: { label: "Pagamento pendente", cls: "bg-rose-50 text-rose-700" },
} as const;

const Meta = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="py-3.5 pr-3 sm:border-l sm:border-slate-200 sm:px-4 sm:first:border-l-0 sm:first:pl-0">
    <dt className="text-[12px] text-slate-500">{label}</dt>
    <dd className="mt-1 text-[13.5px] font-medium text-slate-900 [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

/** The Fatura Pró-Forma itself, in Portuguese. Same document system as the TBH invoices; used in the app and on the public QR page. */
export function InvoiceDocument({ d }: { d: InvoiceDoc }) {
  const label = invoiceLabel(d.series, d.number);
  const state = STATUS[paymentState(Number(d.total), Number(d.paid_amount))];
  const rate = Number(d.iva_rate);
  return (
    <article
      aria-label={`Fatura Pró-Forma ${label}`}
      className="invoice-doc relative mx-auto w-full max-w-[820px] overflow-hidden rounded-[10px] border border-slate-200 bg-white px-5 py-7 text-[13px] leading-normal text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.05),0_12px_32px_-12px_rgb(15_23_42/0.12)] sm:px-12 sm:pb-8 sm:pt-11 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      {d.cancelled && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-[110px] font-bold tracking-widest text-rose-600/10 [transform:rotate(-18deg)]">ANULADA</div>
      )}

      <header className="grid gap-6 border-b border-slate-200 pb-6 sm:grid-cols-[1fr_auto]">
        <div>
          {COMPANY.logo
            ? <><img src={COMPANY.logo} alt={COMPANY.logoAlt} className="h-auto w-[180px]" /><p className="mt-2.5 text-[12.5px] font-medium text-slate-900">{COMPANY.legalName}</p></>
            : <div className="text-[18px] font-semibold tracking-[-0.02em]">{COMPANY.legalName}</div>}
          {COMPANY.addressLines.map(l => <p key={l} className="mt-0.5 text-[12.5px] text-slate-500">{l}</p>)}
          {COMPANY.contacts.length > 0 && <p className="mt-0.5 text-[12.5px] text-slate-500">{COMPANY.contacts.join(" · ")}</p>}
          <p className="mt-0.5 text-[12.5px] text-slate-500">Contribuinte <span className="font-medium text-slate-900">{COMPANY.nif}</span></p>
        </div>
        <div className="sm:text-right">
          <div className="text-[12px] text-slate-500">Fatura Pró-Forma</div>
          <div className="mt-1 font-mono text-[20px] font-medium tracking-[-0.02em]">{label}</div>
        </div>
      </header>

      <dl className="grid grid-cols-2 border-b border-slate-200 sm:grid-cols-4">
        <Meta label="Data de emissão">{d.issue_date}</Meta>
        <Meta label="Cliente">
          {d.client_name}
          {d.client_nif && <span className="block font-normal text-slate-500">NIF {d.client_nif}</span>}
          {d.client_address && <span className="block font-normal text-slate-500">{d.client_address}</span>}
        </Meta>
        <Meta label="Vencimento">{d.due_date}</Meta>
        <Meta label="V/ Ref"><span className="font-mono">{label}</span></Meta>
      </dl>

      <p className="mt-4 text-[12px] text-slate-500"><span className="font-medium text-slate-900">Observações:</span> {d.notes || "Os bens/serviços foram colocados à disposição do adquirente na data do documento."}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-slate-900 text-left text-[12px] text-slate-500">
              <th className="px-1.5 py-2 font-medium">Código</th>
              <th className="px-1.5 py-2 font-medium">Descrição</th>
              <th className="px-1.5 py-2 text-right font-medium">Pr. Unitário</th>
              <th className="px-1.5 py-2 text-center font-medium">Uni.</th>
              <th className="px-1.5 py-2 text-center font-medium">Qtd.</th>
              <th className="px-1.5 py-2 text-center font-medium">IVA</th>
              <th className="px-1.5 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-200 align-top">
                <td className="px-1.5 py-[11px] font-medium">{l.code}</td>
                <td className="px-1.5 py-[11px]">{l.description}</td>
                <td className="whitespace-nowrap px-1.5 py-[11px] text-right tabular-nums">{formatKz(Number(l.unit_price))}</td>
                <td className="px-1.5 py-[11px] text-center text-slate-500">{l.unit}</td>
                <td className="px-1.5 py-[11px] text-center tabular-nums">{Number(l.qty)}</td>
                <td className="whitespace-nowrap px-1.5 py-[11px] text-center tabular-nums text-slate-500">{rate}%{rate === 0 && <sup className="ml-0.5">(1)</sup>}</td>
                <td className="whitespace-nowrap px-1.5 py-[11px] text-right font-semibold tabular-nums">{formatKz(Number(l.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="mt-7 grid items-end gap-6 sm:grid-cols-[auto_1fr_auto]">
        <div className="grid justify-items-start gap-1.5">
          <Qr token={d.public_token} />
          <span className="max-w-[120px] text-[11.5px] leading-snug text-slate-500">Digitalize para ver ou confirmar esta fatura online</span>
        </div>
        <div className="self-center">
          <span className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-medium print:hidden ${state.cls}`}>{state.label}</span>
        </div>
        <div className="min-w-[250px] rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
          <dl className="mb-2.5 grid gap-1 border-b border-slate-200 pb-2.5 text-[12.5px]">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Incidência (S/IVA)</dt><dd className="font-medium tabular-nums">{formatKz(Number(d.subtotal))}</dd></div>
            {Number(d.discount) > 0 && <div className="flex justify-between gap-4"><dt className="text-slate-500">Desconto</dt><dd className="font-medium tabular-nums">−{formatKz(Number(d.discount))}</dd></div>}
            <div className="flex justify-between gap-4"><dt className="text-slate-500">IVA {rate}%{rate === 0 && " (1)"}</dt><dd className="font-medium tabular-nums">{formatKz(Number(d.iva_amount))}</dd></div>
          </dl>
          <span className="mb-1 block text-[12px] text-slate-500">Total</span>
          <b className="text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{formatKz(Number(d.total)).replace(" Kz", "")}<i className="ml-1.5 text-[13px] font-normal not-italic tracking-normal text-slate-500">Kz</i></b>
        </div>
      </footer>

      <div className="mt-7 flex flex-col gap-1 border-t border-slate-200 pt-3.5 text-[11.5px] text-slate-500 sm:flex-row sm:justify-between sm:gap-4">
        <span>{rate === 0 && <>(1) {d.iva_exemption}. </>}Este documento não serve de fatura.</span>
        <span className="sm:whitespace-nowrap">{COMPANY.legalName} · NIF {COMPANY.nif}</span>
      </div>
    </article>
  );
}
