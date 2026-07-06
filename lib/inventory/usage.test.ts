import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeItemName,
  usedQuantitiesByNormalizedName,
  availableByNormalizedName,
} from './usage.ts';

test('normalizeItemName trims, lowercases, and collapses internal whitespace', () => {
  assert.equal(normalizeItemName('  MAMBA   GEAR OIL  '), 'mamba gear oil');
  assert.equal(normalizeItemName(null), '');
  assert.equal(normalizeItemName(undefined), '');
});

test('used qty matches inventory despite case and trailing-space differences (stuck-inventory regression)', () => {
  // Inventory row stored with trailing space + uppercase...
  const inventory = [{ item_name: 'MAMBA GEAR OIL ', quantity: 20 }];
  // ...maintenance record stored a differently-cased/spaced form of the same name.
  const records = [{ parts: ['mamba gear oil (Qty: 5)'] }];

  const used = usedQuantitiesByNormalizedName(records);
  const available = availableByNormalizedName(inventory, used);

  // Must decrement to 15, not stay stuck at 20.
  assert.equal(available[normalizeItemName('MAMBA GEAR OIL ')], 15);
});

test('exact-name match still decrements to zero', () => {
  const inventory = [{ item_name: 'Bombito de tras', quantity: 2 }];
  const records = [{ parts: ['Bombito de tras (Qty: 2)'] }];

  const used = usedQuantitiesByNormalizedName(records);
  const available = availableByNormalizedName(inventory, used);

  assert.equal(available[normalizeItemName('Bombito de tras')], 0);
});

test('near-duplicate inventory names pool into a single available figure', () => {
  // Two batches, same item entered with different case/spacing.
  const inventory = [
    { item_name: 'Filtro de Oleo', quantity: 10 },
    { item_name: 'FILTRO DE OLEO ', quantity: 5 },
  ];
  const records = [{ parts: ['filtro de oleo (Qty: 12)'] }];

  const used = usedQuantitiesByNormalizedName(records);
  const available = availableByNormalizedName(inventory, used);

  // Pooled: (10 + 5) − 12 = 3.
  assert.equal(available[normalizeItemName('Filtro de Oleo')], 3);
});

test('available is floored at zero (never negative)', () => {
  const inventory = [{ item_name: 'Nut', quantity: 1 }];
  const records = [{ parts: ['Nut (Qty: 5)'] }];

  const used = usedQuantitiesByNormalizedName(records);
  const available = availableByNormalizedName(inventory, used);

  assert.equal(available[normalizeItemName('Nut')], 0);
});

test('custom / free-text parts are ignored, legacy quantity-less names count as one', () => {
  const used = usedQuantitiesByNormalizedName([
    { parts: ['Some free note (Custom)', 'Category: value', 'Legacy Bolt'] },
  ]);
  assert.equal(used[normalizeItemName('Some free note')], undefined);
  assert.equal(used[normalizeItemName('Legacy Bolt')], 1);
});

test('non-array / malformed parts do not throw', () => {
  const used = usedQuantitiesByNormalizedName([
    { parts: null },
    {},
    { parts: [42, null, 'Real (Qty: 2)'] },
  ] as any);
  assert.equal(used[normalizeItemName('Real')], 2);
});
