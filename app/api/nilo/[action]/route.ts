import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { niloSession, type NiloSession } from "@/lib/nilo/server";
import {
  checkInvoice,
  nifAndNumber,
  type InvoiceDraft,
} from "@/lib/nilo/invoice-checks";
import { itemKey } from "@/lib/nilo/ingest";
import { OCR_SYSTEM, ocrSchema } from "@/lib/nilo/invoice-ocr";
import { PAGE_TYPES } from "@/lib/nilo/client";
import {
  buildStatement,
  type Movement,
  type Range,
  type Unit,
} from "@/lib/nilo/ledger";
import {
  buildStatementDoc,
  statementNo,
  type Job,
  type PriorStatement,
  type StatementDoc,
} from "@/lib/nilo/statement-doc";

export const runtime = "nodejs";

type Handler = (s: NiloSession, req: NextRequest) => Promise<unknown>;

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const must = <T>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new HttpError(400, r.error.message);
  return r.data;
};

const approverOnly = (s: NiloSession) => {
  if (!s.isApprover)
    throw new HttpError(403, "Only Nilo approvers can do this");
};

// One hash over every page in order; a single file hashes the same as before multi-page uploads.
const sha256 = async (files: File[]) => {
  const h = createHash("sha256");
  for (const f of files) h.update(Buffer.from(await f.arrayBuffer()));
  return h.digest("hex");
};

const safeName = (f: File) => f.name.replace(/[^\w.-]+/g, "_");

// Invoice pages: phone photos or a PDF. Claude takes images up to 5 MB and requests up to
// 32 MB (base64 adds a third), so the browser shrinks photos before sending.
const MAX_PAGES = 10;
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const MAX_TOTAL = 20 * 1024 * 1024;

function invoicePages(form: FormData): File[] {
  const files = form
    .getAll("files")
    .filter((f): f is File => typeof f !== "string" && f.size > 0);
  if (files.length === 0)
    throw new HttpError(400, "Add a photo or file of the invoice");
  if (files.length > MAX_PAGES)
    throw new HttpError(400, `At most ${MAX_PAGES} pages per invoice`);
  for (const f of files) {
    if (!PAGE_TYPES.includes(f.type))
      throw new HttpError(
        400,
        `${f.name}: use a photo (JPG, PNG, WebP) or a PDF`,
      );
    if (f.size > (f.type === "application/pdf" ? MAX_PDF : MAX_IMAGE))
      throw new HttpError(400, `${f.name} is too large`);
  }
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL)
    throw new HttpError(400, "The pages are too large together");
  return files;
}

async function cutoverAt(s: NiloSession): Promise<string | null> {
  const row = must(
    await s.db
      .from("nilo_settings")
      .select("value")
      .eq("key", "cutover_at")
      .maybeSingle(),
  );
  return row?.value ?? null;
}

