import { computePollResults } from './poll-results';

describe('computePollResults', () => {
  const base = {
    pollId: 'p1',
    status: 'CLOSED' as const,
    destinationIds: ['a', 'b', 'c'],
    eligibleMemberCount: 4,
  };

  it('detects ties and blocks finalization', () => {
    const result = computePollResults({
      ...base,
      votes: [{ destinationId: 'a' }, { destinationId: 'b' }],
    });
    expect(result.isTied).toBe(true);
    expect(result.canFinalize).toBe(false);
    expect(result.finalizeBlockReason).toMatch(/tied/i);
  });

  it('blocks zero votes', () => {
    const result = computePollResults({ ...base, votes: [] });
    expect(result.canFinalize).toBe(false);
    expect(result.finalizeBlockReason).toMatch(/No votes/);
  });

  it('blocks insufficient participation', () => {
    const result = computePollResults({
      ...base,
      votes: [{ destinationId: 'a' }],
    });
    expect(result.canFinalize).toBe(false);
    expect(result.finalizeBlockReason).toMatch(/Participation/);
  });

  it('allows finalization with clear winner and enough votes', () => {
    const result = computePollResults({
      ...base,
      votes: [
        { destinationId: 'a' },
        { destinationId: 'a' },
        { destinationId: 'b' },
      ],
    });
    expect(result.leadingDestinationId).toBe('a');
    expect(result.canFinalize).toBe(true);
    expect(result.tallies.find((t) => t.destinationId === 'a')?.votePercent).toBe(66.7);
  });
});
