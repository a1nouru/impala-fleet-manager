// Decides what happens to an uploaded supplier invoice before any QR label exists.
// block: can never be accepted. flag: an approver must sign off. Clean: auto-approved.

export type InvoiceDraft = {
  supplierNif: string;
  invoiceNo: string;
  fileSha256: string;
  invoiceDate: string;
  total: number;
  lines: { quantity: number; unitCost: number }[];
  // True when anyone changed a number the OCR read.
  editedByHand: boolean;
};

export type Known = { nifAndNumber: Set<string>; fileHashes: Set<string> };

export type Check = { level: "block" | "flag"; reason: string };

export type Verdict = { status: "blocked" | "pending_approval" | "approved"; checks: Check[] };

export const nifAndNumber = (nif: string, no: string) => `${nif.replace(/\D/g, "")}|${no.trim().toUpperCase()}`;

const DAY = 86_400_000;

export function checkInvoice(inv: InvoiceDraft, known: Known, today: Date): Verdict {
  const checks: Check[] = [];
  const block = (reason: string) => checks.push({ level: "block", reason });
  const flag = (reason: string) => checks.push({ level: "flag", reason });

  if (known.nifAndNumber.has(nifAndNumber(inv.supplierNif, inv.invoiceNo)))
    block(`invoice ${inv.invoiceNo} from NIF ${inv.supplierNif} is already registered`);
  if (known.fileHashes.has(inv.fileSha256)) block("this exact file was already uploaded");

  const sum = inv.lines.reduce((n, l) => n + l.quantity * l.unitCost, 0);
  if (Math.abs(sum - inv.total) > 1) flag(`lines add up to ${sum.toFixed(2)} Kz but the invoice total is ${inv.total.toFixed(2)} Kz`);
  if (inv.lines.some((l) => l.quantity <= 0 || l.unitCost <= 0)) flag("a line has zero quantity or price");

  const age = (today.getTime() - new Date(`${inv.invoiceDate}T00:00:00Z`).getTime()) / DAY;
  if (age < -1) flag("invoice date is in the future");
  if (age > 60) flag("invoice is more than 60 days old");
  if (inv.editedByHand) flag("numbers read from the invoice were changed by hand");

  const status = checks.some((c) => c.level === "block")
    ? "blocked"
    : checks.length > 0
      ? "pending_approval"
      : "approved";
  return { status, checks };
}
