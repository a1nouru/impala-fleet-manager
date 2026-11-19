// Browser-side calls to /api/nilo/*. Errors carry the server's message.
export async function nilo<T = unknown>(action: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api/nilo/${action}`, {
    ...rest,
    ...(json !== undefined && {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Nilo request failed (${res.status})`);
  return body as T;
}

export type StockRow = {
  item_id: string;
  name: string;
  kind: "unit" | "bulk";
  measure_unit: string | null;
  purchased: number;
  used: number;
  available: number;
  awaiting_receipt: number;
  avg_cost: number | null;
  last_known_cost: number | null;
};

export type NiloMe = { email: string; company: "royal" | "impala"; isApprover: boolean; cutoverAt: string | null };

export const fileUrl = (bucket: "nilo-invoices" | "nilo-payments", path: string) =>
  `/api/nilo/file?bucket=${bucket}&path=${encodeURIComponent(path)}`;

export const kz = (n: number | string | null | undefined) =>
  `${Number(n ?? 0).toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

// File types an invoice page may be: what the reader accepts and the server stores.
export const PAGE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export type InvoiceLine = {
  id: string;
  ocr_description: string;
  quantity: number;
  unit_cost: number;
  container_size: number | null;
  labels_generated: number;
  item: { name: string; kind: string; measure_unit: string | null } | null;
};
export type Invoice = {
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
  lines: InvoiceLine[];
};
