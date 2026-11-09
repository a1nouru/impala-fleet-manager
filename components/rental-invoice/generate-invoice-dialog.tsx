"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { COMPANY } from "@/lib/rental-invoice/company";
import { DEFAULT_LINE_DESCRIPTION, computeTotals, formatKz, seriesFor } from "@/lib/rental-invoice/format";
import { rentalInvoiceService } from "@/services/rentalInvoiceService";

type Line = { code: string; description: string; qty: string; unit_price: string };
const blankLine = (): Line => ({ code: "", description: DEFAULT_LINE_DESCRIPTION, qty: "1", unit_price: "" });
/** Kwanza amounts are typed with dot thousands ("2.850.000"); quantities with a decimal comma or dot ("1,5"). */
const parseKz = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
const parseQty = (s: string) => Number(s.replace(",", ".")) || 0;

export function GenerateInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation("financials");
  const router = useRouter();
  const today = format(new Date(), "yyyy-MM-dd");
  const [f, setF] = useState({ client_name: "", client_nif: "", client_address: "Luanda - Angola", client_contact: "", issue_date: today, due_date: today, rental_start_date: today, rental_end_date: today, notes: "", discount: "" });
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [busy, setBusy] = useState(false);

  const parsed = lines.map(l => ({ code: l.code, description: l.description, unit: "Uni", qty: parseQty(l.qty), unit_price: parseKz(l.unit_price) }));
  const discount = parseKz(f.discount);
  const totals = computeTotals(parsed, 0, discount);
  const valid = f.client_name.trim() && f.due_date >= f.issue_date && f.rental_end_date >= f.rental_start_date && parsed.length > 0 && parsed.every(l => l.qty > 0 && l.unit_price > 0) && discount <= totals.subtotal;
  const setLine = (i: number, patch: Partial<Line>) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const inv = await rentalInvoiceService.create({ ...f, discount, series: seriesFor(COMPANY.seriesPrefix, f.issue_date), iva_rate: 0, lines: parsed });
      toast({ title: t("rentalInvoice.created", "Invoice generated"), description: t("rentalInvoice.createdHint", "It is in the rental list as not paid until a payment receipt is attached.") });
      onOpenChange(false);
      setLines([blankLine()]);
      setF(x => ({ ...x, client_name: "", client_nif: "", client_contact: "", notes: "", discount: "" }));
      router.push(`/dashboard/financials/rental/invoices/${inv.id}`);
    } catch (err) {
      toast({ title: t("messages.error", "Error"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof typeof f, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`inv-${k}`}>{label}</Label>
      <Input id={`inv-${k}`} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} {...props} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("rentalInvoice.title", "Generate Fatura Pró-Forma")}</DialogTitle>
          <DialogDescription>{t("rentalInvoice.subtitle", "Creates the rental and a printable invoice with a QR code. IVA 0% (not subject).")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-6">
          <section className="grid gap-3 sm:grid-cols-2">
            {field("client_name", t("rentalInvoice.client", "Client"), { required: true, placeholder: "ENAPP EP", autoFocus: true })}
            {field("client_nif", t("rentalInvoice.clientNif", "Client NIF (Contribuinte)"), { inputMode: "numeric", placeholder: "5000166405" })}
            {field("client_address", t("rentalInvoice.clientAddress", "Client address"))}
            {field("client_contact", t("rentalInvoice.clientContact", "Contact (phone or email)"))}
          </section>
          <section className="grid gap-3 sm:grid-cols-4">
            {field("issue_date", t("rentalInvoice.issueDate", "Issue date"), { type: "date", required: true })}
            {field("due_date", t("rentalInvoice.dueDate", "Due date"), { type: "date", required: true, min: f.issue_date })}
            {field("rental_start_date", t("rentalInvoice.rentalStart", "Rental from"), { type: "date", required: true })}
            {field("rental_end_date", t("rentalInvoice.rentalEnd", "Rental to"), { type: "date", required: true, min: f.rental_start_date })}
          </section>

          <section className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("rentalInvoice.lines", "Lines")}</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines(ls => [...ls, blankLine()])}><Plus className="mr-1 h-4 w-4" />{t("rentalInvoice.addLine", "Add line")}</Button>
            </div>
            <div className="hidden grid-cols-[1.1fr_1.6fr_70px_1fr_36px] gap-2 px-1 text-xs font-medium text-gray-500 sm:grid">
              <span>{t("rentalInvoice.code", "Route / code")}</span><span>{t("rentalInvoice.description", "Description")}</span><span>{t("rentalInvoice.qty", "Qty")}</span><span>{t("rentalInvoice.unitPrice", "Unit price (Kz)")}</span><span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[1.1fr_1.6fr_70px_1fr_36px] sm:border-0 sm:p-0">
                <Input aria-label="Route / code" placeholder="UIGE/ Malanje" value={l.code} onChange={e => setLine(i, { code: e.target.value })} />
                <Input aria-label="Description" value={l.description} onChange={e => setLine(i, { description: e.target.value })} className="col-span-2 sm:col-span-1" />
                <Input aria-label="Qty" inputMode="decimal" value={l.qty} onChange={e => setLine(i, { qty: e.target.value })} />
                <Input aria-label="Unit price" inputMode="decimal" placeholder="2.850.000" value={l.unit_price} onChange={e => setLine(i, { unit_price: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </section>

          <div className="grid gap-1.5">
            <Label htmlFor="inv-notes">{t("rentalInvoice.notes", "Observações (optional)")}</Label>
            <Textarea id="inv-notes" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Os bens/serviços foram colocados à disposição do adquirente na data do documento." />
          </div>

          <div className="grid items-end gap-3 sm:grid-cols-[220px_1fr]">
            {field("discount", t("rentalInvoice.discount", "Discount (Kz, optional)"), { inputMode: "decimal", placeholder: "1.980.000", "aria-invalid": discount > totals.subtotal })}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-500">{t("rentalInvoice.total", "Total (IVA 0%)")}</span>
              <span className="text-right">
                {discount > 0 && <span className="block text-xs tabular-nums text-gray-500">{formatKz(totals.subtotal)} − {formatKz(discount)}</span>}
                <span className="text-xl font-semibold tabular-nums">{formatKz(totals.total)}</span>
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("buttons.cancel", "Cancel")}</Button>
            <Button type="submit" disabled={!valid || busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("rentalInvoice.generate", "Generate invoice")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
