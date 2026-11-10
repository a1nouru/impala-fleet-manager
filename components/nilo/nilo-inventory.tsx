"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Printer, QrCode, ScanLine, ShieldCheck, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { fileUrl, kz, nilo, type NiloMe, type StockRow } from "@/lib/nilo/client";
import type { Statement as RunningStatementData } from "@/lib/nilo/ledger";

type Line = {
  id: string;
  ocr_description: string;
  quantity: number;
  unit_cost: number;
  container_size: number | null;
  labels_generated: number;
  item: { name: string; kind: string; measure_unit: string | null } | null;
};
type Invoice = {
  id: string;
  supplier: string | null;
  supplier_nif: string | null;
  invoice_no: string | null;
  invoice_date: string;
  total: number | null;
  file_path: string | null;
  status: "pending_approval" | "approved";
  checks: { level: string; reason: string }[];
  approved_by: string | null;
  uploaded_by: string;
  source_company: string;
  lines: Line[];
};
type Statement = {
  id: string;
  statement_no: string;
  period: string;
  total: number;
  status: "issued" | "paid";
  payment_proof_path: string | null;
  paid_by: string | null;
};

const fail = (e: unknown) =>
  toast({ title: "Nilo", description: e instanceof Error ? e.message : String(e), variant: "destructive" });

