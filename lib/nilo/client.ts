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
