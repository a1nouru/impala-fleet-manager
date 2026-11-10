"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import qrcode from "qrcode-generator";
import { nilo } from "@/lib/nilo/client";

type Code = { code: string; line: { item: { name: string }; invoice: { invoice_no: string | null } } };

const qrSvg = (text: string) => {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
};

// A4 sticker sheet, 3 × 8 labels of 70 × 37 mm (the common 24-up sheet).
function Labels() {
  const params = useSearchParams();
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const line = params.get("line");
    const item = params.get("item");
    nilo<Code[]>(line ? `codes?line=${line}` : `codes?item=${item}`).then(setCodes, (e) => setError(String(e.message)));
  }, [params]);

  if (error) return <p className="p-8 text-red-700">{error}</p>;
  if (!codes) return <p className="p-8">…</p>;

  return (
    <>
      <style>{`@page { size: A4; margin: 0 } body { margin: 0 }`}</style>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 print:hidden">
        <button className="min-h-11 rounded bg-black px-4 py-2 text-white" onClick={() => window.print()}>
          Print {codes.length} labels
        </button>
        <span className="text-sm text-gray-600">A4 · 24 per sheet (3 × 8, 70 × 37 mm)</span>
      </div>
      {/* Phones preview one label per row; the printed sheet is always 3 × 8 on A4. */}
      <div
        className="grid w-full max-w-[210mm] grid-cols-1 content-start gap-0 px-0 py-[13.5mm] sm:grid-cols-3 print:w-[210mm] print:max-w-none print:grid-cols-3"
        style={{ gridAutoRows: "37mm" }}
      >
        {codes.map((c, i) => (
          <div
            key={c.code}
            className="flex items-center gap-[3mm] overflow-hidden px-[4mm]"
            style={{ breakInside: "avoid", breakBefore: i > 0 && i % 24 === 0 ? "page" : undefined }}
          >
            <div className="h-[26mm] w-[26mm] shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg(c.code) }} />
            <div className="min-w-0 leading-tight">
              <div className="font-mono text-[11pt] font-bold">{c.code}</div>
              <div className="line-clamp-3 text-[8pt]">{c.line.item.name}</div>
              <div className="mt-1 text-[6.5pt] uppercase tracking-wider text-gray-500">
                Nilo{c.line.invoice.invoice_no ? ` · ${c.line.invoice.invoice_no}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function LabelsPage() {
  return (
    <Suspense>
      <Labels />
    </Suspense>
  );
}
