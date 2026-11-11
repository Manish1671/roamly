import { DEFAULT_MIN_PARTICIPATION_RATIO, type PollResultsView } from '@roamly/shared';

export function computePollResults(input: {
  pollId: string;
  status: 'OPEN' | 'CLOSED' | 'FINALIZED';
  destinationIds: string[];
  votes: Array<{ destinationId: string }>;
  eligibleMemberCount: number;
  minParticipationRatio?: number;
}): PollResultsView {
  const minRatio = input.minParticipationRatio ?? DEFAULT_MIN_PARTICIPATION_RATIO;
  const votedMemberCount = input.votes.length;
  const participationRatio =
    input.eligibleMemberCount === 0 ? 0 : votedMemberCount / input.eligibleMemberCount;

  const counts = new Map<string, number>();
  for (const id of input.destinationIds) {
    counts.set(id, 0);
  }
  for (const vote of input.votes) {
    if (!counts.has(vote.destinationId)) continue;
    counts.set(vote.destinationId, (counts.get(vote.destinationId) ?? 0) + 1);
  }

  const tallies = input.destinationIds.map((destinationId) => {
    const voteCount = counts.get(destinationId) ?? 0;
    const votePercent =
      votedMemberCount === 0 ? 0 : Math.round((voteCount / votedMemberCount) * 1000) / 10;
    return { destinationId, voteCount, votePercent };
  });

  const maxVotes = tallies.reduce((max, t) => Math.max(max, t.voteCount), 0);
  const leaders = tallies.filter((t) => t.voteCount === maxVotes && maxVotes > 0);
  const isTied = leaders.length > 1;
  const leadingDestinationId = leaders.length === 1 ? leaders[0].destinationId : null;

  let finalizeBlockReason: string | null = null;
  if (input.status !== 'CLOSED') {
    finalizeBlockReason = 'Poll must be closed before finalization';
  } else if (votedMemberCount === 0) {
    finalizeBlockReason = 'No votes were cast';
  } else if (participationRatio < minRatio) {
    finalizeBlockReason = `Participation below ${Math.round(minRatio * 100)}% threshold`;
  } else if (isTied) {
    finalizeBlockReason = 'Results are tied';
  }

  const hasSufficientParticipation =
    votedMemberCount > 0 && participationRatio >= minRatio && !isTied && leadingDestinationId !== null;

  const canFinalize = input.status === 'CLOSED' && hasSufficientParticipation;

  return {
    pollId: input.pollId,
    status: input.status,
    eligibleMemberCount: input.eligibleMemberCount,
    votedMemberCount,
    participationRatio: Math.round(participationRatio * 1000) / 1000,
    minParticipationRatio: minRatio,
    hasSufficientParticipation,
    isTied,
    leadingDestinationId,
    tallies,
    canFinalize,
    finalizeBlockReason,
  };
}
