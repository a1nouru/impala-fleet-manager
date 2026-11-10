"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Loader2, Plus, RotateCw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { nilo, PAGE_TYPES, type StockRow } from "@/lib/nilo/client";
import type { OcrInvoice } from "@/lib/nilo/invoice-ocr";
import { fail, tap } from "./ui";

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

// Phone photos run 4-12 MB and the reader takes 5 MB per image, so large or unusual photos are
// re-encoded as JPEG at most 2400 px on the long side, which keeps print legible.
async function shrink(f: File): Promise<File> {
  if (!f.type.startsWith("image/")) return f;
  if (f.size <= 3_000_000 && PAGE_TYPES.includes(f.type)) return f;
  try {
    const img = await createImageBitmap(f);
    const scale = Math.min(1, 2400 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], `${f.name.replace(/\.\w+$/, "")}.jpg`, { type: "image/jpeg" }) : f;
  } catch {
    return f; // a format this browser cannot decode; the server says which types it takes
  }
}

export default function NewPurchaseDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation("nilo");
  const [pages, setPages] = useState<File[]>([]);
  const [head, setHead] = useState({ supplier: "", supplierNif: "", invoiceNo: "", invoiceDate: "", total: "" });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [ocr, setOcr] = useState<{ raw: OcrInvoice; numbers: string } | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const readSeq = useRef(0);

  useEffect(() => {
    nilo<StockRow[]>("stock").then((r) => setNames(r.map((x) => x.name)), fail);
  }, []);

  // The numbers OCR read; saving with different ones flags the invoice as edited by hand.
  const numbers = (ls: DraftLine[], total: string) => [total, ...ls.map((l) => `${l.quantity}|${l.unitCost}`)].join(",");

  // Reads every page together. Only the newest read applies, so adding pages quickly is safe.
  const read = async (files: File[]) => {
    const seq = ++readSeq.current;
    setReading(true);
    try {
      const body = new FormData();
      files.forEach((f) => body.append("files", f));
      const r = await nilo<OcrInvoice>("ocr", { method: "POST", body });
      if (seq !== readSeq.current) return;
      const drafts: DraftLine[] = r.lines.map((l) => ({
        ...emptyLine(),
        description: l.description,
        itemName: l.item_name,
        quantity: String(l.quantity),
        unitCost: String(l.unit_cost),
      }));
      const total = String(r.total ?? drafts.reduce((n, l) => n + Number(l.quantity) * Number(l.unitCost), 0));
      setLines(drafts.length ? drafts : [emptyLine()]);
      setHead((h) => ({
        supplier: r.supplier ?? h.supplier,
        supplierNif: r.supplier_nif ?? h.supplierNif,
        invoiceNo: r.invoice_no ?? h.invoiceNo,
        invoiceDate: r.invoice_date ?? h.invoiceDate,
        total,
      }));
      setOcr({ raw: r, numbers: numbers(drafts, total) });
    } catch (e) {
      if (seq === readSeq.current) fail(e);
    } finally {
      if (seq === readSeq.current) setReading(false);
    }
  };

  const setAndRead = (next: File[]) => {
    setPages(next);
    setBlocked(null);
    if (next.length) return read(next);
    readSeq.current++;
    setReading(false);
  };

  const addPages = async (list: FileList | null) => {
    if (list?.length) setAndRead([...pages, ...(await Promise.all([...list].map(shrink)))]);
  };

  const save = async () => {
    if (!pages.length) return fail(new Error(t("purchases.needFile")));
    setSaving(true);
    setBlocked(null);
    try {
      const body = new FormData();
      pages.forEach((f) => body.append("files", f));
      body.append(
        "meta",
        JSON.stringify({
          supplier: head.supplier,
          supplierNif: head.supplierNif,
          invoiceNo: head.invoiceNo,
          invoiceDate: head.invoiceDate,
          total: Number(head.total),
          editedByHand: ocr !== null && ocr.numbers !== numbers(lines, head.total),
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
      setSaving(false);
    }
  };

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const ready =
    pages.length > 0 &&
    head.supplierNif &&
    head.invoiceNo &&
    head.invoiceDate &&
    head.total &&
    lines.every(
      (l) => l.itemName.trim() && Number(l.quantity) > 0 && l.unitCost !== "" && (l.kind === "unit" || Number(l.containerSize) > 0),
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* A tap outside must not throw away a read invoice; the last-child rule gives the shared
          close button a 44px hit area. */}
      <DialogContent
        className="gap-4 pb-0 sm:max-w-3xl sm:pb-0 [&>button:last-child]:top-1 [&>button:last-child]:right-1 [&>button:last-child]:flex [&>button:last-child]:size-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("purchases.add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <section className="space-y-2">
            <Label>{t("purchases.photos")}</Label>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button asChild variant="outline" className={`${tap} cursor-pointer`}>
                <label>
                  <Camera className="h-4 w-4" /> {t("purchases.takePhoto")}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => {
                      addPages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
              <Button asChild variant="outline" className={`${tap} cursor-pointer`}>
                <label>
                  <Upload className="h-4 w-4" /> {t("purchases.pickFile")}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      addPages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
            </div>
            {pages.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {pages.map((f, i) => (
                  <li key={`${i}-${f.name}-${f.size}`} className="relative size-24 overflow-hidden rounded-md border bg-muted">
                    <PageThumb file={f} />
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
                    <button
                      type="button"
                      aria-label={`${t("purchases.removePage")} ${i + 1}`}
                      className="absolute right-0 top-0 flex size-11 items-start justify-end p-1"
                      onClick={() => setAndRead(pages.filter((_, j) => j !== i))}
                    >
                      <span className="rounded-full bg-black/60 p-1 text-white">
                        <X className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {reading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("purchases.reading")}
              </p>
            ) : (
              pages.length > 0 && (
                <Button variant="ghost" size="sm" className="max-sm:h-11" onClick={() => read(pages)}>
                  <RotateCw className="h-4 w-4" /> {t("purchases.readAgain")}
                </Button>
              )
            )}
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["supplier", "supplierNif", "invoiceNo", "invoiceDate", "total"] as const).map((k) => (
              <div key={k} className={`space-y-1.5 ${k === "supplier" ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={`nilo-${k}`}>{t(`purchases.${k}`)}</Label>
                <Input
                  id={`nilo-${k}`}
                  className={tap}
                  type={k === "invoiceDate" ? "date" : k === "total" ? "number" : "text"}
                  inputMode={k === "total" ? "decimal" : undefined}
                  value={head[k]}
                  onChange={(e) => setHead({ ...head, [k]: e.target.value })}
                />
              </div>
            ))}
          </section>

          <datalist id="nilo-items">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <section className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-4">
                <div className="col-span-2 space-y-1.5 sm:col-span-3">
                  <div className="flex min-h-5 items-center justify-between">
                    <Label htmlFor={`nilo-line-${i}`}>{t("stock.item")}</Label>
                    {lines.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-my-3 -mr-2 size-11 shrink-0 sm:-my-2 sm:size-9"
                        aria-label={`${t("purchases.removeLine")} ${i + 1}`}
                        onClick={() => setLines(lines.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    id={`nilo-line-${i}`}
                    className={tap}
                    list="nilo-items"
                    value={l.itemName}
                    onChange={(e) => setLine(i, { itemName: e.target.value })}
                  />
                  {l.description && <p className="text-xs text-muted-foreground break-words">{l.description}</p>}
                </div>
                <div className="col-span-2 space-y-1.5 sm:col-span-1">
                  <Label>{t("purchases.kind")}</Label>
                  <select
                    className={`${tap} w-full rounded-md border bg-background px-2 text-base sm:text-sm`}
                    value={l.kind}
                    onChange={(e) => setLine(i, { kind: e.target.value as DraftLine["kind"] })}
                  >
                    <option value="unit">{t("purchases.unit")}</option>
                    <option value="bulk">{t("purchases.bulk")}</option>
                  </select>
                </div>
                {l.kind === "bulk" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>{t("purchases.containerSize")}</Label>
                      <Input
                        className={tap}
                        type="number"
                        inputMode="decimal"
                        value={l.containerSize}
                        onChange={(e) => setLine(i, { containerSize: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("purchases.measure")}</Label>
                      <Input className={tap} value={l.measureUnit} onChange={(e) => setLine(i, { measureUnit: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label>{l.kind === "bulk" ? t("purchases.containers") : t("purchases.qty")}</Label>
                  <Input
                    className={tap}
                    type="number"
                    inputMode="decimal"
                    value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("purchases.unitCost")}</Label>
                  <Input
                    className={tap}
                    type="number"
                    inputMode="decimal"
                    value={l.unitCost}
                    onChange={(e) => setLine(i, { unitCost: e.target.value })}
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" className={`${tap} w-full sm:w-auto`} onClick={() => setLines([...lines, emptyLine()])}>
              <Plus className="h-4 w-4" /> {t("purchases.addLine")}
            </Button>
          </section>
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
        <DialogFooter className="sticky bottom-0 -mx-4 border-t bg-background p-4 sm:-mx-6 sm:px-6">
          <Button variant="outline" className={tap} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button className={tap} disabled={!ready || reading || saving} onClick={save}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {t("purchases.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not an optimisable asset
    <img src={url} alt={file.name} className="size-full object-cover" />
  ) : (
    <div className="flex size-full flex-col items-center justify-center gap-1 p-1 text-center">
      <FileText className="h-6 w-6 text-muted-foreground" />
      <span className="line-clamp-2 break-all text-[10px] leading-tight">{file.name}</span>
    </div>
  );
}
