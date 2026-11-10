import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStatement, type Movement, type Unit } from "./ledger.ts";
import { buildStatementDoc, dueDate, statementNo } from "./statement-doc.ts";

const tyre: Unit = { id: "t", code: "NILO-000001", itemName: "Pneu Roadking", unitCost: 200000, containerSize: null };
const tyre2: Unit = { ...tyre, id: "t2", code: "NILO-000002" };
const oil: Unit = { id: "o", code: "NILO-000009", itemName: "Óleo 15W40", unitCost: 50000, containerSize: 20 };
const mv = (unitId: string, type: Movement["type"], quantity: number, plate: string, recordId: string, at: string): Movement => ({
  unitId, type, quantity, company: "royal", vehiclePlate: plate, recordId, at,
});

const log = [
  mv("t", "consume", 1, "LDA-1", "job-a", "2026-11-03T12:00:00Z"),
  mv("o", "consume", 4, "LDA-1", "job-a", "2026-11-03T12:00:00Z"),
  mv("t2", "consume", 1, "LDA-1", "job-b", "2026-11-09T12:00:00Z"),
  mv("o", "consume", 2, "LDA-2", "job-c", "2026-11-05T12:00:00Z"),
  mv("o", "receive", 1, "LDA-2", "job-c", "2026-11-06T12:00:00Z"),
];
const NOV = { from: "2026-11-01T00:00:00Z", to: "2026-12-01T00:00:00Z" };
const st = buildStatement("royal", NOV, [tyre, tyre2, oil], log);
const jobs = new Map([
  ["job-a", { date: "2026-11-03", description: "Troca de pneu e óleo" }],
  ["job-b", { date: "2026-11-09", description: "Pneu traseiro" }],
  ["job-c", { date: "2026-11-05", description: "Óleo" }],
]);

test("each vehicle lists its jobs in date order, each job its parts, with subtotals", () => {
  const doc = buildStatementDoc(st, jobs, [], null);
  const v1 = doc.vehicles.find((v) => v.plate === "LDA-1")!;
  assert.deepEqual(v1.jobs.map((j) => [j.description, j.lines.length, j.subtotal]), [
    ["Troca de pneu e óleo", 2, 210000],
    ["Pneu traseiro", 1, 200000],
  ]);
  assert.equal(v1.subtotal, 410000);
  assert.deepEqual(doc.vehicles.map((v) => v.plate), ["LDA-1", "LDA-2"]);
  assert.deepEqual(doc.counts, { vehicles: 2, jobs: 3, units: 7 });
});

test("returned parts are credits, shown separately from charges", () => {
  const doc = buildStatementDoc(st, jobs, [], null);
  const v2 = doc.vehicles.find((v) => v.plate === "LDA-2")!;
  assert.deepEqual([v2.charges, v2.credits, v2.subtotal], [5000, 2500, 2500]);
  assert.deepEqual([doc.account.charges, doc.account.credits, doc.account.amountDue], [415000, 2500, 412500]);
});

test("a running statement is provisional, unnumbered, and due 15 days after now", () => {
  const doc = buildStatementDoc(st, jobs, [], null);
  assert.deepEqual([doc.provisional, doc.statementNo, doc.dueDate], [true, null, "2026-12-16"]);
});

test("unpaid earlier statements carry into the amount due; payments made in the range are listed", () => {
  const doc = buildStatementDoc(st, jobs, [
    { statementNo: "NILO-RE-20261001-1", to: "2026-10-01T09:00:00Z", total: 100000, status: "paid", paidAt: "2026-11-02T10:00:00Z" },
    { statementNo: "NILO-RE-20261020-1", to: "2026-10-20T09:00:00Z", total: 50000, status: "paid", paidAt: "2026-10-25T10:00:00Z" },
    { statementNo: "NILO-RE-20261101-1", to: "2026-11-01T00:00:00Z", total: 300000, status: "issued", paidAt: null },
  ], { issuedAt: "2026-11-28T09:00:00Z", statementNo: "NILO-RE-20261128-1" });
  assert.equal(doc.account.previousBalance, 300000);
  assert.equal(doc.account.amountDue, 712500);
  assert.deepEqual(doc.account.paymentsReceived.map((p) => p.statementNo), ["NILO-RE-20261001-1"]);
  assert.deepEqual([doc.provisional, doc.statementNo, doc.dueDate], [false, "NILO-RE-20261128-1", "2026-12-13"]);
});

test("statement numbers carry the company, the date and the count that day; due 15 days later", () => {
  assert.equal(statementNo("royal", "2026-11-10T14:03:00Z", 1), "NILO-RE-20261110-1");
  assert.equal(statementNo("impala", "2026-11-10T18:00:00Z", 2), "NILO-IM-20261110-2");
  assert.equal(dueDate("2026-12-20T08:00:00Z"), "2027-01-04");
});

test("units of the same part on one job are one line with all their label codes", () => {
  const doc = buildStatementDoc(
    buildStatement("royal", NOV, [tyre, tyre2], [
      mv("t2", "consume", 1, "LDA-1", "job-a", "2026-11-03T12:00:00Z"),
      mv("t", "consume", 1, "LDA-1", "job-a", "2026-11-03T12:00:00Z"),
    ]),
    jobs, [], null,
  );
  assert.deepEqual(doc.vehicles[0].jobs[0].lines, [
    { itemName: "Pneu Roadking", codes: ["NILO-000001", "NILO-000002"], quantity: 2, unitPrice: 200000, amount: 400000 },
  ]);
});
