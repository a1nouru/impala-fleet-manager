import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysSince, lastDateByVehicle, cleaningStatus } from './status.ts';

test('daysSince counts whole days', () => {
  assert.equal(daysSince('2026-10-01', '2026-10-11'), 10);
  assert.equal(daysSince('2026-10-11', '2026-10-11'), 0);
});

test('lastDateByVehicle keeps the latest date per vehicle and ignores the other type', () => {
  const last = lastDateByVehicle(
    [
      { vehicle_id: 'a', type: 'deep_clean', cleaning_date: '2026-09-01' },
      { vehicle_id: 'a', type: 'deep_clean', cleaning_date: '2026-10-05' },
      { vehicle_id: 'a', type: 'insecticide', cleaning_date: '2026-10-10' },
      { vehicle_id: 'b', type: 'insecticide', cleaning_date: '2026-10-01' },
    ],
    'deep_clean'
  );
  assert.equal(last.get('a'), '2026-10-05');
  assert.equal(last.has('b'), false);
});

test('cleaningStatus is overdue only past the interval', () => {
  assert.equal(cleaningStatus(undefined, 'deep_clean', '2026-10-11'), 'never');
  assert.equal(cleaningStatus('2026-09-11', 'deep_clean', '2026-10-11'), 'ok'); // 30 days
  assert.equal(cleaningStatus('2026-09-10', 'deep_clean', '2026-10-11'), 'overdue'); // 31 days
});
