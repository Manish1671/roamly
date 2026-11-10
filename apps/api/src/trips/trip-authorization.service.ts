import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Trip, TripMembership, TripRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { roleHasPermission, type TripPermission } from './trip-permissions';

export interface TripAccessContext {
  trip: Trip;
  membership: TripMembership;
}

@Injectable()
export class TripAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(userId: string, tripId: string): Promise<TripAccessContext> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const membership = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });

    if (!membership) {
      throw new NotFoundException('Trip not found');
    }

    return { trip, membership };
  }

  assertPermission(role: TripRole, permission: TripPermission): void {
    if (!roleHasPermission(role, permission)) {
      throw new ForbiddenException('You do not have permission for this action');
    }
  }

  assertTripWritable(trip: Trip): void {
    if (trip.archivedAt) {
      throw new ForbiddenException('This trip is archived and read-only');
    }
  }

  async countOwners(tripId: string): Promise<number> {
    return this.prisma.tripMembership.count({
      where: { tripId, role: 'OWNER' },
    });
  }
}
