import { describe, expect, it } from "vitest";
import { verifySlips, type ReportLine, type ExtractedSlip } from "./verify";

const report = (id: string, plate: string, date: string, net: number): ReportLine => ({
  reportId: id,
  plate,
  reportDate: date,
  netBalance: net,
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
