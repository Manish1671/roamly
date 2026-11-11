import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateHardConstraints } from './constraints.js';
import { runRecommendationPipeline } from './pipeline.js';
import { scoreMemberDestination } from './scoring.js';
import { DEFAULT_ENGINE_CONFIG } from './config.js';
import type { MemberPreferenceInput, NormalizedDestination } from './types.js';

const baseDest = (overrides: Partial<NormalizedDestination> = {}): NormalizedDestination => ({
  id: 'dest-goa',
  slug: 'goa',
  name: 'Goa',
  countryCode: 'IN',
  region: 'Goa',
  description: 'Beaches and culture',
  destinationTypes: ['BEACHES', 'CITIES'],
  interestTags: ['BEACHES', 'NIGHTLIFE', 'FOOD'],
  travelStyleTags: ['BUDGET', 'BALANCED'],
  climateProfile: 'WARM',
  activityTags: ['beach'],
  budgetPerPerson: {
    minPerPerson: 15000,
    maxPerPerson: 35000,
    currency: 'INR',
    isEstimate: true,
  },
  catalogVersion: 'india-curated-v1',
  provenance: 'curated',
  ...overrides,
});

const member = (id: string, patch: Partial<MemberPreferenceInput> = {}): MemberPreferenceInput => ({
  memberId: id,
  completionStatus: 'COMPLETE',
  budget: { minPerPerson: 10000, maxPerPerson: 40000, currency: 'INR', maxIsHardConstraint: false },
  availability: [{ startDate: '2027-06-01', endDate: '2027-06-14' }],
  interests: ['BEACHES', 'FOOD'],
  travelStyle: 'BALANCED',
  climatePreference: 'WARM',
  destinationTypes: ['BEACHES'],
  ...patch,
});

describe('group intelligence constraints', () => {
  it('rejects destination above hard budget cap', () => {
    const reasons = evaluateHardConstraints(
      baseDest({ budgetPerPerson: { minPerPerson: 50000, maxPerPerson: 80000, currency: 'INR', isEstimate: true } }),
      [
        member('a', {
          budget: { minPerPerson: 5000, maxPerPerson: 20000, currency: 'INR', maxIsHardConstraint: true },
        }),
      ],
      (id) => (id === 'a' ? 'Alex' : 'Member'),
    );
    assert.ok(reasons.some((r) => r.includes('Alex') && r.includes('hard per-person maximum')));
    assert.ok(!reasons.some((r) => r.includes('member a')));
  });

  it('rejects when availability does not overlap', () => {
    const reasons = evaluateHardConstraints(baseDest(), [
      member('a', { availability: [{ startDate: '2027-06-01', endDate: '2027-06-05' }] }),
      member('b', { availability: [{ startDate: '2027-07-01', endDate: '2027-07-10' }] }),
    ]);
    assert.ok(reasons.length > 0);
  });

  it('rejects currency mismatch instead of comparing amounts across currencies', () => {
    const reasons = evaluateHardConstraints(baseDest(), [
      member('a', {
        budget: {
          minPerPerson: 1,
          maxPerPerson: 100,
          currency: 'USD',
          maxIsHardConstraint: true,
        },
      }),
    ]);
    assert.ok(reasons.some((r) => r.includes('currency mismatch')));
    assert.ok(!reasons.some((r) => r.includes('hard maximum')));
  });

  it('applies hard budget only when currencies match', () => {
    const reasons = evaluateHardConstraints(
      baseDest({
        budgetPerPerson: { minPerPerson: 50000, maxPerPerson: 70000, currency: 'INR', isEstimate: true },
      }),
      [
        member('a', {
          budget: {
            minPerPerson: 5000,
            maxPerPerson: 20000,
            currency: 'INR',
            maxIsHardConstraint: true,
          },
        }),
      ],
    );
    assert.ok(reasons.some((r) => r.includes('indicative minimum')));
  });

  it('allows affordable destinations when hard max is 22000 INR', () => {
    const reasons = evaluateHardConstraints(baseDest(), [
      member('a', {
        budget: { minPerPerson: 5000, maxPerPerson: 22000, currency: 'INR', maxIsHardConstraint: true },
      }),
    ]);
    assert.equal(reasons.filter((r) => r.includes('hard per-person maximum')).length, 0);
  });

  it('rejects Andaman minimum when hard max is 22000 INR', () => {
    const reasons = evaluateHardConstraints(
      baseDest({
        id: 'in-andaman',
        name: 'Andaman Islands',
        budgetPerPerson: { minPerPerson: 35000, maxPerPerson: 80000, currency: 'INR', isEstimate: true },
      }),
      [
        member('a', {
          budget: { minPerPerson: 5000, maxPerPerson: 22000, currency: 'INR', maxIsHardConstraint: true },
        }),
      ],
      () => 'Pat',
    );
    assert.equal(reasons.length, 1);
    assert.ok(reasons[0].includes('Pat'));
    assert.ok(reasons[0].includes('35,000'));
  });
});

describe('group intelligence scoring', () => {
  it('does not numerically compare mismatched currencies in soft budget scoring', () => {
    const scored = scoreMemberDestination(
      member('a', {
        budget: {
          minPerPerson: 100,
          maxPerPerson: 200,
          currency: 'USD',
          maxIsHardConstraint: false,
        },
      }),
      baseDest(),
      DEFAULT_ENGINE_CONFIG,
    );
    assert.ok(scored.notes.some((n) => n.includes('not comparable')));
  });

  it('uses lower score for missing preferences', () => {
    const withData = scoreMemberDestination(member('a'), baseDest(), DEFAULT_ENGINE_CONFIG).total;
    const missing = scoreMemberDestination(
      member('b', { interests: [], travelStyle: null, destinationTypes: [] }),
      baseDest(),
      DEFAULT_ENGINE_CONFIG,
    ).total;
    assert.ok(missing < withData);
  });

  it('applies fairness weighting', () => {
    const result = runRecommendationPipeline({
      trip: { tripId: 'trip-1', tripDateRange: null },
      members: [
        member('high'),
        member('low', { interests: ['SHOPPING'], travelStyle: 'LUXURY', destinationTypes: ['MOUNTAINS'] }),
      ],
      destinations: [baseDest()],
    });
    assert.equal(result.ranked.length, 1);
    assert.ok(result.ranked[0].groupScore <= result.ranked[0].averageMemberScore);
  });
});

describe('group intelligence ranking', () => {
  it('ranks deterministically with stable tie-break', () => {
    const result = runRecommendationPipeline({
      trip: { tripId: 't', tripDateRange: null },
      members: [member('solo')],
      destinations: [
        baseDest({ id: 'b-dest', slug: 'b' }),
        baseDest({ id: 'a-dest', slug: 'a', interestTags: ['SHOPPING'] }),
      ],
    });
    assert.ok(result.ranked.length >= 1);
    const ids = result.ranked.map((r) => r.destinationId);
    const again = runRecommendationPipeline({
      trip: { tripId: 't', tripDateRange: null },
      members: [member('solo')],
      destinations: [
        baseDest({ id: 'b-dest', slug: 'b' }),
        baseDest({ id: 'a-dest', slug: 'a', interestTags: ['SHOPPING'] }),
      ],
    });
    assert.deepEqual(again.ranked.map((r) => r.destinationId), ids);
  });
});
