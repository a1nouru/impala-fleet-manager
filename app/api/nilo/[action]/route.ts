import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { niloSession, type NiloSession } from "@/lib/nilo/server";
import { checkInvoice, nifAndNumber, type InvoiceDraft } from "@/lib/nilo/invoice-checks";
import { itemKey } from "@/lib/nilo/ingest";
import { buildStatement, type Movement, type Unit } from "@/lib/nilo/ledger";

export const runtime = "nodejs";

type Handler = (s: NiloSession, req: NextRequest) => Promise<unknown>;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const must = <T,>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new HttpError(400, r.error.message);
  return r.data;
};

const approverOnly = (s: NiloSession) => {
  if (!s.isApprover) throw new HttpError(403, "Only Nilo approvers can do this");
};

const sha256 = async (f: File) => createHash("sha256").update(Buffer.from(await f.arrayBuffer())).digest("hex");

async function cutoverAt(s: NiloSession): Promise<string | null> {
  const row = must(await s.db.from("nilo_settings").select("value").eq("key", "cutover_at").maybeSingle());
  return row?.value ?? null;
}

async function pageAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = must(await q(from, from + 999)) ?? [];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

const READS: Record<string, Handler> = {
  me: async (s) => ({ email: s.email, company: s.company, isApprover: s.isApprover, cutoverAt: await cutoverAt(s) }),

  stock: async (s) =>
    pageAll((from, to) => s.db.from("nilo_stock").select("*").order("name").order("item_id").range(from, to)),

  invoices: async (s) =>
    must(
      await s.db
        .from("nilo_invoices")
        .select("*, lines:nilo_invoice_lines(*, item:nilo_items(name, kind, measure_unit))")
        .neq("origin", "legacy")
        .order("created_at", { ascending: false })
        .limit(200),
    ),

  statements: async (s) =>
    must(await s.db.from("nilo_statements").select("*").eq("company", s.company).order("period", { ascending: false })),

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
    const code = (req.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
    const unit = must(
      await s.db
        .from("nilo_units")
        .select("*, line:nilo_invoice_lines(*, item:nilo_items(name, kind, measure_unit), invoice:nilo_invoices(*))")
        .eq("code", code)
        .maybeSingle(),
    );
    if (!unit) throw new HttpError(404, `Unknown code ${code}`);
    const movements = must(await s.db.from("nilo_movements").select("*").eq("unit_id", unit.id).order("id"));
    return { unit, movements };
  },

  // Label codes to print: all units of an invoice line, or the unsold stock of an item.
  codes: async (s, req) => {
    const line = req.nextUrl.searchParams.get("line");
    const item = req.nextUrl.searchParams.get("item");
    return pageAll((from, to) => {
      const q = s.db
        .from("nilo_units")
        .select("code, line:nilo_invoice_lines!inner(item_id, item:nilo_items(name), invoice:nilo_invoices(invoice_no))")
        .order("code")
        .range(from, to);
      return line ? q.eq("line_id", line) : q.eq("line.item_id", item ?? "").in("status", ["labelled", "in_stock"]);
    });
  },

  file: async (s, req) => {
    const bucket = req.nextUrl.searchParams.get("bucket") ?? "";
    if (bucket !== "nilo-invoices" && bucket !== "nilo-payments") throw new HttpError(400, "bad bucket");
    const signed = must(await s.db.storage.from(bucket).createSignedUrl(req.nextUrl.searchParams.get("path") ?? "", 600));
    if (!signed) throw new HttpError(404, "file not found");
    return NextResponse.redirect(signed.signedUrl);
  },
};

