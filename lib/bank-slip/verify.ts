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

export interface SlipVerification {
  reports: ReportVerdict[];
  unmatchedSlipIndexes: number[];
  slipsTotal: number;
  selectedTotal: number;
  totalsMatch: boolean;
  allReportsMatched: boolean;
}

// Amounts come back from OCR with occasional float noise; a kwanza has 100
// centimos, so anything under half a centimo is the same number.
const EPS = 0.005;

const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function verifySlips(
  reports: ReportLine[],
  slips: ExtractedSlip[],
  selectedTotal: number
): SlipVerification {
  const used = new Array<boolean>(slips.length).fill(false);
  const verdicts: ReportVerdict[] = reports.map((r) => ({ ...r, matched: false, matchedSlipIndexes: [] }));

  // Pass 1: one slip whose amount equals the report's net balance.
  for (const v of verdicts) {
    const i = slips.findIndex((s, idx) => !used[idx] && eq(s.amount, v.netBalance));
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
      if (used[a]) continue;
      for (let b = a + 1; b < slips.length; b++) {
        if (used[b]) continue;
        if (eq(slips[a].amount + slips[b].amount, v.netBalance)) {
          used[a] = used[b] = true;
          v.matched = true;
          v.matchedSlipIndexes = [a, b];
          break outer;
        }
      }
    }
  }

  const slipsTotal = slips.reduce((sum, s) => sum + s.amount, 0);

  return {
    reports: verdicts,
    unmatchedSlipIndexes: slips.map((_, i) => i).filter((i) => !used[i]),
    slipsTotal,
    selectedTotal,
    totalsMatch: eq(slipsTotal, selectedTotal),
    allReportsMatched: verdicts.every((v) => v.matched),
  };
}
