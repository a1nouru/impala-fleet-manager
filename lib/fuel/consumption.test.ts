import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFuel, corridorOf, weekStart, isFuelCategory } from './consumption.ts';

test('corridorOf pools both directions and Mbanza with Luvu', () => {
  assert.equal(corridorOf('LUANDA - HUAMBO').corridor, corridorOf('HUAMBO - LUANDA').corridor);
  assert.equal(corridorOf('LUVU - LUANDA').corridor, corridorOf('LUANDA - MBANZA').corridor);
  assert.equal(corridorOf('LUVU - LUANDA').km, 530);
  assert.deepEqual(corridorOf('URUBANO'), { corridor: 'URUBANO', km: null });
});

test('weekStart is the Monday and isFuelCategory matches legacy spellings', () => {
  assert.equal(weekStart('2026-10-11'), '2026-10-05'); // Sunday
  assert.equal(weekStart('2026-10-05'), '2026-10-05');
  assert.ok(isFuelCategory('Fuel') && isFuelCategory('Gasóleo ') && isFuelCategory('GASOLEO'));
  assert.ok(!isFuelCategory('OFICINA'));
});

test('analyzeFuel compares per corridor, attributes standalone fuel and drivers', () => {
  const trips = [
    ...['2026-10-01', '2026-10-02', '2026-10-03'].map((date, i) => ({ vehicleId: 'a', plate: 'A', date, route: i % 2 ? 'HUAMBO - LUANDA' : 'LUANDA - HUAMBO' })),
    ...['2026-10-01', '2026-10-02', '2026-10-03'].map((date) => ({ vehicleId: 'b', plate: 'B', date, route: 'LUANDA - HUAMBO' })),
    { vehicleId: 'c', plate: 'C', date: '2026-10-01', route: 'LUANDA - SOYO' },
  ];
  const fuel = [
    { vehicleId: 'a', plate: 'A', date: '2026-10-01', route: 'LUANDA - HUAMBO', liters: 300, driver: 'João' },
    { vehicleId: 'a', plate: 'A', date: '2026-10-04', route: null, liters: 300, driver: null }, // standalone → last route
    { vehicleId: 'b', plate: 'B', date: '2026-10-02', route: 'LUANDA - HUAMBO', liters: 400, driver: 'Pedro' },
    { vehicleId: 'c', plate: 'C', date: '2026-10-01', route: 'LUANDA - SOYO', liters: 999, driver: null },
    { vehicleId: 'a', plate: 'A', date: '2026-09-01', route: 'LUANDA - HUAMBO', liters: 999, driver: null }, // out of range
  ];
  const [huambo, soyo] = analyzeFuel(trips, fuel, '2026-10-01', '2026-10-10');
  assert.equal(huambo.corridor, 'Luanda ⇄ Huambo');
  assert.equal(soyo.vehicles.length, 1); // C never compared with A/B
  const a = huambo.vehicles.find((v) => v.name === 'A')!;
  assert.equal(a.liters, 600);
  assert.equal(a.km, 1800);
  assert.equal(huambo.worst?.name, 'A'); // 33.3 vs 22.2 L/100km
  assert.equal(huambo.worst?.driver, 'João');
  // João drives A from 10-01 on (3 trips); Pedro B only from 10-02 (2 trips).
  assert.deepEqual(huambo.drivers.map((d) => [d.name, d.trips, d.liters]), [['João', 3, 600], ['Pedro', 2, 400]]);
  assert.equal(huambo.weekly.length, 1);
});
