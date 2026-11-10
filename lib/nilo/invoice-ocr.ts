// What Claude reads off a supplier invoice. The schema is the wire contract for the "ocr" action:
// the server hands it to the model, the purchase dialog imports its type.
// zod/v4: the Anthropic SDK's output-format helper only serializes v4 schemas.
import { z } from "zod/v4";

export const ocrSchema = z.object({
  supplier: z
    .string()
    .nullable()
    .describe("Seller's company name (the issuer, not the customer)"),
  supplier_nif: z.string().nullable().describe("Seller's NIF as printed"),
  invoice_no: z
    .string()
    .nullable()
    .describe("Invoice number exactly as printed, e.g. 'FT A2026/123'"),
  invoice_date: z.string().nullable().describe("Invoice date as yyyy-MM-dd"),
  total: z
    .number()
    .nullable()
    .describe("Grand total payable in Kz, IVA included, after discounts"),
  lines: z.array(
    z.object({
      description: z.string().describe("The line's text exactly as printed"),
      item_name: z
        .string()
        .describe(
          "Short clean part name; the catalogue name when it is the same part",
        ),
      quantity: z.number(),
      unit_cost: z
        .number()
        .describe("Final price of one unit in Kz: after discounts, IVA included"),
    }),
  ),
});

export const OCR_SYSTEM = `You transcribe Angolan supplier invoices (faturas) for vehicle parts into structured data for a garage stock system.

Rules:
- The pages belong to one invoice, in order. Read every page.
- The supplier is the seller that issued the invoice, not the customer it was billed to. Take the seller's NIF.
- Angolan numbers use '.' for thousands and ',' for decimals: "85.000,00" is 85000.
- One output line per product line. quantity is the number of units bought.
- unit_cost is what one unit finally costs: apply line and invoice discounts, and add IVA (often 14%) when line prices exclude it, so that quantity × unit_cost summed over the lines equals the grand total.
- total is the grand total payable as printed.
- item_name: a short, clean part name (brand and size when printed, no codes or prices). When the line is the same part as one in the catalogue, use that catalogue name exactly.
- Use null for a header field that is not legible. Never invent values.`;

export type OcrInvoice = z.infer<typeof ocrSchema>;
