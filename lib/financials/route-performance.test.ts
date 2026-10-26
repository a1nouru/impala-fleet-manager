import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routePerformance } from './route-performance.ts';
import { corridorOf } from '../fuel/consumption.ts';

const r = (plate: string, route: string | null, ticket: number, expenses = 0) =>
  ({ plate, corridor: route ? corridorOf(route).corridor : null, ticket, baggage: 100, cargo: 50, expenses });

test('pools both directions and Mbanza/Luvu into one corridor', () => {
  const stats = routePerformance([
    r('A', 'LUANDA - MBANZA', 1000),
    r('A', 'LUVU - LUANDA', 2000, 500),
    r('B', 'HUAMBO - LUANDA', 3000),
    r('B', null, 9999),
  ]);
  assert.deepEqual(stats.map((s) => s.corridor), ['Luanda ⇄ Mbanza Kongo / Luvu', 'Luanda ⇄ Huambo']);
  const mbanza = stats[0].total;
  assert.equal(mbanza.trips, 2);
  assert.equal(mbanza.ticket, 3000);
  assert.equal(mbanza.baggage, 200);
  assert.equal(mbanza.revenue, 3300);
  assert.equal(mbanza.net, 2800);
  assert.equal(mbanza.revenuePerTrip, 1650);
});

test('vehicles within a corridor are sorted by revenue', () => {
  const [soyo] = routePerformance([
    r('A', 'LUANDA - SOYO', 1000),
    r('B', 'SOYO - LUANDA', 5000),
    r('B', 'LUANDA - SOYO', 5000),
  ]);
  assert.deepEqual(soyo.vehicles.map((v) => [v.name, v.trips]), [['B', 2], ['A', 1]]);
});

test('unknown routes keep their own name', () => {
  assert.equal(routePerformance([r('A', ' urubano ', 1)])[0].corridor, 'URUBANO');
});
