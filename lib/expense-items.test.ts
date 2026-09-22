import { describe, it, expect } from "vitest";
import { parseItems, serializeItems, sumItems } from "./expense-items";

describe("expense-items", () => {
  const items = [
    { description: "Purchase of airticket for mr. X", amount: "946000" },
    { description: "Spare parts (repair of cupla LD-55-62-HL)", amount: "327200.5" },
    { description: "just a note", amount: "" },
    { description: "", amount: "" },
  ];
  it("round-trips", () => {
    const s = serializeItems(items);
    expect(s).toBe("Purchase of airticket for mr. X — 946,000\nSpare parts (repair of cupla LD-55-62-HL) — 327,200.5\njust a note");
    expect(parseItems(s)).toEqual(items.slice(0, 3));
    expect(sumItems(parseItems(s))).toBe(1273200.5);
  });
  it("keeps legacy free text as a note", () => {
    expect(parseItems("Weekly expenses 493,000 Labor 800,000")).toEqual([{ description: "Weekly expenses 493,000 Labor 800,000", amount: "" }]);
    expect(parseItems(null)).toEqual([]);
  });
});
