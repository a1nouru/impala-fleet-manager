"use client";

import { CheckCircle2, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { ExtractedSlip, SlipVerification } from "@/lib/bank-slip/verify";

export type SlipExtractionStatus = "idle" | "extracting" | "done" | "error";

interface SlipVerificationPanelProps {
  status: SlipExtractionStatus;
  error?: string | null;
  slips: ExtractedSlip[];
  verification: SlipVerification | null;
}

const formatAOA = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "AOA" });

// Read-only reconciliation verdict. Deliberately offers no way to edit the
// extracted amounts — if a slip was misread, re-upload a clearer copy.
export function SlipVerificationPanel({ status, error, slips, verification }: SlipVerificationPanelProps) {
  const { t } = useTranslation("financials");

  if (status === "idle") return null;

  if (status === "extracting") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
        {t("slipVerification.reading")}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>
          {t("slipVerification.failed")}
          {error ? ` — ${error}` : ""}
        </span>
      </div>
    );
  }

  if (!verification) return null;

  const ok = verification.totalsMatch && verification.allReportsMatched;
  const totalsOnly = verification.totalsMatch && !verification.allReportsMatched;

  return (
    <div
      className={cn(
        "space-y-3 rounded-md border p-3",
        ok ? "border-green-300 bg-green-50" : totalsOnly ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {ok ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="text-green-800">{t("slipVerification.matched")}</span>
          </>
        ) : totalsOnly ? (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-amber-800">{t("slipVerification.totalsOnly")}</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span className="text-red-800">{t("slipVerification.mismatch")}</span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("slipVerification.slipsTotal")}</span>
        <span className="font-mono font-medium">{formatAOA(verification.slipsTotal)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("slipVerification.selectedTotal")}</span>
        <span className="font-mono font-medium">{formatAOA(verification.selectedTotal)}</span>
      </div>
      {!verification.totalsMatch && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("slipVerification.difference")}</span>
          <span className="font-mono font-semibold text-red-700">
            {formatAOA(verification.slipsTotal - verification.selectedTotal)}
          </span>
        </div>
      )}

      <div className="space-y-1 border-t pt-2">
        {verification.reports.map((r) => (
          <div key={r.reportId} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 truncate">
              {r.matched ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
              )}
              <span className="truncate">
                {r.plate} · {r.reportDate}
              </span>
            </span>
            <span className="font-mono flex-shrink-0">
              {formatAOA(r.netBalance)}
              {r.matched && r.matchedSlipIndexes.length > 1 && (
                <span className="ml-1 text-muted-foreground">({r.matchedSlipIndexes.length} slips)</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {verification.unmatchedSlipIndexes.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <div className="text-xs font-medium text-muted-foreground">{t("slipVerification.unmatchedSlips")}</div>
          {verification.unmatchedSlipIndexes.map((i) => {
            const s = slips[i];
            if (!s) return null;
            return (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">
                  {s.source_file}
                  {s.reference ? ` · ${s.reference}` : ""}
                  {s.date ? ` · ${s.date}` : ""}
                </span>
                <span className="font-mono flex-shrink-0">{formatAOA(s.amount)}</span>
              </div>
            );
          })}
        </div>
      )}

      {verification.informationalSlipIndexes.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <div className="text-xs font-medium text-muted-foreground">{t("slipVerification.otherDocuments")}</div>
          {verification.informationalSlipIndexes.map((i) => {
            const s = slips[i];
            if (!s) return null;
            return (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">
                  {s.reference || s.source_file}
                  {s.date ? ` · ${s.date}` : ""}
                </span>
                <span className="font-mono flex-shrink-0 text-muted-foreground">{formatAOA(s.amount)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1 border-t pt-2">
        <Badge variant="outline" className="text-[10px]">
          {t("slipVerification.slipCount", { count: slips.length })}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{t("slipVerification.readOnlyNote")}</span>
      </div>
    </div>
  );
}
