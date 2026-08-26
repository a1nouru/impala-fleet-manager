import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  passengerRevenue,
  rowTotal,
  entryTotals,
  slipsTotal,
  depositVariance,
  expensesTotal,
  netRevenue,
  selectableVehicles,
  PASSENGER_FARE_AOA,
} from './revenue.ts';
import { BUS_STATIONS, busStationLabel } from './stations.ts';

test('passengerRevenue multiplies the passenger count by the 1,000 Kz fare', () => {
  assert.equal(PASSENGER_FARE_AOA, 1000);
  assert.equal(passengerRevenue(20), 20000);
});

test('passengerRevenue is zero for zero, empty, or nonsense counts', () => {
  assert.equal(passengerRevenue(0), 0);
  assert.equal(passengerRevenue(NaN), 0);
  assert.equal(passengerRevenue(-5), 0);
  assert.equal(passengerRevenue(null), 0);
});

test('rowTotal adds derived passenger revenue and typed cargo', () => {
  assert.equal(rowTotal({ passenger_count: 20, cargo_amount: 5000 }), 25000);
  assert.equal(rowTotal({ passenger_count: 13, cargo_amount: 0 }), 13000);
  assert.equal(rowTotal({ passenger_count: 0, cargo_amount: 7500 }), 7500);
  assert.equal(rowTotal({}), 0);
});

test('entryTotals aggregates passenger, cargo, and grand total across rows', () => {
  const rows = [
    { passenger_count: 20, cargo_amount: 5000 },
    { passenger_count: 13, cargo_amount: 0 },
  ];
  assert.deepEqual(entryTotals(rows), {
    passengerCount: 33,
    passengerRevenue: 33000,
    cargoRevenue: 5000,
    total: 38000,
  });
});

test('entryTotals returns all zeros for no rows', () => {
  assert.deepEqual(entryTotals([]), {
    passengerCount: 0,
    passengerRevenue: 0,
    cargoRevenue: 0,
    total: 0,
  });
});

test('slipsTotal sums slip amounts, ignoring blank ones', () => {
  assert.equal(slipsTotal([{ amount: 30000 }, { amount: null }, {}]), 30000);
  assert.equal(slipsTotal([]), 0);
});

test('depositVariance reports deposited minus earned', () => {
  const rows = [{ passenger_count: 20, cargo_amount: 5000 }];
  assert.equal(depositVariance(rows, [{ amount: 30000 }]), 5000);
  assert.equal(depositVariance(rows, [{ amount: 20000 }]), -5000);
});

test('expensesTotal sums park expenses, ignoring blank or negative amounts', () => {
  assert.equal(
    expensesTotal([{ amount: 4000 }, { amount: 5000 }, { amount: null }, {}, { amount: -100 }]),
    9000
  );
  assert.equal(expensesTotal([]), 0);
});

test('netRevenue subtracts park expenses from the entry total', () => {
  const rows = [{ passenger_count: 20, cargo_amount: 5000 }];
  assert.equal(netRevenue(rows, [{ amount: 4000 }, { amount: 5000 }]), 16000);
  assert.equal(netRevenue(rows, []), 25000);
});

test('selectableVehicles drops quarantined ghost plates only', () => {
  const vehicles = [
    { id: '1', plate: 'LDA-29-14-AE', is_active: true },
    { id: '2', plate: 'LDA-29-14-AE..', is_active: false },
    { id: '3', plate: 'LDA-25-91-AD' },
  ];
  assert.deepEqual(selectableVehicles(vehicles).map((v) => v.plate), [
    'LDA-29-14-AE',
    'LDA-25-91-AD',
  ]);
});

test('BUS_STATIONS exposes exactly the two stations with their labels', () => {
  assert.deepEqual(BUS_STATIONS.map((s) => s.id), ['mbanza_congo', 'nosso_centro']);
  assert.equal(busStationLabel('mbanza_congo'), 'Mbanza Congo');
  assert.equal(busStationLabel('nosso_centro'), 'Nosso Centro');
  assert.equal(busStationLabel('nope'), '—');
});
