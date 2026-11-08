"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { InvoiceDocument, type InvoiceDoc } from "@/components/rental-invoice/invoice-document";
import { rentalInvoiceService } from "@/services/rentalInvoiceService";
import { COMPANY } from "@/lib/rental-invoice/company";

/** Public page the invoice QR code opens. No login; the token in the URL is the key. */
export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<InvoiceDoc | null | undefined>(undefined);

  useEffect(() => {
    rentalInvoiceService.getPublic(token).then(setDoc).catch(() => setDoc(null));
  }, [token]);

  return (
    <main className="min-h-dvh bg-slate-100 px-3 py-6 sm:py-10 print:bg-white print:p-0">
      {doc === undefined ? (
        <div className="mx-auto h-[900px] max-w-[820px] animate-pulse rounded-xl bg-white/70" />
      ) : doc === null ? (
        <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center text-center">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Fatura não encontrada</h1>
            <p className="mt-2 text-sm text-slate-500">Este link não corresponde a uma fatura da {COMPANY.legalName}. Confirme o código QR ou peça uma nova cópia.</p>
          </div>
        </div>
      ) : (
        <>
          <InvoiceDocument d={doc} />
          <div className="mt-6 flex justify-center print:hidden">
            <button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
              <Printer className="h-4 w-4" /> Imprimir ou guardar PDF
            </button>
          </div>
        </>
      )}
    </main>
  );
}
