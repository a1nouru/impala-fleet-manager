import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTire, isFluid, parsePart, unitPriceByName, kmSincePrevious, buildInsights, lastSundayToSunday } from './insights.ts';

test('isTire matches tires but not fitting services', () => {
  assert.equal(isTire('PNEU GORDEN CROWN 315/80R22.5'), true);
  assert.equal(isTire('Tire - 295/80R22.5'), true);
  assert.equal(isTire('PNEU MONTAGEM'), false);
  assert.equal(isTire('FILTRO DE ÓLEO JX0818'), false);
});

test('isFluid catches oils and coolant but not oil filters', () => {
  assert.equal(isFluid('ÓLEO SINOPEC 15W40'), true);
  assert.equal(isFluid('VALVUNINA MAMBA GEAR 85W140'), true);
  assert.equal(isFluid('ÁGUA DO RADIADOR 5L'), true);
  assert.equal(isFluid('FILTRO DE ÓLEO JX0818'), false);
});

test('parsePart reads quantity, defaults custom parts to one unit', () => {
  assert.deepEqual(parsePart('PNEU GOODYEAR 9R22.5 (Qty: 2)'), { name: 'PNEU GOODYEAR 9R22.5', qty: 2 });
  assert.deepEqual(parsePart('Electrical: wiring'), { name: 'Electrical: wiring', qty: 1 });
  assert.equal(parsePart('  '), null);
});

test('unitPriceByName averages prices across name variants', () => {
  const prices = unitPriceByName([
    { item_name: 'Pneu X ', amount_unit: 100 },
    { item_name: 'pneu x', amount_unit: '200' },
    { item_name: 'Free', amount_unit: 0 },
  ]);
  assert.deepEqual(prices, { 'pneu x': 150 });
});

test('kmSincePrevious ignores zero readings and rubbish jumps', () => {
  const km = kmSincePrevious([
    { id: 'a', date: '2026-10-01', plate: 'P1', kilometers: 100000 },
    { id: 'b', date: '2026-10-05', plate: 'P1', kilometers: 0 },
    { id: 'c', date: '2026-10-10', plate: 'P1', kilometers: 105000 },
    { id: 'd', date: '2026-10-20', plate: 'P1', kilometers: 900000 }, // typo
    { id: 'e', date: '2026-10-10', plate: 'P2', kilometers: 5000 },
  ]);
  assert.deepEqual(km, { c: 5000 });
});

test('buildInsights totals parts, tires, cost and parts per 1000 km', () => {
  const { vehicles, parts, fleetAvg } = buildInsights(
    [
      { id: 'c', date: '2026-10-10', plate: 'P1', parts: ['PNEU A (Qty: 2)', 'FILTRO (Qty: 3)', 'ÓLEO X (Qty: 23)'] },
      { id: 'e', date: '2026-10-10', plate: 'P2', parts: ['PNEU A (Qty: 1)'] },
    ],
    { c: 5000 },
    { 'pneu a': 160000, filtro: 1000, 'óleo x': 100 }
  );
  const p1 = vehicles.find((v) => v.plate === 'P1')!;
  assert.equal(p1.partUnits, 6); // oil line counts once
  assert.equal(p1.tireUnits, 2);
  assert.equal(p1.tireCost, 320000);
  assert.equal(p1.partsCost, 325300); // oil cost uses 23 litres
  assert.equal(p1.partsPer1000Km, 1.2);
  assert.equal(vehicles.find((v) => v.plate === 'P2')!.partsPer1000Km, null);
  const tire = parts.find((p) => p.name === 'PNEU A')!;
  assert.equal(tire.totalCost, 480000);
  assert.equal(tire.vehicles, 2);
  assert.equal(fleetAvg.tireUnits, 1.5);
});

test('lastSundayToSunday', () => {
  const sun = lastSundayToSunday(new Date(2026, 9, 25)); // Sunday
  assert.deepEqual([sun.from.getDate(), sun.to.getDate()], [18, 25]);
  const wed = lastSundayToSunday(new Date(2026, 9, 28));
  assert.deepEqual([wed.from.getDate(), wed.to.getDate()], [18, 25]);
});
