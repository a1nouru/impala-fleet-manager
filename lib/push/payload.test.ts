import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPushPayload } from './payload.ts';

test('buildPushPayload defaults url to /dashboard and encodes fields', () => {
  const json = buildPushPayload({ title: 'Alert', body: 'Fuel over budget' });
  const parsed = JSON.parse(json);
  assert.equal(parsed.title, 'Alert');
  assert.equal(parsed.body, 'Fuel over budget');
  assert.equal(parsed.url, '/dashboard');
});

test('buildPushPayload keeps a provided url', () => {
  const json = buildPushPayload({ title: 'A', body: 'B', url: '/dashboard/notifications' });
  assert.equal(JSON.parse(json).url, '/dashboard/notifications');
});
