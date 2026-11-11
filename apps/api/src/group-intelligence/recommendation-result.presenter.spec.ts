import type { RecommendationEngineResult } from '@roamly/group-intelligence';
import { presentRecommendationResult } from './recommendation-result.presenter';

describe('presentRecommendationResult', () => {
  const memberId = 'cbdac91f-974e-4e6b-8ace-b688cddcc161';

  it('replaces legacy uuid rejection copy with display names', () => {
    const result: RecommendationEngineResult = {
      algorithmVersion: 'group-intelligence-v1.0.0',
      catalogVersion: 'india-curated-v1',
      generatedAt: '2026-01-01T00:00:00.000Z',
      tripId: 'trip-1',
      preferenceSnapshot: { members: [], trip: { tripId: 'trip-1', tripDateRange: null } },
      rejected: [
        {
          destinationId: 'in-goa',
          reasons: [
            `Indicative minimum budget at Goa exceeds hard maximum for member ${memberId}`,
          ],
        },
      ],
      ranked: [],
      warnings: [`Lowest member compatibility (${memberId}) may need discussion`],
      infeasible: true,
    };

    const presented = presentRecommendationResult(result, { [memberId]: 'Manish Tiwari' });
    expect(presented.rejected[0].reasons[0]).toContain('Manish Tiwari');
    expect(presented.rejected[0].reasons[0]).not.toContain(memberId);
    expect(presented.warnings[0]).toContain('Manish Tiwari');
  });
});
