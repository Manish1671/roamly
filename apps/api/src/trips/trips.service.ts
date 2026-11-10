import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { CreateTripBody, UpdateTripBody } from '@roamly/shared';
import { PrismaService } from '../database/prisma.service';
import { TripAuthorizationService } from './trip-authorization.service';
import { toTripSummary } from './trip.mapper';

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: TripAuthorizationService,
  ) {}

  async createTrip(user: User, input: CreateTripBody) {
    const trip = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          name: input.name,
          destinationName: input.destinationName,
          countryCode: input.countryCode,
          startDate: parseDate(input.startDate),
          endDate: parseDate(input.endDate),
          budgetAmount: input.budgetAmount ? new Prisma.Decimal(input.budgetAmount) : null,
          budgetCurrency: input.budgetCurrency ?? null,
          createdById: user.id,
          memberships: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
        include: {
          memberships: { where: { userId: user.id } },
        },
      });

      return created;
    });

    const membership = trip.memberships[0];
    return toTripSummary(trip, membership);
  }

  async listTripsForUser(userId: string) {
    const rows = await this.prisma.tripMembership.findMany({
      where: { userId },
      include: { trip: true },
      orderBy: { trip: { startDate: 'asc' } },
    });
    return rows.map((row) => toTripSummary(row.trip, row));
  }

  async getTrip(userId: string, tripId: string) {
    const { trip, membership } = await this.authz.requireMembership(userId, tripId);
    this.authz.assertPermission(membership.role, 'VIEW_TRIP');
    return toTripSummary(trip, membership);
  }

  async updateTrip(userId: string, tripId: string, input: UpdateTripBody) {
    const { trip, membership } = await this.authz.requireMembership(userId, tripId);
    this.authz.assertPermission(membership.role, 'EDIT_TRIP');
    this.authz.assertTripWritable(trip);

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        name: input.name,
        destinationName: input.destinationName,
        countryCode: input.countryCode,
        startDate: input.startDate ? parseDate(input.startDate) : undefined,
        endDate: input.endDate ? parseDate(input.endDate) : undefined,
        budgetAmount:
          input.budgetAmount === undefined
            ? undefined
            : input.budgetAmount
              ? new Prisma.Decimal(input.budgetAmount)
              : null,
        budgetCurrency: input.budgetCurrency,
      },
    });

    return toTripSummary(updated, membership);
  }

  async archiveTrip(userId: string, tripId: string) {
    const { trip, membership } = await this.authz.requireMembership(userId, tripId);
    this.authz.assertPermission(membership.role, 'ARCHIVE');
    if (trip.archivedAt) {
      return toTripSummary(trip, membership);
    }

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: { archivedAt: new Date() },
    });

    return toTripSummary(updated, membership);
  }
}

function parseDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}
