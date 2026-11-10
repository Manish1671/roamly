import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROAMLY_APP_NAME } from './index';

test('ROAMLY_APP_NAME is defined', () => {
  assert.equal(ROAMLY_APP_NAME, 'Roamly');
});