const WRITES: Record<string, Handler> = {
  invoice: async (s, req) => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Attach the invoice file");
    const meta = JSON.parse(String(form.get("meta"))) as Omit<InvoiceDraft, "fileSha256" | "lines"> & {
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

    const draft: InvoiceDraft = { ...meta, fileSha256: await sha256(file) };
    const key = nifAndNumber(draft.supplierNif, draft.invoiceNo);
    const [nif, no] = key.split("|");
    const [dupNumber, dupFile] = await Promise.all([
      s.db.from("nilo_invoices").select("id", { count: "exact", head: true }).eq("supplier_nif", nif).eq("invoice_no", no),
      s.db.from("nilo_invoices").select("id", { count: "exact", head: true }).eq("file_sha256", draft.fileSha256),
    ]);
    const verdict = checkInvoice(
      draft,
      {
        nifAndNumber: new Set(dupNumber.count ? [key] : []),
        fileHashes: new Set(dupFile.count ? [draft.fileSha256] : []),
      },
      new Date(),
    );
    if (verdict.status === "blocked") return { status: "blocked", checks: verdict.checks };

    const path = `${s.company}/${randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    must(await s.db.storage.from("nilo-invoices").upload(path, file, { contentType: file.type }));
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
        .update({ status: "approved", approved_by: s.email, approved_at: new Date().toISOString() })
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
    return must(await s.db.rpc("nilo_receive", { p_code: code, p_user: s.email }));
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
      (await createSessionClient()).from("maintenance_records").select("created_at").eq("id", recordId).maybeSingle(),
    ]);
    // A deleted record has no row left; a record from before the cutover was settled by the import.
    if (record.data && cutover && record.data.created_at < cutover) return { skipped: "legacy record" };
    must(
      await s.db.rpc("nilo_set_record_parts", {
        p_company: s.company,
        p_record: recordId,
        p_plate: plate,
        p_user: s.email,
        p_parts: parts.map((p) => ({ item_id: p.itemId, quantity: p.quantity })),
        p_codes: codes ?? [],
      }),
    );
    return { ok: true };
  },

  statement: async (s, req) => {
    approverOnly(s);
    const { period } = (await req.json()) as { period: string };
    if (!/^\d{4}-\d{2}$/.test(period)) throw new HttpError(400, "period must be YYYY-MM");
    const [y, m] = period.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 1)).toISOString();
    type Row = {
      unit_id: string;
      type: Movement["type"];
      quantity: number;
      company: Movement["company"];
      vehicle_plate: string | null;
      created_at: string;
      unit: { code: string; line: { unit_cost: number; container_size: number | null; item: { name: string } } };
    };
    const rows = await pageAll<Row>((from, to) =>
      s.db
        .from("nilo_movements")
        .select(
          "unit_id, type, quantity, company, vehicle_plate, created_at, unit:nilo_units(code, line:nilo_invoice_lines(unit_cost, container_size, item:nilo_items(name)))",
        )
        .eq("company", s.company)
        .gte("created_at", `${period}-01T00:00:00Z`)
        .lt("created_at", end)
        .order("id")
        .range(from, to)
        .returns<Row[]>(),
    );
    const units = new Map<string, Unit>(
      rows.map((r) => [
        r.unit_id,
        {
          id: r.unit_id,
          code: r.unit.code,
          itemName: r.unit.line.item.name,
          unitCost: Number(r.unit.line.unit_cost),
          containerSize: r.unit.line.container_size === null ? null : Number(r.unit.line.container_size),
        },
      ]),
    );
    const movements: Movement[] = rows.map((r) => ({
      unitId: r.unit_id,
      type: r.type,
      quantity: Number(r.quantity),
      company: r.company,
      vehiclePlate: r.vehicle_plate,
      at: r.created_at,
    }));
    const st = buildStatement(s.company, period, [...units.values()], movements);
    return must(
      await s.db
        .from("nilo_statements")
        .insert({
          statement_no: `NILO-${s.company === "royal" ? "RE" : "IM"}-${period}`,
          company: s.company,
          period: `${period}-01`,
          lines: st,
          total: st.total,
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
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Attach the bank payment proof");
    const id = String(form.get("statementId"));
    const path = `${s.company}/${id}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    must(await s.db.storage.from("nilo-payments").upload(path, file, { contentType: file.type }));
    must(
      await s.db
        .from("nilo_statements")
        .update({
          status: "paid",
          paid_by: s.email,
          paid_at: new Date().toISOString(),
          payment_proof_path: path,
          payment_proof_sha256: await sha256(file),
        })
        .eq("id", id)
        .eq("company", s.company),
    );
    return { ok: true };
  },
};

async function run(table: Record<string, Handler>, req: NextRequest, ctx: Ctx) {
  const handler = table[(await ctx.params).action];
  if (!handler) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const s = await niloSession();
    if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const out = await handler(s, req);
    return out instanceof NextResponse ? out : NextResponse.json(out);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error("nilo:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Nilo error" }, { status });
  }
}

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ action: string }> };
export const GET = (req: NextRequest, ctx: Ctx) => run(READS, req, ctx);
export const POST = (req: NextRequest, ctx: Ctx) => run(WRITES, req, ctx);
