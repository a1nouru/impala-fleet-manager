import { NextResponse } from "next/server";
import { getPartsData } from "@/data/partsData";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DEFAULT_MODEL = "gpt-4o-mini";

// IMPORTANT: keep this prompt string EXACTLY as provided in the spec.
const OCR_PROMPT = `You are an invoice data extraction expert. Analyze this Portuguese invoice document and extract all line items with their details.

IMPORTANT: The invoice is in Portuguese. Extract the data exactly as shown.

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks, just raw JSON):
{
  "invoice_date": "YYYY-MM-DD",
  "items": [
    {
      "description": "Full item description as shown on invoice",
      "quantity": <number>,
      "unit_price": <number - final price per unit without currency symbols (tax-inclusive if IVA applies)>,
      "total": <number - final line total without currency symbols (tax-inclusive if IVA applies)>,
      "iva_rate": <number - IVA rate percentage for this line, e.g. 14>,
      "iva_amount": <number - IVA amount for this line without currency symbols>,
      "total_excl_tax": <number - line total excluding IVA (after discounts)>,
      "total_incl_tax": <number - line total including IVA (after discounts)>
    }
  ]
}

Rules:
1. Extract ALL items from the invoice, not just a few
2. For "invoice_date", use the date shown on the invoice in YYYY-MM-DD format
3. For prices, remove any currency symbols (Kz, AKZ, AOA, $, etc.) and thousand separators
4. If quantity is not explicitly shown, assume 1
5. If unit_price or total contains decimals like "85,000.00" or "85.000,00", convert to number 85000
6. Ignore any crossed-out or cancelled items
7. Discounts: if the invoice shows an overall discount (e.g., "Desconto") and line totals do not already reflect it, distribute the discount proportionally across line items by their pre-discount line totals, then set each item's "total" and "unit_price" to the discounted values. Always keep quantity unchanged.
8. IVA (tax): if the invoice includes IVA (often shown as "I.V.A." or "IVA" with a rate like 14%), compute IVA per line item based on the discounted line base (total_excl_tax). Set iva_rate and iva_amount for each line. Then set total_incl_tax = total_excl_tax + iva_amount.
9. If the invoice already has per-line totals, determine whether they are tax-inclusive. If totals are tax-exclusive but IVA is shown separately, add IVA to compute the final total. If totals already include IVA, still compute iva_amount and keep total_incl_tax equal to the shown total.
10. Ensure unit_price * quantity equals the FINAL total for the line (tax-inclusive). Adjust unit_price accordingly.
11. If you cannot determine a value, use 0 for numbers or empty string for text

Extract the invoice data now:`;

type OcrModelItem = {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  iva_rate: number;
  iva_amount: number;
  total_excl_tax: number;
  total_incl_tax: number;
};

type OcrModelResponse = {
  invoice_date: string;
  items: OcrModelItem[];
};

type InventoryMappedItem = {
  date: string;
  item_name: string;
  description: string;
  quantity: number;
  amount_unit: number;
  total_cost: number;
};

function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function diceCoefficient(aRaw: string, bRaw: string): number {
  const a = normalizeText(aRaw);
  const b = normalizeText(bRaw);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }

  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigrams.get(bg) ?? 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      matches++;
    }
  }

  return (2 * matches) / ((a.length - 1) + (b.length - 1));
}

function chooseBestNameMatch(description: string, candidates: string[]): { name: string; score: number } | null {
  const desc = normalizeText(description);
  if (!desc) return null;

  const unique = Array.from(new Set(candidates.filter(Boolean)));

  let best: { name: string; score: number } | null = null;
  for (const c of unique) {
    const cNorm = normalizeText(c);
    if (!cNorm) continue;

    let score = diceCoefficient(desc, cNorm);
    // Small conservative boosts for strong containment.
    if (desc.includes(cNorm) || cNorm.includes(desc)) score = Math.min(1, score + 0.08);

    if (!best || score > best.score) best = { name: c, score };
  }

  return best;
}

function extractOutputText(openaiResponse: unknown): string {
  // Responses API commonly provides either:
  // - output_text (string)
  // - output: [{ content: [{ type: "output_text", text: "..." }, ...] }, ...]
  const r = openaiResponse as {
    output_text?: unknown;
    output?: unknown;
  };

  if (typeof r?.output_text === "string" && r.output_text.trim()) {
    return r.output_text.trim();
  }

  const chunks: string[] = [];
  const output = Array.isArray(r?.output) ? r.output : [];
  for (const msg of output) {
    const m = msg as { content?: unknown };
    const content = Array.isArray(m?.content) ? m.content : [];
    for (const c of content) {
      const cc = c as { type?: unknown; text?: unknown };
      if (cc?.type === "output_text" && typeof cc?.text === "string") chunks.push(cc.text);
      if (cc?.type === "text" && typeof cc?.text === "string") chunks.push(cc.text);
    }
  }

  return chunks.join("\n").trim();
}

