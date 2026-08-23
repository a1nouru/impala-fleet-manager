import { describe, expect, it } from "vitest";
import { parseSlipExtraction } from "./extraction-schema";

describe("parseSlipExtraction", () => {
  it("accepts a well-formed extraction payload", () => {
    const parsed = parseSlipExtraction(
      {
        slips: [
          {
            slip_type: "deposito",
            amount: 2714871,
            date: "2026-08-19",
            reference: "Depósito nº 12345",
            account_number: "930508110002",
          },
        ],
      },
      "bundle.pdf"
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].amount).toBe(2714871);
    expect(parsed[0].source_file).toBe("bundle.pdf");
  });

  it("prefers a per-slip source_file over the fallback when present", () => {
    const parsed = parseSlipExtraction(
      {
        slips: [
          { slip_type: "deposito", amount: 100, date: null, reference: null, account_number: null, source_file: "page2.pdf" },
        ],
      },
      "fallback.pdf"
    );

    expect(parsed[0].source_file).toBe("page2.pdf");
  });

  it("coerces an unknown slip_type to 'other'", () => {
    const parsed = parseSlipExtraction(
      { slips: [{ slip_type: "recibo", amount: 100, date: null, reference: null, account_number: null }] },
      "a.jpg"
    );

    expect(parsed[0].slip_type).toBe("other");
  });

  it("rejects payloads with a missing or non-numeric amount", () => {
    expect(() =>
      parseSlipExtraction({ slips: [{ slip_type: "deposito", amount: "abc", date: null, reference: null, account_number: null }] }, "a.pdf")
    ).toThrow();
    expect(() => parseSlipExtraction({ nope: true }, "a.pdf")).toThrow();
  });
});
