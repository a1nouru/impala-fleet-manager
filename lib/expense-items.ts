// Company-expense line items live inside the free-text `description` column,
// one per line as "<text> — <amount>". Lines without an amount are plain notes.
// ponytail: no jsonb column; move to `items jsonb` if items ever need querying.
export type ExpenseItem = { description: string; amount: string };

const LINE = /^(.*?)\s+—\s+([\d,]+(?:\.\d+)?)$/;

export const emptyItem = (): ExpenseItem => ({ description: "", amount: "" });

export const parseItems = (description?: string | null): ExpenseItem[] =>
  (description ?? "")
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const m = line.trim().match(LINE);
      return m ? { description: m[1], amount: m[2].replace(/,/g, "") } : { description: line.trim(), amount: "" };
    });

export const serializeItems = (items: ExpenseItem[]): string =>
  items
    .filter((i) => i.description.trim() || i.amount)
    .map((i) => {
      const n = parseFloat(i.amount);
      return isNaN(n)
        ? i.description.trim()
        : `${i.description.trim()} — ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    })
    .join("\n");

export const sumItems = (items: ExpenseItem[]): number =>
  items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