async function listCustomPartsIfExists(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("custom_parts").select("name,item_name").limit(5000);
    if (error) {
      const msg = `${error.message ?? ""}`;
      if (error.code === "PGRST106" || msg.includes('relation "public.custom_parts" does not exist')) {
        return [];
      }
      return [];
    }
    const names = (data ?? [])
      .map((row: unknown) => {
        const r = row as { name?: unknown; item_name?: unknown };
        return (typeof r?.name === "string" && r.name) || (typeof r?.item_name === "string" && r.item_name) || null;
      })
      .filter((v): v is string => typeof v === "string");
    return names;
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const model = process.env.OPENAI_OCR_MODEL || DEFAULT_MODEL;

    const form = await req.formData();
    const filesFromMulti = form.getAll("files").filter((f): f is File => f instanceof File);
    const single = form.get("file");
    const files = filesFromMulti.length > 0 ? filesFromMulti : single instanceof File ? [single] : [];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    for (const f of files) {
      if (!f.type?.startsWith("image/")) {
        return NextResponse.json({ error: "Only image files are supported. Convert PDFs to images client-side." }, { status: 400 });
      }
    }

    const imageContents = await Promise.all(
      files.map(async (file) => {
        const buf = Buffer.from(await file.arrayBuffer());
        const b64 = buf.toString("base64");
        const dataUrl = `data:${file.type};base64,${b64}`;
        return { type: "input_image" as const, image_url: dataUrl };
      })
    );

    const openaiBody = {
      model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: OCR_PROMPT }, ...imageContents],
        },
      ],
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiBody),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return NextResponse.json({ error: "OpenAI request failed", details: errText }, { status: 500 });
    }

    const openaiJson = await r.json();
    const outputText = extractOutputText(openaiJson);
    if (!outputText) {
      return NextResponse.json({ error: "Empty model output" }, { status: 500 });
    }

    let parsed: OcrModelResponse;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return NextResponse.json({ error: "Failed to parse model JSON", raw: outputText }, { status: 500 });
    }

    const invoiceDate = typeof parsed?.invoice_date === "string" ? parsed.invoice_date : "";
    const rawItems: OcrModelItem[] = Array.isArray(parsed?.items) ? parsed.items : [];

    // Build Portuguese candidates from static parts list.
    const partsPt = getPartsData("pt") as Array<{ items?: Array<{ name?: string }> }>;
    const partNames = partsPt
      .flatMap((cat) => (cat?.items ?? []).map((i) => i?.name))
      .filter((n): n is string => typeof n === "string" && !!n);
    const customPartNames = await listCustomPartsIfExists();
    const candidates = [...partNames, ...customPartNames];

    const MATCH_THRESHOLD = 0.82; // intentionally conservative

    const mapped: InventoryMappedItem[] = rawItems.map((it) => {
      const description = typeof it?.description === "string" ? it.description : "";
      const quantity = Number.isFinite(it?.quantity) && (it.quantity as number) > 0 ? Number(it.quantity) : 1;

      const totalIncl = Number.isFinite(it?.total_incl_tax) && (it.total_incl_tax as number) > 0 ? Number(it.total_incl_tax) : 0;
      const total = Number.isFinite(it?.total) && (it.total as number) > 0 ? Number(it.total) : 0;
      const totalCost = totalIncl > 0 ? totalIncl : total > 0 ? total : 0;

      const unit = Number.isFinite(it?.unit_price) && (it.unit_price as number) > 0 ? Number(it.unit_price) : 0;
      const amountUnit = totalCost > 0 && quantity > 0 ? totalCost / quantity : unit;

      const match = chooseBestNameMatch(description, candidates);
      const itemName = match && match.score >= MATCH_THRESHOLD ? match.name : description || "Unknown";

      return {
        date: invoiceDate,
        item_name: itemName,
        description,
        quantity,
        total_cost: totalCost,
        amount_unit: amountUnit,
      };
    });

    return NextResponse.json({
      invoice_date: invoiceDate,
      items: mapped,
    });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Invoice OCR failed",
        details,
      },
      { status: 500 }
    );
  }
}

