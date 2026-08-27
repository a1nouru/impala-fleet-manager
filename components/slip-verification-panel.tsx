"use client";

import { CheckCircle2, Loader2, XCircle, AlertTriangle, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { CompanyExpenseLine, ExtractedSlip, SlipVerification } from "@/lib/bank-slip/verify";

export type SlipExtractionStatus = "idle" | "extracting" | "done" | "error";

interface SlipVerificationPanelProps {
  status: SlipExtractionStatus;
  error?: string | null;
  slips: ExtractedSlip[];
  verification: SlipVerification | null;
  // Company expenses on/around the deposit date the accountant may tick to
  // explain a gap. Never applied automatically — explaining a mismatch is an
  // explicit human decision over deterministic system records.
  candidateExpenses?: CompanyExpenseLine[];
  selectedExpenseIds?: string[];
  onToggleExpense?: (id: string) => void;
}

const formatAOA = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "AOA" });

// Read-only reconciliation verdict. Deliberately offers no way to edit the
// extracted amounts — if a slip was misread, re-upload a clearer copy.
export function SlipVerificationPanel({
  status,
  error,
  slips,
  verification,
  candidateExpenses = [],
  selectedExpenseIds = [],
  onToggleExpense,
}: SlipVerificationPanelProps) {
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

  if (!verification) {
    // Extraction finished but there is nothing to compare against yet —
    // never go blank, or the accountant thinks the reader hung.
    if (status === "done") {
      if (slips.length === 0) {
        return (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {t("slipVerification.noSlipsRead")}
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {t("slipVerification.slipsAwaitSelection", { count: slips.length })}
        </div>
      );
    }
    return null;
  }

  const v = verification;
  const verdict = v.status;
  const difference = v.selectedTotal - v.slipsTotal;

  return (
    <div
      className={cn(
        "space-y-3 rounded-md border p-3",
        verdict === "verified" && "border-green-300 bg-green-50",
        verdict === "verified_with_expenses" && "border-teal-300 bg-teal-50",
        verdict === "unverified" && "border-red-300 bg-red-50"
      )}
    >
      {/* Status banner */}
      <div className="flex items-center gap-2 text-sm font-semibold">
        {verdict === "verified" && (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="text-green-800">{t("slipVerification.matched")}</span>
          </>
        )}
        {verdict === "verified_with_expenses" && (
          <>
            <CheckCircle2 className="h-4 w-4 text-teal-600 flex-shrink-0" />
            <span className="text-teal-800">{t("slipVerification.matchedWithExpenses")}</span>
          </>
        )}
        {verdict === "unverified" && (
          <>
            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span className="text-red-800">{t("slipVerification.mismatch")}</span>
          </>
        )}
      </div>

      {/* Slips credited to the wrong group's account — never acceptable */}
      {(v.wrongAccountSlipIndexes ?? []).length > 0 && (
        <div className="space-y-1 rounded-md border border-red-300 bg-white/70 p-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-800">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {t("slipVerification.wrongAccountSlips", {
              type: t("form.vehicleTypeRegular"),
            })}
          </div>
          {v.wrongAccountSlipIndexes.map((i) => {
            const s = slips[i];
            if (!s) return null;
            return (
              <div key={i} className="flex items-center justify-between gap-2 text-xs text-red-700">
                <span className="truncate">
                  {s.reference || s.source_file}
                  {s.account_number ? ` · ${t("slipVerification.account")} ${s.account_number}` : ""}
                </span>
                <span className="font-mono flex-shrink-0">{formatAOA(s.amount)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Opt-in expense explanations — the FIRST thing to resolve on a
          mismatch, so it sits directly under the verdict, never below the
          fold. Only ticked expenses enter the math. */}
      {verification && !verification.totalsMatch && candidateExpenses.length > 0 && onToggleExpense && (
        <div className="space-y-1.5 rounded-md border-2 border-amber-300 bg-amber-50 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
            <Receipt className="h-3.5 w-3.5 flex-shrink-0" />
            {t("slipVerification.explainWithExpenses")}
          </div>
          {candidateExpenses.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center justify-between gap-2 rounded bg-white/70 p-1.5 text-xs">
              <span className="flex items-center gap-2 truncate">
                <Checkbox
                  checked={selectedExpenseIds.includes(e.id)}
                  onCheckedChange={() => onToggleExpense(e.id)}
                />
                <span className="truncate">
                  {e.description || e.category || t("slipVerification.expense")}
                  <span className="ml-1 text-muted-foreground">({e.expenseDate})</span>
                </span>
              </span>
              <span className="font-mono flex-shrink-0 font-medium">{formatAOA(e.amount)}</span>
            </label>
          ))}
        </div>
      )}

      {/* Reconciliation waterfall: where the money went, line by line */}
      <div className="space-y-1 rounded-md border bg-white/60 p-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("slipVerification.selectedTotal")}</span>
          <span className="font-mono font-medium">{formatAOA(v.selectedTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">− {t("slipVerification.slipsTotal")}</span>
          <span className="font-mono font-medium">{formatAOA(v.slipsTotal)}</span>
        </div>
        {(v.d1Expenses.length > 0 || verdict === "unverified") && (
          <div className="flex items-center justify-between border-t pt-1">
            <span className="text-muted-foreground">= {t("slipVerification.difference")}</span>
            <span className={cn("font-mono", Math.abs(difference) > 0.005 ? "font-semibold" : "")}>
              {formatAOA(difference)}
            </span>
          </div>
        )}
        {v.d1Expenses.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Receipt className="h-3.5 w-3.5" />
                − {t("slipVerification.d1Expenses")}
              </span>
              <span className="font-mono font-medium">{formatAOA(v.d1ExpensesTotal)}</span>
            </div>
            <div className="space-y-0.5 pl-5">
              {v.d1Expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {e.description || e.category || t("slipVerification.expense")}
                  </span>
                  <span className="font-mono flex-shrink-0">{formatAOA(e.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center justify-between border-t pt-1">
          <span className={cn("font-medium", verdict === "unverified" ? "text-red-700" : "text-muted-foreground")}>
            = {t("slipVerification.remainingDifference")}
          </span>
          <span
            className={cn(
              "font-mono font-bold",
              verdict === "unverified" ? "text-red-700" : "text-green-700"
            )}
          >
            {formatAOA(v.residual)}
          </span>
        </div>
      </div>

      {/* Where the mismatch is: direction of the residual, in plain words */}
      {verdict === "unverified" && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-white/60 p-2 text-xs text-red-800">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            {v.residual > 0
              ? t("slipVerification.residualShort", { amount: formatAOA(v.residual) })
              : t("slipVerification.residualExcess", { amount: formatAOA(Math.abs(v.residual)) })}{" "}
            <span className="font-semibold">{t("slipVerification.saveBlocked")}</span>
          </span>
        </div>
      )}

      {/* Per-vehicle attribution */}
      <div className="space-y-1 border-t pt-2">
        {v.reports.map((r) => (
          <div key={r.reportId} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 truncate">
              {r.matched ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
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

      {v.unmatchedSlipIndexes.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <div className="text-xs font-medium text-muted-foreground">{t("slipVerification.unmatchedSlips")}</div>
          {v.unmatchedSlipIndexes.map((i) => {
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

      {v.informationalSlipIndexes.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <div className="text-xs font-medium text-muted-foreground">{t("slipVerification.otherDocuments")}</div>
          {v.informationalSlipIndexes.map((i) => {
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
