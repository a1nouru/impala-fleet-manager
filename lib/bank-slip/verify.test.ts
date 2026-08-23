import { describe, expect, it } from "vitest";
import { verifySlips, type ReportLine, type ExtractedSlip, type CompanyExpenseLine } from "./verify";

const report = (id: string, plate: string, date: string, net: number): ReportLine => ({
  reportId: id,
  plate,
  reportDate: date,
  netBalance: net,
});

const expense = (id: string, amount: number): CompanyExpenseLine => ({
  id,
  amount,
  description: "Materials",
  category: "Operations",
  expenseDate: "2026-08-19",
});

const slip = (amount: number, overrides: Partial<ExtractedSlip> = {}): ExtractedSlip => ({
  slip_type: "deposito",
  amount,
  date: null,
  reference: null,
  account_number: null,
  source_file: "slip.pdf",
  ...overrides,
});

describe("verifySlips", () => {
  it("matches each report to a single slip with the exact amount", () => {
    const result = verifySlips(
      [report("r1", "LDA-11-11-AA", "2026-08-19", 100_000), report("r2", "LDA-22-22-BB", "2026-08-19", 200_000)],
      [slip(200_000), slip(100_000)],
      300_000
    );

    expect(result.totalsMatch).toBe(true);
    expect(result.allReportsMatched).toBe(true);
    expect(result.reports.find((r) => r.reportId === "r1")?.matched).toBe(true);
    expect(result.reports.find((r) => r.reportId === "r1")?.matchedSlipIndexes).toEqual([1]);
    expect(result.reports.find((r) => r.reportId === "r2")?.matchedSlipIndexes).toEqual([0]);
    expect(result.unmatchedSlipIndexes).toEqual([]);
  });

  it("matches a report against a cash deposito plus a TPA fecho pair", () => {
    const result = verifySlips(
      [report("r1", "LDA-11-11-AA", "2026-08-19", 300_000)],
      [slip(250_000), slip(50_000, { slip_type: "fecho_tpa" })],
      300_000
    );

    expect(result.allReportsMatched).toBe(true);
    expect(result.reports[0].matchedSlipIndexes).toEqual([0, 1]);
    expect(result.totalsMatch).toBe(true);
  });

  it("reports a mismatch when a slip amount differs from every net balance", () => {
    const result = verifySlips(
      [report("r1", "LDA-11-11-AA", "2026-08-19", 100_000)],
      [slip(90_000)],
      100_000
    );

    expect(result.totalsMatch).toBe(false);
    expect(result.allReportsMatched).toBe(false);
    expect(result.reports[0].matched).toBe(false);
    expect(result.unmatchedSlipIndexes).toEqual([0]);
    expect(result.slipsTotal).toBe(90_000);
    expect(result.selectedTotal).toBe(100_000);
  });

  it("still reports a grand-total match when per-report attribution fails", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-19", 100_000), report("r2", "B", "2026-08-19", 200_000)],
      [slip(150_000), slip(150_000)],
      300_000
    );

    expect(result.totalsMatch).toBe(true);
    expect(result.allReportsMatched).toBe(false);
    expect(result.unmatchedSlipIndexes).toEqual([0, 1]);
  });

  it("consumes each slip only once when amounts repeat", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-19", 100_000), report("r2", "B", "2026-08-19", 100_000)],
      [slip(100_000), slip(100_000)],
      200_000
    );

    expect(result.allReportsMatched).toBe(true);
    const used = result.reports.flatMap((r) => r.matchedSlipIndexes);
    expect([...used].sort()).toEqual([0, 1]);
  });

  it("excludes 'other' documents (e.g. Saída de Caixa vouchers) from the slips total and matching", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-18", 763_750)],
      [slip(763_750), slip(640_000, { slip_type: "other" })],
      763_750
    );

    expect(result.slipsTotal).toBe(763_750);
    expect(result.totalsMatch).toBe(true);
    expect(result.allReportsMatched).toBe(true);
    // The voucher is surfaced for the accountant but never counted or matched.
    expect(result.unmatchedSlipIndexes).toEqual([]);
    expect(result.informationalSlipIndexes).toEqual([1]);
  });

  it("is 'verified' on an exact slips match, ignoring D+1 expenses", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-18", 100_000)],
      [slip(100_000)],
      100_000,
      [expense("e1", 40_000)]
    );

    expect(result.status).toBe("verified");
    expect(result.d1ExpensesTotal).toBe(0);
    expect(result.residual).toBe(0);
  });

  it("is 'verified_with_expenses' when slips plus D+1 company expenses cover the total", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-18", 1_000_000)],
      [slip(600_000)],
      1_000_000,
      [expense("e1", 250_000), expense("e2", 150_000)]
    );

    expect(result.status).toBe("verified_with_expenses");
    expect(result.totalsMatch).toBe(false);
    expect(result.d1ExpensesTotal).toBe(400_000);
    expect(result.residual).toBe(0);
    expect(result.d1Expenses).toHaveLength(2);
  });

  it("is 'unverified' with the remaining residual when even D+1 expenses cannot explain the gap", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-18", 1_000_000)],
      [slip(600_000)],
      1_000_000,
      [expense("e1", 250_000)]
    );

    expect(result.status).toBe("unverified");
    expect(result.d1ExpensesTotal).toBe(250_000);
    expect(result.residual).toBe(150_000);
  });

  it("is 'unverified' with a negative residual when slips exceed the selected total", () => {
    const result = verifySlips([report("r1", "A", "2026-08-18", 500_000)], [slip(600_000)], 500_000, []);

    expect(result.status).toBe("unverified");
    expect(result.residual).toBe(-100_000);
  });

  it("flags a slip credited to a non-regular account on a regular deposit and forces unverified", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-18", 100_000)],
      [slip(100_000, { account_number: "999911112222" })],
      100_000,
      [],
      { expectedGroup: "regular", regularAccounts: ["930508110002", "930508110001"] }
    );

    expect(result.wrongAccountSlipIndexes).toEqual([0]);
    expect(result.status).toBe("unverified");
  });

  it("accepts regular-account slips on a regular deposit, tolerating leading zeros", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-18", 100_000)],
      [slip(100_000, { account_number: "000930508110001" })],
      100_000,
      [],
      { expectedGroup: "regular", regularAccounts: ["930508110002", "930508110001"] }
    );

    expect(result.wrongAccountSlipIndexes).toEqual([]);
    expect(result.status).toBe("verified");
  });

  it("flags a regular-account slip on an agaseke deposit", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-18", 100_000)],
      [slip(100_000, { account_number: "930508110002" })],
      100_000,
      [],
      { expectedGroup: "agaseke", regularAccounts: ["930508110002", "930508110001"] }
    );

    expect(result.wrongAccountSlipIndexes).toEqual([0]);
    expect(result.status).toBe("unverified");
  });

  it("never flags slips without a readable account number or 'other' documents", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-18", 100_000)],
      [slip(100_000, { account_number: null }), slip(50_000, { slip_type: "other", account_number: "930508110002" })],
      100_000,
      [],
      { expectedGroup: "agaseke", regularAccounts: ["930508110002", "930508110001"] }
    );

    expect(result.wrongAccountSlipIndexes).toEqual([]);
    expect(result.status).toBe("verified");
  });

  it("skips account checking entirely when no account numbers are configured", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-18", 100_000)],
      [slip(100_000, { account_number: "123456789" })],
      100_000,
      [],
      { expectedGroup: "regular", regularAccounts: ["", ""] }
    );

    expect(result.wrongAccountSlipIndexes).toEqual([]);
    expect(result.status).toBe("verified");
  });

  it("tolerates sub-cent OCR rounding noise", () => {
    const result = verifySlips(
      [report("r1", "A", "2026-08-19", 100_000)],
      [slip(100_000.004)],
      100_000
    );

    expect(result.allReportsMatched).toBe(true);
    expect(result.totalsMatch).toBe(true);
  });
});
