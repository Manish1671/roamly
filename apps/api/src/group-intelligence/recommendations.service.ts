import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { MemberPreferenceInput, RecommendationEngineResult } from '@roamly/group-intelligence';
import { runRecommendationPipeline } from '@roamly/group-intelligence';
import type { RecommendationSnapshotDetail, RecommendationSnapshotSummary } from '@roamly/shared';
import { PrismaService } from '../database/prisma.service';
import { TripAuthorizationService } from '../trips/trip-authorization.service';
import { CuratedDestinationProvider } from './curated-destination.provider';
import { parseAvailability } from './preference.mapper';
import { presentRecommendationResult } from './recommendation-result.presenter';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: TripAuthorizationService,
    private readonly destinations: CuratedDestinationProvider,
  ) {}

  async generate(user: User, tripId: string) {
    const { trip, membership } = await this.authz.requireMembership(user.id, tripId);
    this.authz.assertPermission(membership.role, 'GENERATE_RECOMMENDATIONS');
    this.authz.assertTripWritable(trip);

    const participatingMembers = await this.prisma.tripMembership.findMany({
      where: { tripId, role: { in: ['OWNER', 'EDITOR', 'MEMBER'] } },
    });

    const preferences = await this.prisma.memberPreference.findMany({
      where: { tripId, userId: { in: participatingMembers.map((m) => m.userId) } },
    });

    const incomplete = participatingMembers.filter((m) => {
      const pref = preferences.find((p) => p.userId === m.userId);
      return !pref || pref.status !== 'COMPLETE';
    });

    if (incomplete.length > 0) {
      throw new BadRequestException(
        'All participating members must complete preferences before generating recommendations',
      );
    }

    const catalog = await this.destinations.listDestinations();
    if (catalog.length === 0) {
      throw new BadRequestException('Destination catalog is empty');
    }

    const memberDisplayNames = await this.loadMemberDisplayNames(tripId);

    const memberInputs = participatingMembers.map((m) => {
      const pref = preferences.find((p) => p.userId === m.userId);
      if (!pref) {
        throw new BadRequestException(
          'All participating members must complete preferences before generating recommendations',
        );
      }
      return this.toEngineMember(pref);
    });
    const tripContext = {
      tripId,
      tripDateRange:
        trip.startDate && trip.endDate
          ? {
              startDate: trip.startDate.toISOString().slice(0, 10),
              endDate: trip.endDate.toISOString().slice(0, 10),
            }
          : null,
    };

    const result = runRecommendationPipeline({
      trip: tripContext,
      members: memberInputs,
      destinations: catalog,
      memberDisplayNames,
    });

    result.generatedAt = new Date().toISOString();

    const snapshot = await this.prisma.recommendationSnapshot.create({
      data: {
        tripId,
        algorithmVersion: result.algorithmVersion,
        catalogVersion: result.catalogVersion,
        preferenceSnapshotJson: result.preferenceSnapshot as object,
        resultJson: result as object,
        createdById: user.id,
      },
    });

    return this.toDetail(snapshot.id, result, snapshot.createdAt, user.id);
  }

  async listForTrip(userId: string, tripId: string): Promise<RecommendationSnapshotSummary[]> {
    await this.authz.requireMembership(userId, tripId);
    const rows = await this.prisma.recommendationSnapshot.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toSummary(r));
  }

  async getById(userId: string, tripId: string, recommendationId: string): Promise<RecommendationSnapshotDetail> {
    await this.authz.requireMembership(userId, tripId);
    const row = await this.prisma.recommendationSnapshot.findFirst({
      where: { id: recommendationId, tripId },
    });
    if (!row) throw new NotFoundException('Recommendation snapshot not found');
    const raw = row.resultJson as unknown as RecommendationEngineResult;
    const memberDisplayNames = await this.loadMemberDisplayNames(tripId);
    const result = presentRecommendationResult(raw, memberDisplayNames);
    return {
      ...this.toSummary(row),
      result: {
        ranked: result.ranked,
        rejected: result.rejected,
        warnings: result.warnings,
        infeasible: result.infeasible,
        infeasibleReason: result.infeasibleReason,
        algorithmVersion: result.algorithmVersion,
        catalogVersion: result.catalogVersion,
        preferenceSnapshot: result.preferenceSnapshot,
      },
    };
  }

  private async loadMemberDisplayNames(tripId: string): Promise<Record<string, string>> {
    const memberships = await this.prisma.tripMembership.findMany({
      where: { tripId },
      include: { user: { select: { id: true, displayName: true } } },
    });
    return Object.fromEntries(memberships.map((m) => [m.userId, m.user.displayName]));
  }

  private toEngineMember(pref: {
    userId: string;
    status: string;
    budgetMin: { toNumber(): number } | null;
    budgetMax: { toNumber(): number } | null;
    budgetCurrency: string | null;
    budgetMaxIsHard: boolean;
    availabilityJson: unknown;
    interests: string[];
    travelStyle: string | null;
    climatePreference: string | null;
    destinationTypes: string[];
  }): MemberPreferenceInput {
    return {
      memberId: pref.userId,
      completionStatus: pref.status === 'COMPLETE' ? 'COMPLETE' : 'DRAFT',
      budget:
        pref.budgetMin && pref.budgetMax && pref.budgetCurrency
          ? {
              minPerPerson: pref.budgetMin.toNumber(),
              maxPerPerson: pref.budgetMax.toNumber(),
              currency: pref.budgetCurrency,
              maxIsHardConstraint: pref.budgetMaxIsHard,
            }
          : null,
      availability: parseAvailability(pref.availabilityJson),
      interests: pref.interests as MemberPreferenceInput['interests'],
      travelStyle: pref.travelStyle as MemberPreferenceInput['travelStyle'],
      climatePreference: pref.climatePreference as MemberPreferenceInput['climatePreference'],
      destinationTypes: pref.destinationTypes as MemberPreferenceInput['destinationTypes'],
    };
  }

  private toSummary(row: {
    id: string;
    tripId: string;
    algorithmVersion: string;
    catalogVersion: string;
    createdAt: Date;
    createdById: string | null;
    resultJson: unknown;
  }): RecommendationSnapshotSummary {
    const result = row.resultJson as unknown as RecommendationEngineResult;
    return {
      id: row.id,
      tripId: row.tripId,
      algorithmVersion: row.algorithmVersion,
      catalogVersion: row.catalogVersion,
      createdAt: row.createdAt.toISOString(),
      createdById: row.createdById,
      infeasible: Boolean(result.infeasible),
      topDestinationId: result.ranked[0]?.destinationId ?? null,
    };
  }

  private toDetail(
    id: string,
    result: RecommendationEngineResult,
    createdAt: Date,
    createdById: string,
  ): RecommendationSnapshotDetail {
    return {
      id,
      tripId: result.tripId,
      algorithmVersion: result.algorithmVersion,
      catalogVersion: result.catalogVersion,
      createdAt: createdAt.toISOString(),
      createdById,
      infeasible: result.infeasible,
      topDestinationId: result.ranked[0]?.destinationId ?? null,
      result,
    };
  }
}
