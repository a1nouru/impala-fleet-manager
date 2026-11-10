"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { nilo } from "@/lib/nilo/client";
import type { StatementDoc } from "@/lib/nilo/statement-doc";
import { StatementDocument } from "@/components/nilo/statement-document";
import { useTranslation } from "@/hooks/useTranslation";

// ?id=<issued statement> shows the frozen statement; ?running shows this month so far.
function StatementView() {
  const { t } = useTranslation("nilo");
  const params = useSearchParams();
  const [doc, setDoc] = useState<StatementDoc | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.get("id");
    (id
      ? nilo<{ lines: StatementDoc }>(`statement?id=${encodeURIComponent(id)}`).then((r) => r.lines)
      : nilo<StatementDoc>("running")
    ).then(setDoc, (e) => setError(String(e.message)));
  }, [params]);

  if (error) return <p className="p-8 text-red-700">{error}</p>;
  if (!doc) return <p className="p-8">…</p>;

  return (
    <>
      <div className="p-4 print:hidden">
        <button className="min-h-11 rounded bg-black px-4 py-2 text-white" onClick={() => window.print()}>
          {t("doc.print")}
        </button>
      </div>
      <div className="px-4 pb-10 sm:px-6 print:p-0">
        <StatementDocument doc={doc} />
      </div>
    </>
  );
}

export default function StatementPage() {
  return (
    <Suspense>
      <StatementView />
    </Suspense>
  );
}
