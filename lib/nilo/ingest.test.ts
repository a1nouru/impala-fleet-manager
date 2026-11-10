import { test } from "node:test";
import assert from "node:assert/strict";
import { itemKey, openingUnits, planIngest, type SourceRow } from "./ingest.ts";

let n = 0;
const row = (o: Partial<SourceRow>): SourceRow => ({
  company: "royal",
  id: String(++n),
  code: String(n),
  date: "2026-11-08",
  itemName: "Pneu Roadking A1066 315/80R22.5",
  description: "",
  quantity: 1,
  unitCost: 100,
  fileKey: `file-${n}`,
  ...o,
});

test("one order split between the two apps becomes a single lot with the full quantity", () => {
  const desc = "137 de 274 (contentor dividido com Impala)";
  const plan = planIngest([
    row({ company: "royal", quantity: 137, unitCost: 208284.7, description: desc, fileKey: null }),
    row({ company: "impala", quantity: 137, unitCost: 208284.7, description: desc, fileKey: null }),
  ]);
  assert.equal(plan.lots.length, 1);
  assert.equal(plan.lots[0].quantity, 274);
  assert.equal(plan.splitPairs.length, 1);
});

test("the same receipt, item, qty and price twice is flagged as a likely duplicate but never dropped", () => {
  const plan = planIngest([
    row({ company: "royal", date: "2025-10-04", quantity: 2, fileKey: "etag-a" }),
    row({ company: "impala", date: "2025-10-17", quantity: 2, fileKey: "etag-a" }),
  ]);
  assert.equal(plan.lots.length, 2);
  assert.equal(plan.likelyDuplicates.length, 1);
});

test("one receipt covering different items stays as separate purchases", () => {
  const plan = planIngest([
    row({ itemName: "Jogo de calço", fileKey: "etag-b" }),
    row({ itemName: "Filtro de óleo", fileKey: "etag-b" }),
  ]);
  assert.equal(plan.lots.length, 2);
  assert.equal(plan.likelyDuplicates.length, 0);
});

test("two lines of one invoice with the same item but different prices stay separate", () => {
  const plan = planIngest([
    row({ itemName: "Material do PINTOR", unitCost: 25000, fileKey: "etag-d" }),
    row({ itemName: "Material do PINTOR", unitCost: 12000, fileKey: "etag-d" }),
  ]);
  assert.equal(plan.lots.length, 2);
  assert.equal(plan.likelyDuplicates.length, 0);
});

test("look-alike purchases with different receipts are listed for review, not merged", () => {
  const plan = planIngest([row({ quantity: 4 }), row({ quantity: 4 })]);
  assert.equal(plan.lots.length, 2);
  assert.equal(plan.lookalikes.length, 1);
});

test("junk rows are excluded", () => {
  const plan = planIngest([row({ itemName: "Compra de Pneus e Abastecimento", unitCost: 1 })]);
  assert.equal(plan.lots.length, 0);
  assert.equal(plan.junk.length, 1);
});

test("spelling variants of one part share a catalog key; different specs do not", () => {
  const calco = ["CALÇO", "JOGO DE CALCO", "Jogo de Calços", "JOGOS DE CALÇO", "Brake disc pads"].map(itemKey);
  assert.equal(new Set(calco).size, 1);
  assert.equal(itemKey("PNEU GORDEN CROWN 315/80R22.5"), itemKey("Pneu Golden Crown 315/80R22.5"));
  assert.notEqual(itemKey("Calço WVA29087"), itemKey("Jogo de calço"));
  assert.notEqual(itemKey("PNEU 12R22.5"), itemKey("PNEU 315/80R22.5"));
});

test("opening stock is bought minus used across both apps, placed on the newest purchases", () => {
  const plan = planIngest([
    row({ company: "royal", itemName: "CALÇO", date: "2026-01-01", quantity: 4 }),
    row({ company: "impala", itemName: "Jogo de calço", date: "2026-03-01", quantity: 3 }),
    row({ company: "royal", itemName: "PNEU 12R22.5", date: "2026-02-01", quantity: 2 }),
  ]);
  const used = new Map([[itemKey("calço"), 5]]);
  const units = openingUnits(plan.lots, used);
  const byName = Object.fromEntries(plan.lots.map((l, i) => [`${l.rows[0].itemName}@${l.date}`, units[i]]));
  assert.deepEqual(byName, { "CALÇO@2026-01-01": 0, "Jogo de calço@2026-03-01": 2, "PNEU 12R22.5@2026-02-01": 2 });
});

test("over-used parts open at zero, never negative", () => {
  const plan = planIngest([row({ itemName: "Silicone", quantity: 2 })]);
  assert.deepEqual(openingUnits(plan.lots, new Map([[itemKey("Silicone"), 9]])), [0]);
});