async function pageAll<T>(
  q: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = must(await q(from, from + 999)) ?? [];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

// The company's statement for a month, computed from the movement log.
async function statementFor(s: NiloSession, range: Range) {
  type Row = {
    unit_id: string;
    type: Movement["type"];
    quantity: number;
    company: Movement["company"];
    vehicle_plate: string | null;
    maintenance_record_id: string | null;
    created_at: string;
    unit: {
      code: string;
      line: {
        unit_cost: number;
        container_size: number | null;
        item: { name: string };
      };
    };
  };
  const rows = await pageAll<Row>((from, to) => {
    const q = s.db
      .from("nilo_movements")
      .select(
        "unit_id, type, quantity, company, vehicle_plate, maintenance_record_id, created_at, unit:nilo_units(code, line:nilo_invoice_lines(unit_cost, container_size, item:nilo_items(name)))",
      )
      .eq("company", s.company)
      .lt("created_at", range.to);
    return (range.from === null ? q : q.gte("created_at", range.from))
      .order("id")
      .range(from, to)
      .returns<Row[]>();
  });
  const units = new Map<string, Unit>(
    rows.map((r) => [
      r.unit_id,
      {
        id: r.unit_id,
        code: r.unit.code,
        itemName: r.unit.line.item.name,
        unitCost: Number(r.unit.line.unit_cost),
        containerSize:
          r.unit.line.container_size === null
            ? null
            : Number(r.unit.line.container_size),
      },
    ]),
  );
  const movements: Movement[] = rows.map((r) => ({
    unitId: r.unit_id,
    type: r.type,
    quantity: Number(r.quantity),
    company: r.company,
    vehiclePlate: r.vehicle_plate,
    recordId: r.maintenance_record_id,
    at: r.created_at,
  }));
  return buildStatement(s.company, range, [...units.values()], movements);
}

// The full statement document: the month's lines plus each job's date and description (from
// this app's own maintenance records) and the company's earlier statements for the balance.
// The company's earlier statements, newest first.
async function priorStatements(s: NiloSession): Promise<PriorStatement[]> {
  const rows = must(
    await s.db
      .from("nilo_statements")
      .select("statement_no, period_end, total, status, paid_at")
      .eq("company", s.company)
      .order("period_end", { ascending: false }),
  ) as {
    statement_no: string;
    period_end: string;
    total: number;
    status: "issued" | "paid";
    paid_at: string | null;
  }[];
  return rows.map((r) => ({
    statementNo: r.statement_no,
    to: r.period_end,
    total: Number(r.total),
    status: r.status,
    paidAt: r.paid_at,
  }));
}

// The statement document from the end of the previous statement up to `to`: every line plus
// each job's date and description (from this app's own maintenance records) and the balance.
async function statementDocFor(
  s: NiloSession,
  to: string,
  issue: { issuedAt: string; statementNo: string } | null,
): Promise<StatementDoc> {
  const prior = await priorStatements(s);
  const st = await statementFor(s, { from: prior[0]?.to ?? null, to });
  const ids = [
    ...new Set(
      st.lines.map((l) => l.recordId).filter((id): id is string => !!id),
    ),
  ];
  const app = await createSessionClient();
  const jobs = new Map<string, Job>();
  for (let i = 0; i < ids.length; i += 200) {
    const rows = must(
      await app
        .from("maintenance_records")
        .select("id, date, description")
        .in("id", ids.slice(i, i + 200)),
    ) as { id: string; date: string; description: string | null }[];
    for (const r of rows)
      jobs.set(r.id, {
        date: String(r.date).slice(0, 10),
        description: r.description ?? "",
      });
  }
  return buildStatementDoc(st, jobs, prior, issue);
}

const READS: Record<string, Handler> = {
  me: async (s) => ({
    email: s.email,
    company: s.company,
    isApprover: s.isApprover,
    cutoverAt: await cutoverAt(s),
  }),

  stock: async (s) =>
    pageAll((from, to) =>
      s.db
        .from("nilo_stock")
        .select("*")
        .order("name")
        .order("item_id")
        .range(from, to),
    ),

  invoices: async (s) =>
    must(
      await s.db
        .from("nilo_invoices")
        .select(
          "*, lines:nilo_invoice_lines(*, item:nilo_items(name, kind, measure_unit))",
        )
        .neq("origin", "legacy")
        .order("created_at", { ascending: false })
        .limit(200),
    ),

  // This month so far, for whichever company this app is. Not stored; recomputed each time.
  // Everything not yet on a statement, up to now. Not stored; recomputed each time.
  running: async (s) => statementDocFor(s, new Date().toISOString(), null),

  statements: async (s) =>
    must(
      await s.db
        .from("nilo_statements")
        .select("*")
        .eq("company", s.company)
        .order("period_end", { ascending: false }),
    ),

  statement: async (s, req) =>
    must(
      await s.db
        .from("nilo_statements")
        .select("*")
        .eq("id", req.nextUrl.searchParams.get("id") ?? "")
        .eq("company", s.company)
        .single(),
    ),

  trace: async (s, req) => {
    const code = (req.nextUrl.searchParams.get("code") ?? "")
      .trim()
      .toUpperCase();
    const unit = must(
      await s.db
        .from("nilo_units")
        .select(
          "*, line:nilo_invoice_lines(*, item:nilo_items(name, kind, measure_unit), invoice:nilo_invoices(*))",
        )
        .eq("code", code)
        .maybeSingle(),
    );
    if (!unit) throw new HttpError(404, `Unknown code ${code}`);
    const movements = must(
      await s.db
        .from("nilo_movements")
        .select("*")
        .eq("unit_id", unit.id)
        .order("id"),
    );
    return { unit, movements };
  },

  // Label codes to print: all units of an invoice line, or the unsold stock of an item.
  codes: async (s, req) => {
    const line = req.nextUrl.searchParams.get("line");
    const item = req.nextUrl.searchParams.get("item");
    return pageAll((from, to) => {
      const q = s.db
        .from("nilo_units")
        .select(
          "code, line:nilo_invoice_lines!inner(item_id, item:nilo_items(name), invoice:nilo_invoices(invoice_no))",
        )
        .order("code")
        .range(from, to);
      return line
        ? q.eq("line_id", line)
        : q
            .eq("line.item_id", item ?? "")
            .in("status", ["labelled", "in_stock"]);
    });
  },

  file: async (s, req) => {
    const bucket = req.nextUrl.searchParams.get("bucket") ?? "";
    if (bucket !== "nilo-invoices" && bucket !== "nilo-payments")
      throw new HttpError(400, "bad bucket");
    const path = req.nextUrl.searchParams.get("path") ?? "";
    if (!path.endsWith("/")) {
      const signed = must(
        await s.db.storage.from(bucket).createSignedUrl(path, 600),
      );
      if (!signed) throw new HttpError(404, "file not found");
      return NextResponse.redirect(signed.signedUrl);
    }
    // A multi-page invoice is a folder of pages; show them all, in order, on one page.
    const pages = must(
      await s.db.storage
        .from(bucket)
        .list(path.slice(0, -1), { sortBy: { column: "name", order: "asc" } }),
    );
    const signed = must(
      await s.db.storage.from(bucket).createSignedUrls(
        (pages ?? []).map((p) => path + p.name),
        600,
      ),
    );
    const body = (signed ?? [])
      .map((p) =>
        p.path?.endsWith(".pdf")
          ? `<p><a href="${p.signedUrl}">${p.path.split("/").pop()}</a></p>`
          : `<img src="${p.signedUrl}" style="display:block;max-width:100%;margin:0 auto 12px">`,
      )
      .join("");
    return new NextResponse(
      `<!doctype html><meta name="viewport" content="width=device-width"><body style="margin:8px">${body}</body>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  },
};

const WRITES: Record<string, Handler> = {
  // Reads invoice pages with Claude. Writes nothing; the dialog shows the result for review.
  ocr: async (s, req) => {
    const files = invoicePages(await req.formData());
    if (!process.env.ANTHROPIC_API_KEY)
      throw new HttpError(
        503,
        "Invoice reading is not configured (ANTHROPIC_API_KEY)",
      );
    const names = (
      await pageAll<{ name: string }>((from, to) =>
        s.db.from("nilo_items").select("name").order("name").range(from, to),
      )
    ).map((i) => i.name);
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const [i, f] of files.entries()) {
      const data = Buffer.from(await f.arrayBuffer()).toString("base64");
      content.push({ type: "text", text: `Page ${i + 1}` });
      content.push(
        f.type === "application/pdf"
          ? {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data },
            }
          : {
              type: "image",
              source: {
                type: "base64",
                media_type: f.type as "image/jpeg" | "image/png" | "image/webp",
                data,
              },
            },
      );
    }
    content.push({
      type: "text",
      text: `Catalogue of existing part names:\n${names.join("\n") || "(empty)"}\n\nTranscribe this invoice.`,
    });
    try {
      const res = await new Anthropic().beta.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: OCR_SYSTEM,
        messages: [{ role: "user", content }],
        output_config: { format: betaZodOutputFormat(ocrSchema) },
      });
      if (res.stop_reason === "refusal" || !res.parsed_output)
        throw new HttpError(
          422,
          "Could not read this invoice. Fill it in by hand.",
        );
      return res.parsed_output;
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError)
        throw new HttpError(
          429,
          "Invoice reading is busy. Try again in a moment.",
        );
      if (e instanceof Anthropic.APIError)
        throw new HttpError(
          502,
          `Invoice reading failed (${e.status ?? "network"})`,
        );
      throw e;
    }
  },

  invoice: async (s, req) => {
    const form = await req.formData();
    const files = invoicePages(form);
    const meta = JSON.parse(String(form.get("meta"))) as Omit<
      InvoiceDraft,
      "fileSha256" | "lines"
    > & {
      supplier: string;
      ocrRaw?: unknown;
      lines: (InvoiceDraft["lines"][number] & {
        description: string;
        itemName: string;
        kind: "unit" | "bulk";
        measureUnit?: string;
        containerSize?: number | null;
      })[];
    };
    if (!meta.lines?.length || meta.lines.some((l) => !l.itemName?.trim())) {
      throw new HttpError(400, "Every line needs an item name");
    }

    const draft: InvoiceDraft = { ...meta, fileSha256: await sha256(files) };
    const key = nifAndNumber(draft.supplierNif, draft.invoiceNo);
    const [nif, no] = key.split("|");
    const [dupNumber, dupFile] = await Promise.all([
      s.db
        .from("nilo_invoices")
        .select("id", { count: "exact", head: true })
        .eq("supplier_nif", nif)
        .eq("invoice_no", no),
      s.db
        .from("nilo_invoices")
        .select("id", { count: "exact", head: true })
        .eq("file_sha256", draft.fileSha256),
    ]);
    const verdict = checkInvoice(
      draft,
      {
        nifAndNumber: new Set(dupNumber.count ? [key] : []),
        fileHashes: new Set(dupFile.count ? [draft.fileSha256] : []),
      },
      new Date(),
    );
    if (verdict.status === "blocked")
      return { status: "blocked", checks: verdict.checks };

    // Pages go in their own folder, named so they list back in order.
    const path = `${s.company}/${randomUUID()}/`;
    for (const [i, f] of files.entries())
      must(
        await s.db.storage
          .from("nilo-invoices")
          .upload(
            `${path}${String(i + 1).padStart(2, "0")}-${safeName(f)}`,
            f,
            {
              contentType: f.type,
            },
          ),
      );
    const id = must(
      await s.db.rpc("nilo_create_invoice", {
        p: {
          supplier: meta.supplier,
          supplier_nif: nif,
          invoice_no: no,
          invoice_date: draft.invoiceDate,
          total: draft.total,
          file_path: path,
          file_sha256: draft.fileSha256,
          ocr_raw: meta.ocrRaw ?? null,
          checks: verdict.checks,
          status: verdict.status,
          uploaded_by: s.email,
          source_company: s.company,
          lines: meta.lines.map((l) => ({
            ocr_description: l.description,
            item_name: l.itemName.trim(),
            alias: itemKey(l.itemName),
            kind: l.kind,
            measure_unit: l.kind === "bulk" ? l.measureUnit || "L" : null,
            container_size: l.kind === "bulk" ? l.containerSize : null,
            quantity: l.quantity,
            unit_cost: l.unitCost,
          })),
        },
      }),
    );
    return { id, status: verdict.status, checks: verdict.checks };
  },

  approve: async (s, req) => {
    approverOnly(s);
    const { invoiceId } = await req.json();
    must(
      await s.db
        .from("nilo_invoices")
        .update({
          status: "approved",
          approved_by: s.email,
          approved_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .eq("status", "pending_approval"),
    );
    return { ok: true };
  },

  labels: async (s, req) => {
    const { lineId } = await req.json();
    return must(await s.db.rpc("nilo_generate_labels", { p_line: lineId }));
  },

  receive: async (s, req) => {
    const { code } = await req.json();
    return must(
      await s.db.rpc("nilo_receive", { p_code: code, p_user: s.email }),
    );
  },

  // Makes a maintenance record's Nilo consumption match its parts list (see nilo_set_record_parts).
  "record-parts": async (s, req) => {
    const { recordId, plate, parts, codes } = (await req.json()) as {
      recordId: string;
      plate: string;
      parts: { itemId: string; quantity: number }[];
      codes?: string[];
    };
    const [cutover, record] = await Promise.all([
      cutoverAt(s),
      (await createSessionClient())
        .from("maintenance_records")
        .select("created_at")
        .eq("id", recordId)
        .maybeSingle(),
    ]);
    // A deleted record has no row left; a record from before the cutover was settled by the import.
    if (record.data && cutover && record.data.created_at < cutover)
      return { skipped: "legacy record" };
    must(
      await s.db.rpc("nilo_set_record_parts", {
        p_company: s.company,
        p_record: recordId,
        p_plate: plate,
        p_user: s.email,
        p_parts: parts.map((p) => ({
          item_id: p.itemId,
          quantity: p.quantity,
        })),
        p_codes: codes ?? [],
      }),
    );
    return { ok: true };
  },

  // Freezes the running statement at this moment. The next one starts exactly here.
  statement: async (s) => {
    approverOnly(s);
    const issuedAt = new Date().toISOString();
    // Earlier statements today, for the number's day counter.
    const { count } = await s.db
      .from("nilo_statements")
      .select("id", { count: "exact", head: true })
      .eq("company", s.company)
      .gte("period_end", `${issuedAt.slice(0, 10)}T00:00:00Z`);
    const doc = await statementDocFor(s, issuedAt, {
      issuedAt,
      statementNo: statementNo(s.company, issuedAt, (count ?? 0) + 1),
    });
    if (doc.vehicles.length === 0)
      throw new HttpError(
        400,
        "Nothing has been used since the last statement",
      );
    return must(
      await s.db
        .from("nilo_statements")
        .insert({
          statement_no: doc.statementNo,
          company: s.company,
          period_start: doc.from,
          period_end: doc.to,
          lines: doc,
          // This statement's own net charges; earlier unpaid balances live on their own statements.
          total:
            Math.round((doc.account.charges - doc.account.credits) * 100) / 100,
          issued_by: s.email,
        })
        .select()
        .single(),
    );
  },

  paid: async (s, req) => {
    approverOnly(s);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new HttpError(400, "Attach the bank payment proof");
    const id = String(form.get("statementId"));
    const path = `${s.company}/${id}-${safeName(file)}`;
    must(
      await s.db.storage
        .from("nilo-payments")
        .upload(path, file, { contentType: file.type }),
    );
    must(
      await s.db
        .from("nilo_statements")
        .update({
          status: "paid",
          paid_by: s.email,
          paid_at: new Date().toISOString(),
          payment_proof_path: path,
          payment_proof_sha256: await sha256([file]),
        })
        .eq("id", id)
        .eq("company", s.company),
    );
    return { ok: true };
  },
};

async function run(table: Record<string, Handler>, req: NextRequest, ctx: Ctx) {
  const handler = table[(await ctx.params).action];
  if (!handler)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const s = await niloSession();
    if (!s)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const out = await handler(s, req);
    return out instanceof NextResponse ? out : NextResponse.json(out);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error("nilo:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Nilo error" },
      { status },
    );
  }
}

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ action: string }> };
export const GET = (req: NextRequest, ctx: Ctx) => run(READS, req, ctx);
export const POST = (req: NextRequest, ctx: Ctx) => run(WRITES, req, ctx);
