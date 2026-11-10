import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GeoProvider } from './index';

test('GeoProvider is a structural interface', () => {
  const stub: GeoProvider = {
    name: 'stub',
    async geocode() {
      return [];
    },
    async route() {
      return [];
    },
  };
  assert.equal(stub.name, 'stub');
});
