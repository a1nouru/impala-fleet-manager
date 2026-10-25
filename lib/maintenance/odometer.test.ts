import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neighbourReadings, validateOdometer } from './odometer.ts';

const records = [
  { id: '1', vehicle_id: 'a', date: '2026-10-01', kilometers: 100_000 },
  { id: '2', vehicle_id: 'a', date: '2026-10-05T00:00:00', kilometers: 104_000 },
  { id: '3', vehicle_id: 'a', date: '2026-10-08', kilometers: 0 }, // no reading
  { id: '4', vehicle_id: 'a', date: '2026-10-20', kilometers: 120_000 },
  { id: '5', vehicle_id: 'b', date: '2026-10-09', kilometers: 900_000 },
];

test('neighbourReadings picks the closest earlier and later readings of the same vehicle', () => {
  assert.deepEqual(neighbourReadings(records, 'a', '2026-10-10'), {
    previous: { km: 104_000, date: '2026-10-05' },
    next: { km: 120_000, date: '2026-10-20' },
  });
  assert.deepEqual(neighbourReadings(records, 'c', '2026-10-10'), { previous: undefined, next: undefined });
});

test('neighbourReadings excludes the record being edited', () => {
  assert.deepEqual(neighbourReadings(records, 'a', '2026-10-05', '2').previous, { km: 100_000, date: '2026-10-01' });
});

test('validateOdometer rejects non-positive, fractional and absurd readings', () => {
  assert.equal(validateOdometer(0, '2026-10-10'), 'invalid');
  assert.equal(validateOdometer(-5, '2026-10-10'), 'invalid');
  assert.equal(validateOdometer(NaN, '2026-10-10'), 'invalid');
  assert.equal(validateOdometer(12.5, '2026-10-10'), 'invalid');
  assert.equal(validateOdometer(2_000_001, '2026-10-10'), 'tooHigh');
  assert.equal(validateOdometer(2_000_000, '2026-10-10'), null);
});

test('validateOdometer enforces order against previous and next readings', () => {
  const previous = { km: 104_000, date: '2026-10-05' };
  const next = { km: 120_000, date: '2026-10-20' };
  assert.equal(validateOdometer(103_999, '2026-10-10', previous, next), 'belowPrevious');
  assert.equal(validateOdometer(104_000, '2026-10-10', previous, next), null);
  assert.equal(validateOdometer(110_000, '2026-10-10', previous, next), null);
  assert.equal(validateOdometer(109_001, '2026-10-19', { km: 108_000, date: '2026-10-18' }, { km: 109_000, date: '2026-10-20' }), 'aboveNext');
});

test('validateOdometer caps the jump at 1,500 km per elapsed day (min 1 day)', () => {
  const previous = { km: 100_000, date: '2026-10-05' };
  assert.equal(validateOdometer(101_500, '2026-10-05', previous), null); // same day counts as 1
  assert.equal(validateOdometer(101_501, '2026-10-05', previous), 'implausibleJump');
  assert.equal(validateOdometer(107_500, '2026-10-10', previous), null); // 5 days
  assert.equal(validateOdometer(107_501, '2026-10-10', previous), 'implausibleJump');
});
