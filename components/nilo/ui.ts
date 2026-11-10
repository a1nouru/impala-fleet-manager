import { toast } from "@/components/ui/use-toast";

export const fail = (e: unknown) =>
  toast({ title: "Nilo", description: e instanceof Error ? e.message : String(e), variant: "destructive" });

export const qty = (n: number | string, unit?: string | null) =>
  `${Number(n).toLocaleString("pt-AO", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;

// Controls are 44px tall on phones (thumb-sized), the usual size from sm up.
export const tap = "h-11 sm:h-9";
export const link = "inline-flex min-h-11 items-center text-sm underline sm:min-h-0";

// Below sm every table row becomes a card: the first cell is its title, and every other cell
// is a "label … value" line, the label coming from the cell's data-label.
export const stack = {
  table: "max-sm:block",
  head: "max-sm:hidden",
  row: "max-sm:flex max-sm:flex-col max-sm:py-3",
  title: "max-sm:px-0 max-sm:pb-1 max-sm:pt-0 max-sm:text-base max-sm:whitespace-normal",
  // A cell holding only a button: full width on phones, no label column.
  action: "max-sm:px-0 max-sm:pb-0 max-sm:pt-2 max-sm:empty:hidden",
  cell: "max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:px-0 max-sm:py-1 max-sm:text-right max-sm:whitespace-normal max-sm:empty:hidden max-sm:before:text-left max-sm:before:font-sans max-sm:before:font-normal max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]",
};

