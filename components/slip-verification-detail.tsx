"use client";

import { CheckCircle2, XCircle, AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { ExtractedSlip, SlipVerification } from "@/lib/bank-slip/verify";

// One selected daily report, flattened for display. cash/tpa are null when
// the deployment doesn't track the split (e.g. Impala).
export interface DetailReport {
  reportId: string;
  plate: string;
  reportDate: string;
  ticketRevenue: number;
  cashRevenue: number | null;
  tpaRevenue: number | null;
  otherRevenue: number; // baggage + cargo
  expenses: number;
  netBalance: number;
}

interface SlipVerificationDetailProps {
  reports: DetailReport[];
  slips: ExtractedSlip[];
  verification: SlipVerification | null;
}

const formatAOA = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "AOA" });

// Full-width focus view of the selected reports: per-vehicle revenue split
// next to what the OCR actually read off each slip. Read-only by design.
export function SlipVerificationDetail({ reports, slips, verification }: SlipVerificationDetailProps) {
  const { t } = useTranslation("financials");

  const verdictByReport = new Map(
    (verification?.reports ?? []).map((r) => [r.reportId, r])
  );
  // slip index → plates it was matched to
  const slipPlates = new Map<number, string[]>();
  for (const r of verification?.reports ?? []) {
    for (const i of r.matchedSlipIndexes) {
      slipPlates.set(i, [...(slipPlates.get(i) ?? []), r.plate]);
    }
  }
  const wrongAccount = new Set(verification?.wrongAccountSlipIndexes ?? []);
  const informational = new Set(verification?.informationalSlipIndexes ?? []);

  const slipTypeLabel = (type: ExtractedSlip["slip_type"]) =>
    type === "deposito"
      ? t("slipVerification.typeDeposito")
      : type === "fecho_tpa"
        ? t("slipVerification.typeFechoTpa")
        : t("slipVerification.typeOther");

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Selected reports, one card per vehicle-day */}
      <div>
        <div className="mb-2 text-sm font-semibold">{t("slipVerification.selectedReportsDetail")}</div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          {reports.map((r) => {
            const v = verdictByReport.get(r.reportId);
            const matchedAmounts = (v?.matchedSlipIndexes ?? []).map((i) => slips[i]?.amount ?? 0);
            return (
              <div
                key={r.reportId}
                className={cn(
                  "rounded-md border p-3 text-sm",
                  v ? (v.matched ? "border-green-300 bg-green-50/50" : "border-red-200 bg-red-50/40") : "border-gray-200"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{r.plate}</span>
                  <span className="text-xs text-muted-foreground">{r.reportDate}</span>
                </div>
                <div className="mt-2 space-y-0.5 text-xs">
                  {r.cashRevenue !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("slipVerification.cashRevenue")}</span>
                      <span className="font-mono">{formatAOA(r.cashRevenue)}</span>
                    </div>
                  )}
                  {r.tpaRevenue !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("slipVerification.tpaRevenue")}</span>
                      <span className="font-mono">{formatAOA(r.tpaRevenue)}</span>
                    </div>
                  )}
                  {r.cashRevenue === null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("form.ticketRevenue")}</span>
                      <span className="font-mono">{formatAOA(r.ticketRevenue)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("slipVerification.otherRevenue")}</span>
                    <span className="font-mono">{formatAOA(r.otherRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">− {t("table.expenses")}</span>
                    <span className="font-mono">{formatAOA(r.expenses)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-0.5 font-medium">
                    <span>{t("table.netBalance")}</span>
                    <span className="font-mono">{formatAOA(r.netBalance)}</span>
                  </div>
                </div>
                {v && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    {v.matched ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                        <span className="text-green-800">
                          {t("slipVerification.matchedSlipAmounts")}{" "}
                          <span className="font-mono">{matchedAmounts.map(formatAOA).join(" + ")}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        <span className="text-red-700">{t("slipVerification.noDirectSlipMatch")}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Everything the OCR read, slip by slip */}
      {slips.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <FileText className="h-4 w-4" />
            {t("slipVerification.slipsRead")}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium">{t("slipVerification.slipType")}</th>
                  <th className="p-2 font-medium text-right">{t("form.amount")}</th>
                  <th className="p-2 font-medium">{t("slipVerification.account")}</th>
                  <th className="p-2 font-medium">{t("slipVerification.reference")}</th>
                  <th className="p-2 font-medium">{t("form.date")}</th>
                  <th className="p-2 font-medium">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((s, i) => {
                  const plates = slipPlates.get(i);
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        <Badge variant="outline" className="text-[10px]">
                          {slipTypeLabel(s.slip_type)}
                        </Badge>
                      </td>
                      <td className="p-2 text-right font-mono">{formatAOA(s.amount)}</td>
                      <td className="p-2 font-mono">{s.account_number || "—"}</td>
                      <td className="p-2 max-w-[180px] truncate">{s.reference || "—"}</td>
                      <td className="p-2">{s.date || "—"}</td>
                      <td className="p-2">
                        {wrongAccount.has(i) ? (
                          <span className="flex items-center gap-1 text-red-700">
                            <AlertTriangle className="h-3 w-3" /> {t("slipVerification.wrongAccountShort")}
                          </span>
                        ) : informational.has(i) ? (
                          <span className="text-muted-foreground">{t("slipVerification.notCounted")}</span>
                        ) : plates ? (
                          <span className="flex items-center gap-1 text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> {plates.join(", ")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-700">
                            <XCircle className="h-3 w-3" /> {t("slipVerification.unmatchedShort")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
