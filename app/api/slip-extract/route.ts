import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { parseSlipExtraction, slipExtractionWireSchema } from "@/lib/bank-slip/extraction-schema";

// Node runtime so the ANTHROPIC_API_KEY runtime env var is available on Railway.
export const runtime = "nodejs";

const MAX_FILES = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ACCEPTED: Record<string, "pdf" | "image/jpeg" | "image/png"> = {
  "application/pdf": "pdf",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
};

const SYSTEM_PROMPT = `You transcribe scanned Angolan bank deposit slips (Caixa Angola and BAI) for an accounting reconciliation tool.

Rules:
- Extract every distinct slip visible across the attached documents. A PDF may bundle several slips, one per page or several per page.
- slip_type: "deposito" for cash deposit slips (Depósito nº / bordereau), "fecho_tpa" for card terminal receipts, "other" for anything else.
- A standalone card purchase receipt (e.g. "MCX DEBIT COMPRA") with no close-out for that terminal also counts as fecho_tpa, using its purchase amount.
- Internal company vouchers (e.g. "Saída de Caixa" cash-out/payment forms) are NOT bank slips — classify them as "other".
- amount is the slip's TOTAL in kwanzas. Angolan formatting uses '.' for thousands and ',' for decimals: "2.714.871,00" is 2714871.00.
- For a Fecho TPA use the GROSS purchases total (the COMPRA/Valor sum), NOT "TOTAL A MOVIMENTAR" — that figure is net of bank fees, and reconciliation is against gross card revenue.
- Only include a slip when its total is clearly legible. Never guess or invent an amount.
- A carbon copy or duplicate photo of the same slip (same reference and amount) counts once.
- source_file must be the "File:" label that precedes the document the slip appears on.
- Transcribe exactly what is printed. This output is used to verify money was actually banked — accuracy over completeness.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Slip verification is not configured (missing ANTHROPIC_API_KEY)." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    // FormDataEntryValue is string | File; avoid `instanceof File` — the
    // global File class doesn't exist on Node 18 (Railway's runtime).
    const files = formData.getAll("files").filter((f): f is File => typeof f !== "string");

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 });
    }

    const content: Anthropic.ContentBlockParam[] = [];
    for (const file of files) {
      const kind = ACCEPTED[file.type];
      if (!kind) {
        return NextResponse.json(
          { error: `${file.name}: unsupported type. Upload PDF, JPG, or PNG.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.name}: file exceeds 10MB.` }, { status: 400 });
      }

      const data = Buffer.from(await file.arrayBuffer()).toString("base64");
      content.push({ type: "text", text: `File: ${file.name}` });
      content.push(
        kind === "pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
          : { type: "image", source: { type: "base64", media_type: kind, data } }
      );
    }
    content.push({
      type: "text",
      text: "Extract every bank slip on the documents above as structured JSON.",
    });

    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(slipExtractionWireSchema) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json(
        { error: "Could not extract slip data from the uploaded documents." },
        { status: 422 }
      );
    }

    const slips = parseSlipExtraction(response.parsed_output, files[0].name);
    return NextResponse.json({ slips });
  } catch (error) {
    console.error("slip-extract error:", error);
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Slip verification API key is invalid." }, { status: 503 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Verification service is rate limited — try again shortly." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Verification service error (${error.status}).` }, { status: 502 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
