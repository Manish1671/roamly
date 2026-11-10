import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROAMLY_APP_NAME } from '@roamly/shared';

test('web workspace can import @roamly/shared', () => {
  assert.equal(ROAMLY_APP_NAME, 'Roamly');
});
