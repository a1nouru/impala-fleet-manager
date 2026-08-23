// Deterministic slip-vs-report matching. The LLM only transcribes slips
// (app/api/slip-extract); every comparison decision happens here so a
// hallucinated or misread amount can never be "made to match".

export type SlipType = "deposito" | "fecho_tpa" | "other";

export interface ExtractedSlip {
  slip_type: SlipType;
  amount: number; // AOA
  date: string | null; // as printed on the slip — display only, never used to reject
  reference: string | null;
  account_number: string | null;
  source_file: string;
}

export interface ReportLine {
  reportId: string;
  plate: string;
  reportDate: string;
  netBalance: number; // revenue − expenses, same formula as the deposits page
}

export interface ReportVerdict extends ReportLine {
  matched: boolean;
  matchedSlipIndexes: number[];
}

// A company expense recorded on D+1 (the deposit date): cash spent out of the
// takings before banking, so it legitimately reduces what reaches the bank.
export interface CompanyExpenseLine {
  id: string;
  amount: number;
  description: string | null;
  category: string | null;
  expenseDate: string;
}

export type VerificationStatus = "verified" | "verified_with_expenses" | "unverified";

// Regular and Agaseke vehicles bank into different accounts, so a deposit is
// scoped to one group and slips must credit that group's account.
export interface GroupCheckOptions {
  expectedGroup: "regular" | "agaseke";
  regularAccounts: string[];
}

export interface SlipVerification {
  reports: ReportVerdict[];
  unmatchedSlipIndexes: number[];
  // Documents that are not bank slips (slip_type "other", e.g. internal
  // Saída de Caixa vouchers): shown to the accountant, never counted.
  informationalSlipIndexes: number[];
  slipsTotal: number;
  selectedTotal: number;
  totalsMatch: boolean;
  allReportsMatched: boolean;
  // Slips credited to an account that doesn't belong to the deposit's
  // vehicle group (e.g. a Regular-account slip on an Agaseke deposit).
  // Any entry here forces the status to "unverified".
  wrongAccountSlipIndexes: number[];
  // The vehicle group this verification was scoped to, if any.
  expectedGroup: "regular" | "agaseke" | null;
  // Second reconciliation pass: slips + D+1 company expenses vs the total.
  status: VerificationStatus;
  d1Expenses: CompanyExpenseLine[]; // the expenses applied (empty when slips alone verify)
  d1ExpensesTotal: number;
  residual: number; // selectedTotal − slipsTotal − d1ExpensesTotal; 0 when verified
}

// Amounts come back from OCR with occasional float noise; a kwanza has 100
// centimos, so anything under half a centimo is the same number.
const EPS = 0.005;

const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

// OCR reads accounts with stray zeros/spaces ("000930508110001"): compare on
// digits with leading zeros stripped, matching if one ends with the other.
const sameAccount = (a: string, b: string): boolean => {
  const na = a.replace(/\D/g, "").replace(/^0+/, "");
  const nb = b.replace(/\D/g, "").replace(/^0+/, "");
  if (!na || !nb) return false;
  return na.endsWith(nb) || nb.endsWith(na);
};

export function verifySlips(
  reports: ReportLine[],
  slips: ExtractedSlip[],
  selectedTotal: number,
  d1CompanyExpenses: CompanyExpenseLine[] = [],
  groupCheck?: GroupCheckOptions
): SlipVerification {
  const used = new Array<boolean>(slips.length).fill(false);
  // Only real bank slips participate: internal vouchers and stray documents
  // ("other") are informational, so they can't be used to force a match.
  const countable = (i: number) => slips[i].slip_type !== "other";
  const verdicts: ReportVerdict[] = reports.map((r) => ({ ...r, matched: false, matchedSlipIndexes: [] }));

  // Pass 1: one slip whose amount equals the report's net balance.
  for (const v of verdicts) {
    const i = slips.findIndex((s, idx) => !used[idx] && countable(idx) && eq(s.amount, v.netBalance));
    if (i !== -1) {
      used[i] = true;
      v.matched = true;
      v.matchedSlipIndexes = [i];
    }
  }

  // Pass 2: a pair of slips (typically cash depósito + TPA fecho) summing to it.
  for (const v of verdicts) {
    if (v.matched) continue;
    outer: for (let a = 0; a < slips.length; a++) {
      if (used[a] || !countable(a)) continue;
      for (let b = a + 1; b < slips.length; b++) {
        if (used[b] || !countable(b)) continue;
        if (eq(slips[a].amount + slips[b].amount, v.netBalance)) {
          used[a] = used[b] = true;
          v.matched = true;
          v.matchedSlipIndexes = [a, b];
          break outer;
        }
      }
    }
  }

  const slipsTotal = slips.reduce((sum, s) => (s.slip_type === "other" ? sum : sum + s.amount), 0);
  const totalsMatch = eq(slipsTotal, selectedTotal);

  // Pass 3 (totals): slips alone, then slips + all D+1 company expenses.
  // Deterministic system data only — never a knob the accountant can turn.
  const d1Total = d1CompanyExpenses.reduce((sum, e) => sum + e.amount, 0);
  let status: VerificationStatus;
  let appliedExpenses: CompanyExpenseLine[];
  let appliedTotal: number;
  if (totalsMatch) {
    status = "verified";
    appliedExpenses = [];
    appliedTotal = 0;
  } else if (eq(slipsTotal + d1Total, selectedTotal)) {
    status = "verified_with_expenses";
    appliedExpenses = d1CompanyExpenses;
    appliedTotal = d1Total;
  } else {
    status = "unverified";
    appliedExpenses = d1CompanyExpenses;
    appliedTotal = d1Total;
  }
  // Account ownership check: a slip crediting the wrong group's account can
  // never verify, even when the amounts add up.
  const wrongAccountSlipIndexes: number[] = [];
  // Only check when accounts are actually configured (deployments without
  // known account numbers skip this rather than flagging everything).
  const knownAccounts = (groupCheck?.regularAccounts ?? []).filter((a) => a.replace(/\D/g, "").length > 0);
  if (groupCheck && knownAccounts.length > 0) {
    slips.forEach((s, i) => {
      if (s.slip_type === "other" || !s.account_number) return;
      const isRegularAccount = knownAccounts.some((acc) => sameAccount(s.account_number!, acc));
      if (groupCheck.expectedGroup === "regular" && !isRegularAccount) wrongAccountSlipIndexes.push(i);
      if (groupCheck.expectedGroup === "agaseke" && isRegularAccount) wrongAccountSlipIndexes.push(i);
    });
  }
  if (wrongAccountSlipIndexes.length > 0) status = "unverified";
  const residual = status === "unverified" ? selectedTotal - slipsTotal - appliedTotal : 0;

  return {
    reports: verdicts,
    unmatchedSlipIndexes: slips.map((_, i) => i).filter((i) => !used[i] && countable(i)),
    informationalSlipIndexes: slips.map((_, i) => i).filter((i) => !countable(i)),
    slipsTotal,
    selectedTotal,
    totalsMatch,
    allReportsMatched: verdicts.every((v) => v.matched),
    status,
    wrongAccountSlipIndexes,
    expectedGroup: groupCheck?.expectedGroup ?? null,
    d1Expenses: appliedExpenses,
    d1ExpensesTotal: appliedTotal,
    residual,
  };
}
