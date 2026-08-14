// Shared inventory-usage math for the maintenance -> inventory decrement.
//
// Stock is never physically decremented. "Available" is computed at read time as
// (total purchased for an item) - (units consumed by maintenance for that item).
// The two sides are joined by the item name, which is entered by hand and varies
// in case and spacing ("MAMBA GEAR OIL " vs "mamba gear oil"). Matching on the raw
// string left used items stuck at full stock, so we match on a normalized name.

export function normalizeItemName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

const UNKNOWN_ITEM = normalizeItemName("Unknown Item");

// A maintenance part string looks like "Item Name (Qty: 3)".
const PART_QTY_RE = /^(.+?)\s*\(Qty:\s*(\d+)\)$/;

type MaintenanceRecord = { parts?: unknown };
type InventoryItem = { item_name?: string | null; quantity?: number | null };

// Sum how many units of each item have been consumed across maintenance records,
// keyed by normalized item name. Custom / free-text parts (which never came from
// inventory) are ignored; legacy quantity-less names count as one unit.
export function usedQuantitiesByNormalizedName(
  records: MaintenanceRecord[] | null | undefined
): Record<string, number> {
  const used: Record<string, number> = {};

  for (const record of records ?? []) {
    const parts = (record as MaintenanceRecord)?.parts;
    if (!Array.isArray(parts)) continue;

    for (const partString of parts) {
      if (typeof partString !== "string") continue;

      const match = partString.match(PART_QTY_RE);
      if (match) {
        const key = normalizeItemName(match[1]);
        if (!key) continue;
        used[key] = (used[key] || 0) + parseInt(match[2], 10);
      } else if (!partString.includes("(Custom)") && !partString.includes(":")) {
        // Legacy record without an explicit quantity: assume one unit.
        const key = normalizeItemName(partString);
        if (!key) continue;
        used[key] = (used[key] || 0) + 1;
      }
    }
  }

  return used;
}

// Available stock per normalized item name = total purchased - consumed. Purchases
// for names that differ only by case/spacing are pooled so used units subtract from
// the same bucket. Floored at zero. Pass the map from usedQuantitiesByNormalizedName.
export function availableByNormalizedName(
  items: InventoryItem[] | null | undefined,
  usedByNormalized: Record<string, number>
): Record<string, number> {
  const purchased: Record<string, number> = {};

  for (const item of items ?? []) {
    const key = normalizeItemName(item?.item_name) || UNKNOWN_ITEM;
    purchased[key] = (purchased[key] || 0) + (Number(item?.quantity) || 0);
  }

  const available: Record<string, number> = {};
  for (const key of Object.keys(purchased)) {
    available[key] = Math.max(0, purchased[key] - (usedByNormalized[key] || 0));
  }

  return available;
}
