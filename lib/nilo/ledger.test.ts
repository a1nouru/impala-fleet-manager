import { test } from "node:test";
import assert from "node:assert/strict";
import { availableByItem, buildStatement, consumeError, type Movement, type Unit } from "./ledger.ts";

const NOV = { from: "2026-11-01", to: "2026-12-01" };

const tyre = (n: number): Unit => ({
  id: `t${n}`,
  code: `NILO-00000${n}`,
  itemName: "Pneu Roadking A1066 315/80R22.5",
  unitCost: 208284.7,
  containerSize: null,
});
const oil: Unit = { id: "o1", code: "NILO-000009", itemName: "Mamba gear oil", unitCost: 50000, containerSize: 20 };

const mv = (unitId: string, type: Movement["type"], quantity = 1, company: Movement["company"] = null, at = "2026-11-10"): Movement => ({
  unitId,
  type,
  quantity,
  company,
  vehiclePlate: company ? "LD-12-34" : null,
  at,
});

test("a part Impala consumes is no longer available to Royal Express", () => {
  const units = [tyre(1), tyre(2)];
  const received = [mv("t1", "receive"), mv("t2", "receive")];
  assert.equal(availableByItem(units, received).get(units[0].itemName), 2);

  const afterImpala = [...received, mv("t1", "consume", 1, "impala")];
  assert.equal(availableByItem(units, afterImpala).get(units[0].itemName), 1);
  assert.match(consumeError(units[0], afterImpala, 1) ?? "", /not in stock/);
  assert.equal(consumeError(units[1], afterImpala, 1), null);
});

test("labelled but not yet received units are not available", () => {
  assert.equal(availableByItem([tyre(1)], []).size, 0);
  assert.match(consumeError(tyre(1), [], 1) ?? "", /not in stock/);
});

test("bulk containers draw down by measure and cannot go below zero", () => {
  const log = [mv("o1", "receive", 20), mv("o1", "consume", 6, "royal"), mv("o1", "consume", 5, "impala")];
  assert.equal(availableByItem([oil], log).get(oil.itemName), 9);
  assert.match(consumeError(oil, log, 10) ?? "", /only 9 left/);
  assert.equal(consumeError(oil, log, 9), null);
});

test("a single unit can only be consumed whole", () => {
  assert.match(consumeError(tyre(1), [mv("t1", "receive")], 2) ?? "", /exactly 1/);
});

test("each company's statement bills only its own consumption in that month", () => {
  const units = [tyre(1), tyre(2), oil];
  const log = [
    mv("t1", "receive"), mv("t2", "receive"), mv("o1", "receive", 20),
    mv("t1", "consume", 1, "royal", "2026-11-03"),
    mv("t2", "consume", 1, "impala", "2026-11-04"),
    mv("o1", "consume", 4, "royal", "2026-11-05"),
    mv("o1", "consume", 2, "royal", "2026-12-01"),
  ];
  const royal = buildStatement("royal", NOV, units, log);
  assert.deepEqual(royal.lines.map((l) => [l.code, l.amount]), [["NILO-000001", 208284.7], ["NILO-000009", 10000]]);
  assert.equal(royal.total, 218284.7);
  assert.deepEqual(royal.byVehicle, [{ vehiclePlate: "LD-12-34", parts: 2, amount: 218284.7 }]);

  assert.equal(buildStatement("impala", NOV, units, log).total, 208284.7);
});

test("a part returned from an edited job is credited on that company's statement", () => {
  const log = [
    mv("o1", "receive", 20),
    mv("o1", "consume", 6, "royal", "2026-11-03"),
    mv("o1", "receive", 2, "royal", "2026-11-04"),
  ];
  const st = buildStatement("royal", NOV, [oil], log);
  assert.deepEqual(st.lines.map((l) => l.amount), [15000, -5000]);
  assert.equal(st.total, 10000);
  assert.equal(availableByItem([oil], log).get(oil.itemName), 16);
});

test("a statement covers exactly its range, so back-to-back statements never overlap or skip", () => {
  const log = [
    mv("o1", "receive", 20),
    mv("o1", "consume", 1, "royal", "2026-11-03T10:00:00Z"),
    mv("o1", "consume", 2, "royal", "2026-11-10T09:00:00Z"),
    mv("o1", "consume", 4, "royal", "2026-11-20T15:00:00Z"),
  ];
  const cut = "2026-11-10T09:00:00Z";
  const first = buildStatement("royal", { from: null, to: cut }, [oil], log);
  const second = buildStatement("royal", { from: cut, to: "2026-11-25T00:00:00Z" }, [oil], log);
  assert.deepEqual(first.lines.map((l) => l.quantity), [1]);
  assert.deepEqual(second.lines.map((l) => l.quantity), [2, 4]);
});
