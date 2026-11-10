"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Printer, QrCode, ScanLine, ShieldCheck, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/hooks/useTranslation";
import type { StatementDoc } from "@/lib/nilo/statement-doc";
import { StatementDocument } from "@/components/nilo/statement-document";
import { fileUrl, kz, nilo, type NiloMe, type StockRow } from "@/lib/nilo/client";
import NewPurchaseDialog from "./new-purchase-dialog";
import { fail, link, qty, stack, tap } from "./ui";

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
        <TabsList className="grid h-auto w-full grid-cols-4">
          {(["stock", "purchases", "scan", "statements"] as const).map((k) => (
            <TabsTrigger key={k} value={k} className="min-h-11 whitespace-normal px-1 text-xs leading-tight sm:min-h-0 sm:text-sm">
              {t(`tabs.${k}`)}
            </TabsTrigger>
          ))}
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
      <CardHeader className="flex flex-col gap-3 space-y-0 px-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
        <CardTitle className="text-base">
          {t("stock.value")}: {kz(value)}
        </CardTitle>
        <Input className={`${tap} w-full sm:max-w-xs`} placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <Table className={stack.table}>
          <TableHeader className={stack.head}>
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
          <TableBody className={stack.table}>
            {shown.map((r) => (
              <TableRow key={r.item_id} className={`${stack.row} ${Number(r.available) <= 0 ? "text-muted-foreground" : ""}`}>
                <TableCell className={`font-medium ${stack.title}`}>{r.name}</TableCell>
                <TableCell data-label={t("stock.purchased")} className={`text-right tabular-nums ${stack.cell}`}>
                  {qty(r.purchased, r.measure_unit)}
                </TableCell>
                <TableCell data-label={t("stock.used")} className={`text-right tabular-nums ${stack.cell}`}>
                  {qty(r.used, r.measure_unit)}
                </TableCell>
                <TableCell
                  data-label={t("stock.available")}
                  className={`text-right tabular-nums font-semibold ${Number(r.available) > 0 ? "text-green-700" : "text-muted-foreground"} ${stack.cell}`}
                >
                  {qty(r.available, r.measure_unit)}
                </TableCell>
                <TableCell data-label={t("stock.awaiting")} className={`text-right tabular-nums ${stack.cell}`}>
                  {Number(r.awaiting_receipt) > 0 ? qty(r.awaiting_receipt, r.measure_unit) : null}
                </TableCell>
                <TableCell data-label={t("stock.avgCost")} className={`text-right tabular-nums ${stack.cell}`}>
                  {kz(r.avg_cost ?? r.last_known_cost)}
                </TableCell>
                <TableCell className={`text-right ${stack.action}`}>
                  {Number(r.available) + Number(r.awaiting_receipt) > 0 ? (
                    <Button variant="ghost" size="sm" className="max-sm:h-11 max-sm:w-full max-sm:border" asChild>
                      <a href={`/nilo/labels?item=${r.item_id}`} target="_blank" rel="noreferrer">
                        <Printer className="h-4 w-4" />
                        <span className="sm:sr-only">{t("printLabels")}</span>
                      </a>
                    </Button>
                  ) : null}
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
        <Button className={`${tap} w-full sm:w-auto`} onClick={() => setAdding(true)}>
          <Upload className="h-4 w-4" /> {t("purchases.add")}
        </Button>
      </div>
      {invoices.length === 0 && <p className="text-sm text-muted-foreground">{t("purchases.empty")}</p>}
      {invoices.map((inv) => (
        <Card key={inv.id}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 px-4 pb-2 sm:px-6">
            <div className="min-w-0">
              <CardTitle className="text-base break-words">
                {inv.supplier || "—"} · {inv.invoice_no}
              </CardTitle>
              <p className="text-xs text-muted-foreground break-words">
                {inv.invoice_date} · NIF {inv.supplier_nif} · {kz(inv.total)} · {inv.uploaded_by}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {inv.file_path && (
                <a className={link} href={fileUrl("nilo-invoices", inv.file_path)} target="_blank" rel="noreferrer">
                  {t("purchases.file")}
                </a>
              )}
              <Badge variant={inv.status === "approved" ? "secondary" : "destructive"}>{t(`status.${inv.status}`)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-4 sm:px-6">
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
                    className="mt-2 max-sm:h-11 max-sm:w-full"
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
            <Table className={stack.table}>
              <TableHeader className={stack.head}>
                <TableRow>
                  <TableHead>{t("stock.item")}</TableHead>
                  <TableHead className="text-right">{t("purchases.qty")}</TableHead>
                  <TableHead className="text-right">{t("purchases.unitCost")}</TableHead>
                  <TableHead className="text-right">{t("purchases.labels")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={stack.table}>
                {inv.lines.map((l) => (
                  <TableRow key={l.id} className={stack.row}>
                    <TableCell className={stack.title}>
                      <div className="font-medium">{l.item?.name}</div>
                      {l.ocr_description && <div className="text-xs text-muted-foreground">{l.ocr_description}</div>}
                    </TableCell>
                    <TableCell data-label={t("purchases.qty")} className={`text-right tabular-nums ${stack.cell}`}>
                      {qty(l.quantity)}
                      {l.container_size ? ` × ${qty(l.container_size, l.item?.measure_unit)}` : ""}
                    </TableCell>
                    <TableCell data-label={t("purchases.unitCost")} className={`text-right tabular-nums ${stack.cell}`}>
                      {kz(l.unit_cost)}
                    </TableCell>
                    <TableCell className={`text-right ${stack.action}`}>
                      {inv.status === "approved" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="max-sm:h-11 max-sm:w-full"
                          disabled={busy === l.id}
                          onClick={() => printLabels(l)}
                        >
                          <QrCode className="h-4 w-4" />
                          {l.labels_generated > 0 ? t("purchases.reprint") : t("printLabels")}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
      <CardContent className="space-y-4 px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            variant={mode === "receive" ? "default" : "outline"}
            className={`${tap} h-auto min-h-11 whitespace-normal sm:min-h-9`}
            onClick={() => setMode("receive")}
          >
            {t("scan.receive")}
          </Button>
          <Button
            variant={mode === "trace" ? "default" : "outline"}
            className={`${tap} h-auto min-h-11 whitespace-normal sm:min-h-9`}
            onClick={() => setMode("trace")}
          >
            {t("scan.trace")}
          </Button>
          <Button variant="outline" className={`${tap} col-span-2`} onClick={() => setCamera((c) => !c)}>
            <ScanLine className="h-4 w-4" /> {t("scan.camera")}
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
            className="h-12 font-mono text-lg"
          />
        </form>
        <p className="text-xs text-muted-foreground">{t("scan.hint")}</p>
        {camera && <CameraScanner onCode={(c) => submit(c)} />}
        {mode === "receive" && log.length > 0 && (
          <ul className="space-y-1 text-sm">
            {log.map((l, i) => (
              <li key={i} className={`break-words ${l.ok ? "text-green-700" : "text-red-700"}`}>
                <span className="font-mono">{l.code}</span> · {l.text}
              </li>
            ))}
          </ul>
        )}
        {mode === "trace" && trace && (
          <div className="space-y-2 text-sm">
            <p className="font-mono text-base font-semibold break-words">
              {trace.unit.code} · {trace.unit.line.item.name}
            </p>
            <p className="text-muted-foreground break-words">
              {t("scan.bought")}: {trace.unit.line.invoice.invoice_date} · {trace.unit.line.invoice.supplier ?? "—"}{" "}
              {trace.unit.line.invoice.invoice_no ?? ""} · {kz(trace.unit.line.unit_cost)} · {t(`unitStatus.${trace.unit.status}`)} ·{" "}
              {t("scan.left")} {qty(trace.unit.remaining, trace.unit.line.item.measure_unit)}
            </p>
            <Table className={stack.table}>
              <TableBody className={stack.table}>
                {trace.movements.map((m) => (
                  <TableRow key={m.id} className={stack.row}>
                    <TableCell className={`font-medium sm:font-normal ${stack.title}`}>
                      {t(`movement.${m.company && m.type === "receive" ? "return" : m.type}`)}
                    </TableCell>
                    <TableCell data-label={t("scan.date")} className={stack.cell}>
                      {new Date(m.created_at).toLocaleString("pt-AO")}
                    </TableCell>
                    <TableCell data-label={t("purchases.qty")} className={`tabular-nums ${stack.cell}`}>
                      {qty(m.quantity)}
                    </TableCell>
                    <TableCell data-label={t("statements.vehicle")} className={stack.cell}>
                      {m.company ? `${m.company === "royal" ? "Royal Express" : "Impala"} · ${m.vehicle_plate}` : null}
                    </TableCell>
                    <TableCell data-label={t("scan.user")} className={`text-muted-foreground ${stack.cell} max-sm:break-all`}>
                      {m.user_email}
                    </TableCell>
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
      <CardContent className="space-y-4 px-4 sm:px-6">
        {me?.isApprover && (
          <div className="grid gap-2 sm:flex sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="nilo-period">{t("statements.month")}</Label>
              <Input id="nilo-period" className={tap} type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <Button className={tap} disabled={busy === "issue"} onClick={() => run("issue", () => nilo("statement", { json: { period } }))}>
              {t("statements.issue")}
            </Button>
          </div>
        )}
        <RunningStatement />
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("statements.empty")}</p>}
        <Table className={stack.table}>
          <TableBody className={stack.table}>
            {rows.map((s) => (
              <TableRow key={s.id} className={stack.row}>
                <TableCell className={`font-mono ${stack.title}`}>{s.statement_no}</TableCell>
                <TableCell data-label={t("statements.month")} className={stack.cell}>
                  {s.period.slice(0, 7)}
                </TableCell>
                <TableCell data-label={t("statements.amount")} className={`text-right tabular-nums ${stack.cell}`}>
                  {kz(s.total)}
                </TableCell>
                <TableCell className={stack.cell}>
                  <Badge variant={s.status === "paid" ? "secondary" : "outline"}>{t(`statements.${s.status}`)}</Badge>
                </TableCell>
                <TableCell className="text-right max-sm:px-0 max-sm:py-1">
                  <div className="flex flex-wrap justify-end gap-x-4 max-sm:justify-start">
                    <a className={link} href={`/nilo/statement?id=${s.id}`} target="_blank" rel="noreferrer">
                      {t("statements.open")}
                    </a>
                    {s.payment_proof_path && (
                      <a className={link} href={fileUrl("nilo-payments", s.payment_proof_path)} target="_blank" rel="noreferrer">
                        {t("statements.proof")}
                      </a>
                    )}
                    {s.status === "issued" && me?.isApprover && (
                      <label className={`${link} cursor-pointer`}>
                        {busy === s.id ? <Loader2 className="inline h-4 w-4 animate-spin" /> : t("statements.markPaid")}
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="sr-only"
                          onChange={(e) => e.target.files?.[0] && markPaid(s, e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
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
  const [doc, setDoc] = useState<StatementDoc | null>(null);

  useEffect(() => {
    nilo<StatementDoc>("running").then(setDoc, fail);
  }, []);

  if (!doc) return <Loading />;

  return (
    <div className="space-y-3 rounded-md border p-3 sm:p-6">
      <div className="flex justify-end print:hidden">
        <a className={link} href="/nilo/statement?running" target="_blank" rel="noreferrer">
          {t("doc.print")}
        </a>
      </div>
      <StatementDocument doc={doc} />
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