const qty = (n: number | string, unit?: string | null) =>
  `${Number(n).toLocaleString("pt-AO", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;

export default function NiloInventory() {
  const { t } = useTranslation("nilo");
  const [me, setMe] = useState<NiloMe | null>(null);

  useEffect(() => {
    nilo<NiloMe>("me").then(setMe, fail);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-800">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {me?.isApprover && (
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> {t("approver")}
          </Badge>
        )}
      </div>
      <Tabs defaultValue="stock">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stock">{t("tabs.stock")}</TabsTrigger>
          <TabsTrigger value="purchases">{t("tabs.purchases")}</TabsTrigger>
          <TabsTrigger value="scan">{t("tabs.scan")}</TabsTrigger>
          <TabsTrigger value="statements">{t("tabs.statements")}</TabsTrigger>
        </TabsList>
        <TabsContent value="stock">
          <StockTab />
        </TabsContent>
        <TabsContent value="purchases">
          <PurchasesTab me={me} />
        </TabsContent>
        <TabsContent value="scan">
          <ScanTab />
        </TabsContent>
        <TabsContent value="statements">
          <StatementsTab me={me} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StockTab() {
  const { t } = useTranslation("nilo");
  const [rows, setRows] = useState<StockRow[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    nilo<StockRow[]>("stock").then(setRows, fail);
  }, []);

  if (!rows) return <Loading />;
  const shown = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const value = rows.reduce((n, r) => n + Number(r.available) * Number(r.avg_cost ?? 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">
          {t("stock.value")}: {kz(value)}
        </CardTitle>
        <Input className="max-w-xs" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("stock.item")}</TableHead>
              <TableHead className="text-right">{t("stock.purchased")}</TableHead>
              <TableHead className="text-right">{t("stock.used")}</TableHead>
              <TableHead className="text-right">{t("stock.available")}</TableHead>
              <TableHead className="text-right">{t("stock.awaiting")}</TableHead>
              <TableHead className="text-right">{t("stock.avgCost")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.item_id} className={Number(r.available) <= 0 ? "text-muted-foreground" : ""}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(r.purchased, r.measure_unit)}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(r.used, r.measure_unit)}</TableCell>
                <TableCell
                  className={`text-right tabular-nums font-semibold ${Number(r.available) > 0 ? "text-green-700" : "text-muted-foreground"}`}
                >
                  {qty(r.available, r.measure_unit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(r.awaiting_receipt) > 0 ? qty(r.awaiting_receipt, r.measure_unit) : ""}
                </TableCell>
                <TableCell className="text-right tabular-nums">{kz(r.avg_cost ?? r.last_known_cost)}</TableCell>
                <TableCell className="text-right">
                  {Number(r.available) + Number(r.awaiting_receipt) > 0 && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/nilo/labels?item=${r.item_id}`} target="_blank" rel="noreferrer">
                        <Printer className="h-4 w-4" />
                        <span className="sr-only">{t("printLabels")}</span>
                      </a>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PurchasesTab({ me }: { me: NiloMe | null }) {
  const { t } = useTranslation("nilo");
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => nilo<Invoice[]>("invoices").then(setInvoices, fail), []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const printLabels = (line: Line) =>
    act(line.id, async () => {
      await nilo("labels", { json: { lineId: line.id } });
      window.open(`/nilo/labels?line=${line.id}`, "_blank");
    });

  if (!invoices) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <Upload className="h-4 w-4 mr-2" /> {t("purchases.add")}
        </Button>
      </div>
      {invoices.length === 0 && <p className="text-sm text-muted-foreground">{t("purchases.empty")}</p>}
      {invoices.map((inv) => (
        <Card key={inv.id}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">
                {inv.supplier || "—"} · {inv.invoice_no}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {inv.invoice_date} · NIF {inv.supplier_nif} · {kz(inv.total)} · {inv.uploaded_by}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {inv.file_path && (
                <a className="text-xs underline" href={fileUrl("nilo-invoices", inv.file_path)} target="_blank" rel="noreferrer">
                  {t("purchases.file")}
                </a>
              )}
              <Badge variant={inv.status === "approved" ? "secondary" : "destructive"}>{t(`status.${inv.status}`)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {inv.status === "pending_approval" && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                <ul className="list-disc pl-5">
                  {inv.checks.map((c) => (
                    <li key={c.reason}>{c.reason}</li>
                  ))}
                </ul>
                {me?.isApprover ? (
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={busy === inv.id}
                    onClick={() => act(inv.id, () => nilo("approve", { json: { invoiceId: inv.id } }))}
                  >
                    {t("purchases.approve")}
                  </Button>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{t("purchases.waitingApprover")}</p>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stock.item")}</TableHead>
                    <TableHead className="text-right">{t("purchases.qty")}</TableHead>
                    <TableHead className="text-right">{t("purchases.unitCost")}</TableHead>
                    <TableHead className="text-right">{t("purchases.labels")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.item?.name}</div>
                        {l.ocr_description && <div className="text-xs text-muted-foreground">{l.ocr_description}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {qty(l.quantity)}
                        {l.container_size ? ` × ${qty(l.container_size, l.item?.measure_unit)}` : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{kz(l.unit_cost)}</TableCell>
                      <TableCell className="text-right">
                        {inv.status === "approved" && (
                          <Button size="sm" variant="outline" disabled={busy === l.id} onClick={() => printLabels(l)}>
                            <QrCode className="h-4 w-4 mr-1" />
                            {l.labels_generated > 0 ? t("purchases.reprint") : t("printLabels")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
      {adding && (
        <NewPurchaseDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

type DraftLine = {
  description: string;
  itemName: string;
  kind: "unit" | "bulk";
  measureUnit: string;
  containerSize: string;
  quantity: string;
  unitCost: string;
};

const emptyLine = (): DraftLine => ({
  description: "",
  itemName: "",
  kind: "unit",
  measureUnit: "L",
  containerSize: "",
  quantity: "1",
  unitCost: "",
});

function NewPurchaseDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation("nilo");
  const [file, setFile] = useState<File | null>(null);
  const [head, setHead] = useState({ supplier: "", supplierNif: "", invoiceNo: "", invoiceDate: "", total: "" });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [ocr, setOcr] = useState<{ raw: unknown; numbers: string } | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [blocked, setBlocked] = useState<string[] | null>(null);

  useEffect(() => {
    nilo<StockRow[]>("stock").then((r) => setNames(r.map((x) => x.name)), fail);
  }, []);

  const numbers = (ls: DraftLine[]) => ls.map((l) => `${l.quantity}|${l.unitCost}`).join(",");

  const read = async () => {
    if (!file) return;
    setBusy("read");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/invoice-ocr", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error);
      const read: DraftLine[] = data.items.map(
        (i: { item_name: string; description: string; quantity: number; amount_unit: number }) => ({
          ...emptyLine(),
          description: i.description,
          itemName: i.item_name,
          quantity: String(i.quantity),
          unitCost: String(i.amount_unit),
        }),
      );
      setLines(read);
      setHead((h) => ({
        ...h,
        invoiceDate: data.invoice_date ?? h.invoiceDate,
        total: String(read.reduce((n, l) => n + Number(l.quantity) * Number(l.unitCost), 0)),
      }));
      setOcr({ raw: data.raw_extraction, numbers: numbers(read) });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!file) return fail(new Error(t("purchases.needFile")));
    setBusy("save");
    setBlocked(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append(
        "meta",
        JSON.stringify({
          supplier: head.supplier,
          supplierNif: head.supplierNif,
          invoiceNo: head.invoiceNo,
          invoiceDate: head.invoiceDate,
          total: Number(head.total),
          editedByHand: ocr !== null && ocr.numbers !== numbers(lines),
          ocrRaw: ocr?.raw ?? null,
          lines: lines.map((l) => ({
            description: l.description,
            itemName: l.itemName,
            kind: l.kind,
            measureUnit: l.measureUnit,
            containerSize: l.kind === "bulk" ? Number(l.containerSize) : null,
            quantity: Number(l.quantity),
            unitCost: Number(l.unitCost),
          })),
        }),
      );
      const out = await nilo<{ status: string; checks: { reason: string }[] }>("invoice", { method: "POST", body });
      if (out.status === "blocked") return setBlocked(out.checks.map((c) => c.reason));
      toast({
        title: t(`status.${out.status}`),
        description: out.status === "approved" ? t("purchases.savedClean") : t("purchases.savedFlagged"),
      });
      onSaved();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const ready =
    file &&
    head.supplierNif &&
    head.invoiceNo &&
    head.invoiceDate &&
    head.total &&
    lines.every(
      (l) => l.itemName.trim() && Number(l.quantity) > 0 && l.unitCost !== "" && (l.kind === "unit" || Number(l.containerSize) > 0),
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("purchases.add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grow">
              <Label>{t("purchases.file")}</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button variant="outline" disabled={!file || busy !== null} onClick={read}>
              {busy === "read" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t("purchases.read")}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(["supplier", "supplierNif", "invoiceNo", "invoiceDate", "total"] as const).map((k) => (
              <div key={k}>
                <Label>{t(`purchases.${k}`)}</Label>
                <Input
                  type={k === "invoiceDate" ? "date" : k === "total" ? "number" : "text"}
                  value={head[k]}
                  onChange={(e) => setHead({ ...head, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <datalist id="nilo-items">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-6">
                <div className="col-span-2">
                  <Label className="text-xs">{t("stock.item")}</Label>
                  <Input list="nilo-items" value={l.itemName} onChange={(e) => setLine(i, { itemName: e.target.value })} />
                  {l.description && <p className="mt-1 truncate text-xs text-muted-foreground">{l.description}</p>}
                </div>
                <div>
                  <Label className="text-xs">{t("purchases.kind")}</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={l.kind}
                    onChange={(e) => setLine(i, { kind: e.target.value as DraftLine["kind"] })}
                  >
                    <option value="unit">{t("purchases.unit")}</option>
                    <option value="bulk">{t("purchases.bulk")}</option>
                  </select>
                </div>
                {l.kind === "bulk" ? (
                  <div className="flex gap-1">
                    <div className="grow">
                      <Label className="text-xs">{t("purchases.containerSize")}</Label>
                      <Input type="number" value={l.containerSize} onChange={(e) => setLine(i, { containerSize: e.target.value })} />
                    </div>
                    <div className="w-14">
                      <Label className="text-xs">{t("purchases.measure")}</Label>
                      <Input value={l.measureUnit} onChange={(e) => setLine(i, { measureUnit: e.target.value })} />
                    </div>
                  </div>
                ) : (
                  <div />
                )}
                <div>
                  <Label className="text-xs">{l.kind === "bulk" ? t("purchases.containers") : t("purchases.qty")}</Label>
                  <Input type="number" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{t("purchases.unitCost")}</Label>
                  <Input type="number" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
                + {t("purchases.addLine")}
              </Button>
              {lines.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setLines(lines.slice(0, -1))}>
                  − {t("purchases.removeLine")}
                </Button>
              )}
            </div>
          </div>
          {blocked && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">{t("purchases.blocked")}</p>
              <ul className="list-disc pl-5">
                {blocked.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={!ready || busy !== null} onClick={save}>
            {busy === "save" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t("purchases.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Trace = {
  unit: {
    code: string;
    status: string;
    remaining: number;
    line: {
      unit_cost: number;
      container_size: number | null;
      item: { name: string; measure_unit: string | null };
      invoice: { supplier: string | null; invoice_no: string | null; invoice_date: string; origin: string };
    };
  };
  movements: {
    id: number;
    type: string;
    quantity: number;
    company: string | null;
    vehicle_plate: string | null;
    user_email: string;
    created_at: string;
  }[];
};

function ScanTab() {
  const { t } = useTranslation("nilo");
  const [mode, setMode] = useState<"receive" | "trace">("receive");
  const [code, setCode] = useState("");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [log, setLog] = useState<{ code: string; ok: boolean; text: string }[]>([]);
  const [camera, setCamera] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setCode("");
    try {
      if (mode === "receive") {
        await nilo("receive", { json: { code: c } });
        setLog((l) => [{ code: c, ok: true, text: t("scan.received") }, ...l]);
      } else {
        setTrace(await nilo<Trace>(`trace?code=${encodeURIComponent(c)}`));
      }
    } catch (e) {
      setLog((l) => [{ code: c, ok: false, text: e instanceof Error ? e.message : String(e) }, ...l]);
    }
    input.current?.focus();
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap gap-2">
          <Button variant={mode === "receive" ? "default" : "outline"} onClick={() => setMode("receive")}>
            {t("scan.receive")}
          </Button>
          <Button variant={mode === "trace" ? "default" : "outline"} onClick={() => setMode("trace")}>
            {t("scan.trace")}
          </Button>
          <Button variant="outline" onClick={() => setCamera((c) => !c)}>
            <ScanLine className="h-4 w-4 mr-2" /> {t("scan.camera")}
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(code);
          }}
        >
          <Input
            ref={input}
            autoFocus
            placeholder="NILO-000123"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono text-lg"
          />
        </form>
        <p className="text-xs text-muted-foreground">{t("scan.hint")}</p>
        {camera && <CameraScanner onCode={(c) => submit(c)} />}
        {mode === "receive" && log.length > 0 && (
          <ul className="space-y-1 text-sm">
            {log.map((l, i) => (
              <li key={i} className={l.ok ? "text-green-700" : "text-red-700"}>
                <span className="font-mono">{l.code}</span> · {l.text}
              </li>
            ))}
          </ul>
        )}
        {mode === "trace" && trace && (
          <div className="space-y-2 text-sm">
            <p className="font-mono text-base font-semibold">
              {trace.unit.code} · {trace.unit.line.item.name}
            </p>
            <p className="text-muted-foreground">
              {t("scan.bought")}: {trace.unit.line.invoice.invoice_date} · {trace.unit.line.invoice.supplier ?? "—"}{" "}
              {trace.unit.line.invoice.invoice_no ?? ""} · {kz(trace.unit.line.unit_cost)} · {t(`unitStatus.${trace.unit.status}`)} ·{" "}
              {t("scan.left")} {qty(trace.unit.remaining, trace.unit.line.item.measure_unit)}
            </p>
            <Table>
              <TableBody>
                {trace.movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.created_at).toLocaleString("pt-AO")}</TableCell>
                    <TableCell>{t(`movement.${m.company && m.type === "receive" ? "return" : m.type}`)}</TableCell>
                    <TableCell className="tabular-nums">{qty(m.quantity)}</TableCell>
                    <TableCell>{m.company ? `${m.company === "royal" ? "Royal Express" : "Impala"} · ${m.vehicle_plate}` : ""}</TableCell>
                    <TableCell className="text-muted-foreground">{m.user_email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

// Camera scanning via the browser's BarcodeDetector (Chrome/Android). Other browsers use a
// USB scanner or typing; the hint says so.
function CameraScanner({ onCode }: { onCode: (code: string) => void }) {
  const { t } = useTranslation("nilo");
  const video = useRef<HTMLVideoElement>(null);
  const [unsupported, setUnsupported] = useState(false);
  const handler = useRef(onCode);
  handler.current = onCode;

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Ctor) {
      setUnsupported(true);
      return;
    }
    const detector = new Ctor({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let last = "";
    let stop = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (!video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        while (!stop) {
          const [hit] = await detector.detect(video.current).catch(() => []);
          if (hit && hit.rawValue !== last) {
            last = hit.rawValue;
            handler.current(hit.rawValue);
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      })
      .catch(() => setUnsupported(true));
    return () => {
      stop = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  if (unsupported) return <p className="text-sm text-amber-700">{t("scan.noCamera")}</p>;
  return <video ref={video} className="w-full max-w-sm rounded-md border" muted playsInline />;
}

function StatementsTab({ me }: { me: NiloMe | null }) {
  const { t } = useTranslation("nilo");
  const [rows, setRows] = useState<Statement[] | null>(null);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => nilo<Statement[]>("statements").then(setRows, fail), []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const markPaid = (s: Statement, file: File) =>
    run(s.id, () => {
      const body = new FormData();
      body.append("statementId", s.id);
      body.append("file", file);
      return nilo("paid", { method: "POST", body });
    });

  if (!rows) return <Loading />;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {me?.isApprover && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>{t("statements.month")}</Label>
              <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <Button disabled={busy === "issue"} onClick={() => run("issue", () => nilo("statement", { json: { period } }))}>
              {t("statements.issue")}
            </Button>
          </div>
        )}
        <RunningStatement />
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("statements.empty")}</p>}
        <Table>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono">{s.statement_no}</TableCell>
                <TableCell>{s.period.slice(0, 7)}</TableCell>
                <TableCell className="text-right tabular-nums">{kz(s.total)}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "paid" ? "secondary" : "outline"}>{t(`statements.${s.status}`)}</Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <a className="text-sm underline" href={`/nilo/statement?id=${s.id}`} target="_blank" rel="noreferrer">
                    {t("statements.open")}
                  </a>
                  {s.payment_proof_path && (
                    <a className="text-sm underline" href={fileUrl("nilo-payments", s.payment_proof_path)} target="_blank" rel="noreferrer">
                      {t("statements.proof")}
                    </a>
                  )}
                  {s.status === "issued" && me?.isApprover && (
                    <label className="cursor-pointer text-sm underline">
                      {busy === s.id ? <Loader2 className="inline h-4 w-4 animate-spin" /> : t("statements.markPaid")}
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && markPaid(s, e.target.files[0])}
                      />
                    </label>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// This month so far: the live statement for this app's company, before anything is issued.
function RunningStatement() {
  const { t } = useTranslation("nilo");
  const [st, setSt] = useState<RunningStatementData | null>(null);

  useEffect(() => {
    nilo<RunningStatementData>("running").then(setSt, fail);
  }, []);

  if (!st) return <Loading />;
  const month = new Date(`${st.period}-01T00:00:00Z`).toLocaleDateString("pt-AO", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            {t("statements.running")} · {month}
          </h3>
          <p className="text-xs text-muted-foreground">{t("statements.runningHint")}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{t("statements.soFar")}</div>
          <div className="text-xl font-semibold tabular-nums">{kz(st.total)}</div>
        </div>
      </div>
      {st.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("statements.nothingYet")}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("statements.vehicle")}</TableHead>
                <TableHead className="text-right">{t("statements.parts")}</TableHead>
                <TableHead className="text-right">{t("statements.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {st.byVehicle.map((v) => (
                <TableRow key={v.vehiclePlate}>
                  <TableCell className="font-mono">{v.vehiclePlate || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.parts}</TableCell>
                  <TableCell className="text-right tabular-nums">{kz(v.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <details>
            <summary className="cursor-pointer text-sm underline">
              {t("statements.detail")} ({st.lines.length})
            </summary>
            <div className="overflow-x-auto">
              <Table>
                <TableBody>
                  {st.lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{l.at.slice(0, 10)}</TableCell>
                      <TableCell className="font-mono">{l.vehiclePlate}</TableCell>
                      <TableCell>{l.itemName}</TableCell>
                      <TableCell className="text-right tabular-nums">{qty(l.quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">{kz(l.unitPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">{kz(l.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
