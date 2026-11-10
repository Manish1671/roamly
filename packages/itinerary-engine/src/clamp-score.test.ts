import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampScore } from './index';

test('clampScore limits values to 0–100', () => {
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(50), 50);
  assert.equal(clampScore(150), 100);
});
