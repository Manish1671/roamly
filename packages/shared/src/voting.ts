import { z } from 'zod';

export const pollStatuses = ['OPEN', 'CLOSED', 'FINALIZED'] as const;
export type PollStatus = (typeof pollStatuses)[number];

/** Minimum share of eligible members who must vote before finalization (default 50%). */
export const DEFAULT_MIN_PARTICIPATION_RATIO = 0.5;

export const createPollBodySchema = z.object({
  recommendationSnapshotId: z.string().uuid(),
  destinationIds: z.array(z.string().min(1)).min(1).max(30).optional(),
});

export const castVoteBodySchema = z.object({
  destinationId: z.string().min(1),
});

export type CreatePollBody = z.infer<typeof createPollBodySchema>;
export type CastVoteBody = z.infer<typeof castVoteBodySchema>;

export interface DestinationPollView {
  id: string;
  tripId: string;
  recommendationSnapshotId: string;
  status: PollStatus;
  destinationIds: string[];
  createdById: string;
  createdAt: string;
  closedAt: string | null;
  finalizedAt: string | null;
  myVote: { destinationId: string } | null;
}

export interface PollDestinationTally {
  destinationId: string;
  voteCount: number;
  votePercent: number;
}

export interface PollResultsView {
  pollId: string;
  status: PollStatus;
  eligibleMemberCount: number;
  votedMemberCount: number;
  participationRatio: number;
  minParticipationRatio: number;
  hasSufficientParticipation: boolean;
  isTied: boolean;
  leadingDestinationId: string | null;
  tallies: PollDestinationTally[];
  canFinalize: boolean;
  finalizeBlockReason: string | null;
}

export interface TripDestinationDecisionView {
  id: string;
  tripId: string;
  pollId: string;
  destinationId: string;
  destinationName: string | null;
  finalizedById: string;
  finalizedAt: string;
  eligibleMemberCount: number;
  votedMemberCount: number;
  voteSnapshot: PollResultsView;
  recommendationSnapshotId: string;
}
