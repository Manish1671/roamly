import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { RecommendationEngineResult } from '@roamly/group-intelligence';
import type {
  CastVoteBody,
  CreatePollBody,
  DestinationPollView,
  PollResultsView,
  TripDestinationDecisionView,
} from '@roamly/shared';
import { PrismaService } from '../database/prisma.service';
import { TripAuthorizationService } from '../trips/trip-authorization.service';
import { DestinationCatalogService } from './destination-catalog.service';
import { computePollResults } from './poll-results';

@Injectable()
export class DestinationPollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: TripAuthorizationService,
    private readonly catalog: DestinationCatalogService,
  ) {}

  async createPoll(user: User, tripId: string, body: CreatePollBody): Promise<DestinationPollView> {
    const { trip, membership } = await this.authz.requireMembership(user.id, tripId);
    this.authz.assertPermission(membership.role, 'MANAGE_POLL');
    this.authz.assertTripWritable(trip);

    const snapshot = await this.prisma.recommendationSnapshot.findFirst({
      where: { id: body.recommendationSnapshotId, tripId },
    });
    if (!snapshot) {
      throw new NotFoundException('Recommendation snapshot not found for this trip');
    }

    const rankedIds = rankedDestinationIds(snapshot.resultJson);
    if (rankedIds.length === 0) {
      throw new BadRequestException('Snapshot has no ranked destinations to vote on');
    }

    const destinationIds = body.destinationIds
      ? body.destinationIds.filter((id) => rankedIds.includes(id))
      : rankedIds;

    if (destinationIds.length === 0) {
      throw new BadRequestException('No valid destinations from this snapshot were selected');
    }

    try {
      const poll = await this.prisma.destinationPoll.create({
        data: {
          tripId,
          recommendationSnapshotId: snapshot.id,
          destinationIds,
          createdById: user.id,
        },
      });
      return this.toPollView(poll, null);
    } catch (err: unknown) {
      if (isPrismaUniqueViolation(err)) {
        throw new ConflictException('This trip already has an open destination poll');
      }
      throw err;
    }
  }

  async listPolls(userId: string, tripId: string): Promise<DestinationPollView[]> {
    await this.authz.requireMembership(userId, tripId);
    const polls = await this.prisma.destinationPoll.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
    });
    const votes = await this.prisma.destinationPollVote.findMany({
      where: { pollId: { in: polls.map((p) => p.id) }, userId },
    });
    const voteByPoll = new Map(votes.map((v) => [v.pollId, v]));
    return polls.map((p) => this.toPollView(p, voteByPoll.get(p.id) ?? null));
  }

  async getPoll(userId: string, tripId: string, pollId: string): Promise<DestinationPollView> {
    await this.authz.requireMembership(userId, tripId);
    const poll = await this.findPoll(tripId, pollId);
    const vote = await this.prisma.destinationPollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
    });
    return this.toPollView(poll, vote);
  }

  async castVote(
    user: User,
    tripId: string,
    pollId: string,
    body: CastVoteBody,
  ): Promise<DestinationPollView> {
    await this.authz.requireMembership(user.id, tripId);
    const membership = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId: user.id } },
    });
    if (!membership) throw new NotFoundException('Trip not found');
    this.authz.assertPermission(membership.role, 'VOTE_ON_POLL');

  return this.prisma.$transaction(async (tx) => {
      const poll = await tx.destinationPoll.findFirst({ where: { id: pollId, tripId } });
      if (!poll) throw new NotFoundException('Poll not found');
      if (poll.status !== 'OPEN') {
        throw new ConflictException('This poll is not accepting votes');
      }
      if (!poll.destinationIds.includes(body.destinationId)) {
        throw new BadRequestException('Destination is not on this poll');
      }

      const vote = await tx.destinationPollVote.upsert({
        where: { pollId_userId: { pollId, userId: user.id } },
        create: {
          pollId,
          userId: user.id,
          destinationId: body.destinationId,
        },
        update: { destinationId: body.destinationId },
      });

      return this.toPollView(poll, vote);
    });
  }

  async closePoll(user: User, tripId: string, pollId: string): Promise<DestinationPollView> {
    const { membership } = await this.authz.requireMembership(user.id, tripId);
    this.authz.assertPermission(membership.role, 'MANAGE_POLL');

    const updated = await this.prisma.destinationPoll.updateMany({
      where: { id: pollId, tripId, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    if (updated.count === 0) {
      const poll = await this.findPoll(tripId, pollId);
      if (poll.status === 'CLOSED' || poll.status === 'FINALIZED') {
        throw new ConflictException('Poll is already closed');
      }
      throw new NotFoundException('Poll not found');
    }

    const poll = await this.findPoll(tripId, pollId);
    const vote = await this.prisma.destinationPollVote.findUnique({
      where: { pollId_userId: { pollId, userId: user.id } },
    });
    return this.toPollView(poll, vote);
  }

  async getResults(userId: string, tripId: string, pollId: string): Promise<PollResultsView> {
    await this.authz.requireMembership(userId, tripId);
    const poll = await this.findPoll(tripId, pollId);
    return this.buildResults(poll);
  }

  async finalizePoll(
    user: User,
    tripId: string,
    pollId: string,
  ): Promise<TripDestinationDecisionView> {
    const { membership } = await this.authz.requireMembership(user.id, tripId);
    this.authz.assertPermission(membership.role, 'MANAGE_POLL');

    return this.prisma.$transaction(async (tx) => {
      const poll = await tx.destinationPoll.findFirst({ where: { id: pollId, tripId } });
      if (!poll) throw new NotFoundException('Poll not found');
      if (poll.status === 'FINALIZED') {
        throw new ConflictException('This poll has already been finalized');
      }
      if (poll.status !== 'CLOSED') {
        throw new ConflictException('Poll must be closed before finalization');
      }

      const votes = await tx.destinationPollVote.findMany({ where: { pollId } });
      const eligible = await tx.tripMembership.count({ where: { tripId } });
      const results = computePollResults({
        pollId,
        status: poll.status,
        destinationIds: poll.destinationIds,
        votes,
        eligibleMemberCount: eligible,
      });

      if (!results.canFinalize || !results.leadingDestinationId) {
        throw new BadRequestException(results.finalizeBlockReason ?? 'Cannot finalize this poll');
      }

      const existingDecision = await tx.tripDestinationDecision.findUnique({ where: { pollId } });
      if (existingDecision) {
        throw new ConflictException('A decision already exists for this poll');
      }

      const decision = await tx.tripDestinationDecision.create({
        data: {
          tripId,
          pollId,
          destinationId: results.leadingDestinationId,
          recommendationSnapshotId: poll.recommendationSnapshotId,
          finalizedById: user.id,
          eligibleMemberCount: eligible,
          votedMemberCount: votes.length,
          resultsSnapshotJson: results as object,
        },
      });

      await tx.destinationPoll.update({
        where: { id: pollId },
        data: { status: 'FINALIZED', finalizedAt: new Date() },
      });

      return this.toDecisionView(decision, results);
    });
  }

  async getLatestDecision(userId: string, tripId: string): Promise<TripDestinationDecisionView | null> {
    await this.authz.requireMembership(userId, tripId);
    const decision = await this.prisma.tripDestinationDecision.findFirst({
      where: { tripId },
      orderBy: { finalizedAt: 'desc' },
    });
    if (!decision) return null;
    const results = decision.resultsSnapshotJson as unknown as PollResultsView;
    return this.toDecisionView(decision, results);
  }

  private async buildResults(poll: {
    id: string;
    tripId: string;
    status: 'OPEN' | 'CLOSED' | 'FINALIZED';
    destinationIds: string[];
  }): Promise<PollResultsView> {
    const votes = await this.prisma.destinationPollVote.findMany({ where: { pollId: poll.id } });
    const eligible = await this.prisma.tripMembership.count({ where: { tripId: poll.tripId } });
    return computePollResults({
      pollId: poll.id,
      status: poll.status,
      destinationIds: poll.destinationIds,
      votes,
      eligibleMemberCount: eligible,
    });
  }

  private async findPoll(tripId: string, pollId: string) {
    const poll = await this.prisma.destinationPoll.findFirst({ where: { id: pollId, tripId } });
    if (!poll) throw new NotFoundException('Poll not found');
    return poll;
  }

  private toPollView(
    poll: {
      id: string;
      tripId: string;
      recommendationSnapshotId: string;
      status: 'OPEN' | 'CLOSED' | 'FINALIZED';
      destinationIds: string[];
      createdById: string;
      createdAt: Date;
      closedAt: Date | null;
      finalizedAt: Date | null;
    },
    vote: { destinationId: string } | null,
  ): DestinationPollView {
    return {
      id: poll.id,
      tripId: poll.tripId,
      recommendationSnapshotId: poll.recommendationSnapshotId,
      status: poll.status,
      destinationIds: poll.destinationIds,
      createdById: poll.createdById,
      createdAt: poll.createdAt.toISOString(),
      closedAt: poll.closedAt?.toISOString() ?? null,
      finalizedAt: poll.finalizedAt?.toISOString() ?? null,
      myVote: vote ? { destinationId: vote.destinationId } : null,
    };
  }

  private async toDecisionView(
    decision: {
      id: string;
      tripId: string;
      pollId: string;
      destinationId: string;
      recommendationSnapshotId: string;
      finalizedById: string;
      finalizedAt: Date;
      eligibleMemberCount: number;
      votedMemberCount: number;
    },
    results: PollResultsView,
  ): Promise<TripDestinationDecisionView> {
    let destinationName: string | null = null;
    try {
      const dest = await this.catalog.getById(decision.destinationId);
      destinationName = dest.name;
    } catch {
      destinationName = null;
    }
    return {
      id: decision.id,
      tripId: decision.tripId,
      pollId: decision.pollId,
      destinationId: decision.destinationId,
      destinationName,
      finalizedById: decision.finalizedById,
      finalizedAt: decision.finalizedAt.toISOString(),
      eligibleMemberCount: decision.eligibleMemberCount,
      votedMemberCount: decision.votedMemberCount,
      voteSnapshot: results,
      recommendationSnapshotId: decision.recommendationSnapshotId,
    };
  }
}

function rankedDestinationIds(resultJson: unknown): string[] {
  const result = resultJson as RecommendationEngineResult;
  return (result.ranked ?? []).map((row) => row.destinationId);
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
}
