import type { ExtractedSlip } from "./verify";

// Uploads the attached slip files to the server-side extraction route, which
// reads them with Claude and returns structured slip data. The browser never
// sees the API key and never post-processes the amounts.
export async function extractSlips(files: File[], signal?: AbortSignal): Promise<ExtractedSlip[]> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  const res = await fetch("/api/slip-extract", { method: "POST", body: formData, signal });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(body?.error || `Slip extraction failed (${res.status})`);
  }
  return (body?.slips || []) as ExtractedSlip[];
}
