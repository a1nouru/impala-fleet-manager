import { z } from "zod";
import type { ExtractedSlip, SlipType } from "./verify";

// Wire schema handed to Claude via zodOutputFormat — must stay free of
// transforms/refinements so it can be serialized to JSON Schema. The API's
// structured-output mode guarantees the response matches it.
export const slipExtractionWireSchema = z.object({
  slips: z.array(
    z.object({
      slip_type: z
        .enum(["deposito", "fecho_tpa", "other"])
        .describe(
          "deposito = cash deposit slip (Depósito/Bordereau), fecho_tpa = card terminal close-out (Fecho TPA), other = anything else"
        ),
      amount: z
        .number()
        .describe(
          "The slip's total amount in AOA (kwanzas). Angolan format uses '.' for thousands and ',' for decimals: '2.714.871,00' means 2714871.00"
        ),
      date: z.string().nullable().describe("Date printed on the slip as ISO yyyy-MM-dd, or null if unreadable"),
      reference: z.string().nullable().describe("Slip reference: 'Depósito nº …', TPA terminal id (Ident. TPA), or similar"),
      account_number: z.string().nullable().describe("Destination account number if visible"),
      source_file: z.string().describe("The 'File:' label preceding the document this slip appears on"),
    })
  ),
});

// Lenient app-side validator for whatever comes back over the wire — the
// seam between untyped JSON and the deterministic matcher in verify.ts.
const slipSchema = z.object({
  slip_type: z
    .string()
    .transform((v): SlipType => (v === "deposito" || v === "fecho_tpa" ? v : "other")),
  amount: z.number().nonnegative(),
  date: z.string().nullable(),
  reference: z.string().nullable(),
  account_number: z.string().nullable(),
  source_file: z.string().optional(),
});

const extractionSchema = z.object({ slips: z.array(slipSchema) });

export function parseSlipExtraction(payload: unknown, fallbackSourceFile: string): ExtractedSlip[] {
  return extractionSchema
    .parse(payload)
    .slips.map((s) => ({ ...s, source_file: s.source_file || fallbackSourceFile }));
}
