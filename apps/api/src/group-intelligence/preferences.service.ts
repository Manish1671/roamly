import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { TripPreferencesOverview, TripPreferenceStatusView, UpsertMyPreferenceBody } from '@roamly/shared';
import { PrismaService } from '../database/prisma.service';
import { TripAuthorizationService } from '../trips/trip-authorization.service';
import { availabilityToJson, parseAvailability, toPreferenceView } from './preference.mapper';

const PARTICIPATING_ROLES = new Set(['OWNER', 'EDITOR', 'MEMBER']);

function isPreferenceComplete(data: {
  budgetMin: Prisma.Decimal | null;
  budgetMax: Prisma.Decimal | null;
  budgetCurrency: string | null;
  availabilityJson: unknown;
  interests: string[];
  travelStyle: string | null;
  climatePreference: string | null;
  destinationTypes: string[];
}): boolean {
  if (!data.budgetMin || !data.budgetMax || !data.budgetCurrency) return false;
  if (parseAvailability(data.availabilityJson).length === 0) return false;
  if (data.interests.length === 0) return false;
  if (!data.travelStyle || !data.climatePreference) return false;
  if (data.destinationTypes.length === 0) return false;
  return true;
}

@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: TripAuthorizationService,
  ) {}

  async getOverview(userId: string, tripId: string): Promise<TripPreferencesOverview> {
    await this.authz.requireMembership(userId, tripId);

    const mine = await this.prisma.memberPreference.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });

    const status = await this.buildStatus(tripId);
    return {
      myPreference: mine ? toPreferenceView(mine) : null,
      status,
    };
  }

  async getStatus(userId: string, tripId: string): Promise<TripPreferenceStatusView> {
    await this.authz.requireMembership(userId, tripId);
    return this.buildStatus(tripId);
  }

  async upsertMyPreference(user: User, tripId: string, body: UpsertMyPreferenceBody) {
    const { trip, membership } = await this.authz.requireMembership(user.id, tripId);
    this.authz.assertPermission(membership.role, 'SUBMIT_PREFERENCES');
    this.authz.assertTripWritable(trip);

    if (!PARTICIPATING_ROLES.has(membership.role)) {
      throw new ForbiddenException('Viewers cannot submit preferences');
    }

    const existing = await this.prisma.memberPreference.findUnique({
      where: { tripId_userId: { tripId, userId: user.id } },
    });

    const merged = {
      status: body.status ?? existing?.status ?? 'DRAFT',
      budgetMin:
        body.budgetMin !== undefined
          ? body.budgetMin
            ? new Prisma.Decimal(body.budgetMin)
            : null
          : (existing?.budgetMin ?? null),
      budgetMax:
        body.budgetMax !== undefined
          ? body.budgetMax
            ? new Prisma.Decimal(body.budgetMax)
            : null
          : (existing?.budgetMax ?? null),
      budgetCurrency: body.budgetCurrency ?? existing?.budgetCurrency ?? null,
      budgetMaxIsHard: body.budgetMaxIsHard ?? existing?.budgetMaxIsHard ?? false,
      availabilityJson:
        body.availability !== undefined
          ? availabilityToJson(body.availability)
          : (existing?.availabilityJson ?? []),
      interests: body.interests ?? existing?.interests ?? [],
      travelStyle: body.travelStyle ?? existing?.travelStyle ?? null,
      climatePreference: body.climatePreference ?? existing?.climatePreference ?? null,
      destinationTypes: body.destinationTypes ?? existing?.destinationTypes ?? [],
    };

    if (merged.status === 'COMPLETE' && !isPreferenceComplete(merged)) {
      throw new BadRequestException('Complete preferences require budget, availability, interests, style, climate, and destination types');
    }

    if (merged.status === 'DRAFT' && isPreferenceComplete(merged)) {
      merged.status = 'COMPLETE';
    }

    const row = await this.prisma.memberPreference.upsert({
      where: { tripId_userId: { tripId, userId: user.id } },
      create: {
        tripId,
        userId: user.id,
        ...merged,
        status: merged.status as 'DRAFT' | 'COMPLETE',
      },
      update: {
        ...merged,
        status: merged.status as 'DRAFT' | 'COMPLETE',
      },
    });

    return toPreferenceView(row);
  }

  private async buildStatus(tripId: string): Promise<TripPreferenceStatusView> {
    const members = await this.prisma.tripMembership.findMany({
      where: { tripId, role: { in: ['OWNER', 'EDITOR', 'MEMBER'] } },
      include: { user: true },
    });
    const prefs = await this.prisma.memberPreference.findMany({ where: { tripId } });
    const byUser = new Map(prefs.map((p) => [p.userId, p]));

    const items = members.map((m) => {
      const pref = byUser.get(m.userId);
      let status: 'NOT_STARTED' | 'DRAFT' | 'COMPLETE' = 'NOT_STARTED';
      if (pref) {
        status = pref.status === 'COMPLETE' ? 'COMPLETE' : 'DRAFT';
      }
      return {
        userId: m.userId,
        displayName: m.user.displayName,
        role: m.role,
        status,
      };
    });

    return {
      totalMembers: items.length,
      completedCount: items.filter((i) => i.status === 'COMPLETE').length,
      draftCount: items.filter((i) => i.status === 'DRAFT').length,
      notStartedCount: items.filter((i) => i.status === 'NOT_STARTED').length,
      members: items,
    };
  }
}
