"use client";

import { kz } from "@/lib/nilo/client";
import type { StatementDoc } from "@/lib/nilo/statement-doc";
import { useTranslation } from "@/hooks/useTranslation";

const COMPANY = { royal: "Royal Express", impala: "Impala Express" };

const day = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("pt-AO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const num = (n: number) => n.toLocaleString("pt-AO", { maximumFractionDigits: 3 });

const label = "font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500";

// The monthly statement, bank-statement style. Same component on screen and on paper: real
// text, rows never split across printed pages, phones get stacked cards instead of tables.
export function StatementDocument({ doc }: { doc: StatementDoc }) {
  const { t } = useTranslation("nilo");
  const [y, m] = doc.period.split("-").map(Number);
  const first = `${doc.period}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const a = doc.account;

  return (
    <article className="mx-auto w-full max-w-[182mm] bg-white text-[13px] text-gray-900 print:text-[9.5pt]">
      <style>{`@page { size: A4; margin: 14mm 12mm } .nilo-keep { break-inside: avoid } .nilo-head { break-after: avoid }`}</style>

      <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-gray-900 pb-3">
        <div>
          <div className="text-lg font-bold tracking-tight">NILO GARAGE</div>
          <div className={label}>{t("doc.issuer")}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold">{t("doc.title")}</div>
          <div className="font-mono text-sm">{doc.statementNo}</div>
          {doc.provisional && (
            <div className="mt-1 inline-block rounded border border-amber-500 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              {t("doc.provisional")}
            </div>
          )}
        </div>
      </header>

      <section className="nilo-keep mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Field k={t("doc.billedTo")} v={COMPANY[doc.company]} strong />
        <Field k={t("doc.period")} v={`${day(first)} – ${day(last)}`} />
        <Field k={t("doc.issued")} v={doc.issuedAt ? day(doc.issuedAt) : t("doc.notIssued")} />
        <Field k={t("doc.due")} v={day(doc.dueDate)} strong />
      </section>

      <section className="nilo-keep mt-5 rounded-md border border-gray-300">
        <div className={`${label} border-b border-gray-300 bg-gray-50 px-3 py-2`}>{t("doc.accountSummary")}</div>
        <dl className="divide-y divide-gray-200">
          <Row k={t("doc.previousBalance")} v={kz(a.previousBalance)} />
          <Row k={t("doc.charges")} v={`+ ${kz(a.charges)}`} />
          <Row k={t("doc.credits")} v={`− ${kz(a.credits)}`} />
          <div className="flex items-center justify-between gap-3 bg-gray-900 px-3 py-3 text-white">
            <dt className="font-semibold">{doc.provisional ? t("doc.dueSoFar") : t("doc.amountDue")}</dt>
            <dd className="text-lg font-bold tabular-nums">{kz(a.amountDue)}</dd>
          </div>
        </dl>
      </section>
      <p className="mt-2 text-xs text-gray-600">
        {t("doc.counts", { vehicles: doc.counts.vehicles, jobs: doc.counts.jobs, units: num(doc.counts.units) })}.
        {doc.provisional ? ` ${t("doc.provisionalNote")}` : ""}
      </p>

      <h2 className={`${label} mt-6 border-b border-gray-300 pb-1`}>{t("doc.vehicleSummary")}</h2>
      <table className="mt-1 w-full border-collapse">
        <thead className="text-left text-xs text-gray-500">
          <tr>
            <th className="py-1.5 pr-2 font-medium">{t("doc.vehicle")}</th>
            <th className="py-1.5 pr-2 text-right font-medium">{t("doc.jobs")}</th>
            <th className="hidden py-1.5 pr-2 text-right font-medium sm:table-cell print:table-cell">{t("doc.units")}</th>
            <th className="py-1.5 text-right font-medium">{t("doc.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {doc.vehicles.map((v) => (
            <tr key={v.plate} className="nilo-keep border-t border-gray-200">
              <td className="py-1.5 pr-2 font-mono">{v.plate || "—"}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{v.jobs.length}</td>
              <td className="hidden py-1.5 pr-2 text-right tabular-nums sm:table-cell print:table-cell">{num(v.units)}</td>
              <td className="py-1.5 text-right tabular-nums">{kz(v.subtotal)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-900 font-semibold">
            <td className="py-1.5" colSpan={2}>
              {t("doc.total")}
            </td>
            <td className="hidden sm:table-cell print:table-cell" />
            <td className="py-1.5 text-right tabular-nums">{kz(a.charges - a.credits)}</td>
          </tr>
        </tbody>
      </table>

      <h2 className={`${label} mt-8 border-b border-gray-300 pb-1`}>{t("doc.detail")}</h2>
      {doc.vehicles.length === 0 && <p className="py-4 text-sm text-gray-500">{t("statements.nothingYet")}</p>}
      {doc.vehicles.map((v) => (
        <section key={v.plate} className="mt-4">
          <div className="nilo-keep nilo-head flex items-baseline justify-between gap-3 rounded-t-md bg-gray-100 px-3 py-2">
            <span className="font-mono text-sm font-semibold">{v.plate || "—"}</span>
            <span className="text-xs text-gray-600">
              {t("doc.vehicleLine", { jobs: v.jobs.length, units: num(v.units) })}
            </span>
          </div>
          {v.jobs.map((j, ji) => (
            <div key={j.recordId ?? ji} className="border-x border-b border-gray-200 px-3 py-2">
              <div className="nilo-keep flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-xs font-medium text-gray-700 break-words">
                  {day(j.date)} · {t("doc.job")}
                  {j.description ? ` — ${j.description}` : ""}
                </span>
                {j.recordId && <span className="font-mono text-[10px] text-gray-400">{j.recordId.slice(0, 8)}</span>}
              </div>
              <ul className="mt-1 divide-y divide-gray-100">
                {j.lines.map((l, li) => (
                  <li key={li} className="nilo-keep grid grid-cols-[1fr_auto] gap-x-3 py-1 sm:grid-cols-[8rem_1fr_4rem_7rem_7rem] print:grid-cols-[8rem_1fr_4rem_7rem_7rem]">
                    <span className="hidden font-mono text-[11px] text-gray-500 sm:block print:block">
                      {l.codes[0]}
                      {l.codes.length > 1 && ` +${l.codes.length - 1}`}
                    </span>
                    <span className={l.quantity < 0 ? "text-green-700" : ""}>
                      {l.itemName}
                      {l.quantity < 0 && ` (${t("doc.returned")})`}
                      <span className="block text-[11px] text-gray-500 sm:hidden print:hidden">
                        {num(l.quantity)} × {kz(l.unitPrice)}
                      </span>
                      {l.codes.length > 1 && (
                        <span className="block break-words font-mono text-[10px] leading-snug text-gray-400">
                          {l.codes.join(" · ")}
                        </span>
                      )}
                      {l.codes.length === 1 && (
                        <span className="block font-mono text-[10px] text-gray-400 sm:hidden print:hidden">{l.codes[0]}</span>
                      )}
                    </span>
                    <span className="hidden text-right tabular-nums sm:block print:block">{num(l.quantity)}</span>
                    <span className="hidden text-right tabular-nums sm:block print:block">{kz(l.unitPrice)}</span>
                    <span className={`text-right tabular-nums ${l.amount < 0 ? "text-green-700" : ""}`}>{kz(l.amount)}</span>
                  </li>
                ))}
              </ul>
              {v.jobs.length > 1 && (
                <div className="flex justify-between border-t border-gray-200 pt-1 text-xs text-gray-600">
                  <span>{t("doc.jobSubtotal")}</span>
                  <span className="tabular-nums">{kz(j.subtotal)}</span>
                </div>
              )}
            </div>
          ))}
          <div className="nilo-keep flex justify-between rounded-b-md border-x border-b border-gray-300 bg-gray-50 px-3 py-2 font-semibold">
            <span>
              {t("doc.vehicleTotal")} {v.plate}
              {v.credits > 0 && (
                <span className="ml-2 text-xs font-normal text-green-700">
                  ({t("doc.creditsIncluded", { amount: kz(v.credits) })})
                </span>
              )}
            </span>
            <span className="tabular-nums">{kz(v.subtotal)}</span>
          </div>
        </section>
      ))}

      {doc.parts.length > 0 && (
        <>
          <h2 className={`${label} mt-8 border-b border-gray-300 pb-1`}>{t("doc.byPart")}</h2>
          <table className="mt-1 w-full border-collapse">
            <tbody>
              {doc.parts.map((p) => (
                <tr key={p.itemName} className="nilo-keep border-t border-gray-200">
                  <td className="py-1.5 pr-2">{p.itemName}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{num(p.quantity)}</td>
                  <td className="py-1.5 text-right tabular-nums">{kz(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(a.unpaid.length > 0 || a.paymentsReceived.length > 0) && (
        <section className="nilo-keep mt-8 grid gap-4 sm:grid-cols-2">
          {a.unpaid.length > 0 && (
            <div>
              <h2 className={`${label} border-b border-gray-300 pb-1`}>{t("doc.unpaid")}</h2>
              {a.unpaid.map((u) => (
                <div key={u.statementNo} className="flex justify-between py-1 text-sm">
                  <span className="font-mono">{u.statementNo}</span>
                  <span className="tabular-nums">{kz(u.total)}</span>
                </div>
              ))}
            </div>
          )}
          {a.paymentsReceived.length > 0 && (
            <div>
              <h2 className={`${label} border-b border-gray-300 pb-1`}>{t("doc.payments")}</h2>
              {a.paymentsReceived.map((p) => (
                <div key={p.statementNo} className="flex justify-between py-1 text-sm">
                  <span>
                    <span className="font-mono">{p.statementNo}</span> · {day(p.paidAt)}
                  </span>
                  <span className="tabular-nums">{kz(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="nilo-keep mt-8 border-t-2 border-gray-900 pt-3 text-xs text-gray-700">
        <p className="font-semibold">{t("doc.payBy", { date: day(doc.dueDate), amount: kz(a.amountDue) })}</p>
        <p className="mt-1">{t("doc.reference", { ref: doc.statementNo })}</p>
        <p className="mt-1 text-gray-500">{t("doc.pricing")}</p>
      </footer>
    </article>
  );
}

function Field({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div>
      <div className={label}>{k}</div>
      <div className={strong ? "font-semibold" : ""}>{v}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
