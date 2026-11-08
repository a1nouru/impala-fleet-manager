"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Link2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { InvoiceDocument, publicInvoiceUrl, type InvoiceDoc } from "@/components/rental-invoice/invoice-document";
import { formatKz, invoiceLabel, paymentState } from "@/lib/rental-invoice/format";
import { rentalInvoiceService } from "@/services/rentalInvoiceService";
import { rentalService } from "@/services/rentalService";

export default function RentalInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("financials");
  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [rentalId, setRentalId] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transfer");
  const [busy, setBusy] = useState(false);

  const load = () => rentalInvoiceService.getById(id)
    .then(r => { setDoc(r.doc); setRentalId(r.rentalId); setAmount(String(Math.max(0, Number(r.doc.total) - Number(r.doc.paid_amount)))); })
    .catch(e => setError(e.message));
  useEffect(() => { load(); }, [id]);

  async function attach(e: FormEvent) {
    e.preventDefault();
    if (!file || !Number(amount)) return;
    setBusy(true);
    try {
      await rentalService.addReceiptsToRental(rentalId, [{ file, amount: Number(amount), payment_method: method }]);
      setFile(null);
      toast({ title: t("rentalInvoice.receiptAdded", "Payment recorded") });
      await load();
    } catch (err) {
      toast({ title: t("messages.error", "Error"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!doc) return <div className="h-[900px] animate-pulse rounded-xl bg-gray-100" />;

  const url = publicInvoiceUrl(doc.public_token);
  const state = paymentState(Number(doc.total), Number(doc.paid_amount));
  const outstanding = Math.max(0, Number(doc.total) - Number(doc.paid_amount));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/financials/rental" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> {t("rentalInvoice.backToRentals", "Back to rentals")}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(url).then(() => toast({ title: t("rentalInvoice.linkCopied", "Invoice link copied") }))}>
            <Link2 className="mr-2 h-4 w-4" /> {t("rentalInvoice.copyLink", "Copy link")}
          </Button>
          <Button asChild>
            <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> {t("rentalInvoice.openPrint", "Open, print or PDF")}</a>
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <InvoiceDocument d={doc} />
        <Card className="xl:sticky xl:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              {t("rentalInvoice.payment", "Payment")}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${state === "paid" ? "bg-emerald-50 text-emerald-700" : state === "partial" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`}>
                {state === "paid" ? t("rentalInvoice.paid", "Paid") : state === "partial" ? t("rentalInvoice.partial", "Partly paid") : t("rentalInvoice.unpaid", "Not paid")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">{invoiceLabel(doc.series, doc.number)}</dt><dd className="font-medium tabular-nums">{formatKz(Number(doc.total))}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">{t("rentalInvoice.received", "Received")}</dt><dd className="tabular-nums">{formatKz(Number(doc.paid_amount))}</dd></div>
              <div className="flex justify-between border-t pt-1 font-medium"><dt>{t("rentalInvoice.outstanding", "Outstanding")}</dt><dd className="tabular-nums">{formatKz(outstanding)}</dd></div>
            </dl>
            {state !== "paid" && (
              <form onSubmit={attach} className="space-y-3 border-t pt-4">
                <p className="text-sm text-gray-500">{t("rentalInvoice.attachHint", "Attach the bank transfer or payment receipt to mark it paid.")}</p>
                <div className="grid gap-1.5"><Label htmlFor="rcpt-file">{t("rentalInvoice.receiptFile", "Receipt (photo or PDF)")}</Label>
                  <Input id="rcpt-file" type="file" accept="image/*,application/pdf" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5"><Label htmlFor="rcpt-amount">{t("rentalInvoice.amount", "Amount (Kz)")}</Label>
                    <Input id="rcpt-amount" inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} /></div>
                  <div className="grid gap-1.5"><Label>{t("rentalInvoice.method", "Method")}</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer">{t("rentalInvoice.transfer", "Transfer")}</SelectItem>
                        <SelectItem value="cash">{t("rentalInvoice.cash", "Cash")}</SelectItem>
                        <SelectItem value="cheque">{t("rentalInvoice.cheque", "Cheque")}</SelectItem>
                        <SelectItem value="other">{t("rentalInvoice.other", "Other")}</SelectItem>
                      </SelectContent>
                    </Select></div>
                </div>
                <Button type="submit" className="w-full" disabled={busy || !file || !Number(amount)}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{t("rentalInvoice.recordPayment", "Record payment")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
