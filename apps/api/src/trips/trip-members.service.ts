import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { TripRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TripAuthorizationService } from './trip-authorization.service';
import { toTripMemberView } from './trip.mapper';

@Injectable()
export class TripMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: TripAuthorizationService,
  ) {}

  async listMembers(userId: string, tripId: string) {
    const { membership } = await this.authz.requireMembership(userId, tripId);
    this.authz.assertPermission(membership.role, 'VIEW_MEMBERS');

    const members = await this.prisma.tripMembership.findMany({
      where: { tripId },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return members.map((m) => toTripMemberView(m, m.user));
  }

  async updateMemberRole(userId: string, tripId: string, targetUserId: string, role: TripRole) {
    const { trip, membership } = await this.authz.requireMembership(userId, tripId);
    this.authz.assertPermission(membership.role, 'CHANGE_ROLES');
    this.authz.assertTripWritable(trip);

    const target = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId: targetUserId } },
    });
    if (!target) {
      throw new ConflictException('User is not a member of this trip');
    }

    if (target.role === 'OWNER' && role !== 'OWNER') {
      const owners = await this.authz.countOwners(tripId);
      if (owners <= 1) {
        throw new ForbiddenException('Cannot demote the last owner');
      }
    }

    const updated = await this.prisma.tripMembership.update({
      where: { tripId_userId: { tripId, userId: targetUserId } },
      data: { role },
      include: { user: true },
    });

    return toTripMemberView(updated, updated.user);
  }

  async removeMember(userId: string, tripId: string, targetUserId: string) {
    const { trip, membership } = await this.authz.requireMembership(userId, tripId);
    this.authz.assertPermission(membership.role, 'REMOVE_MEMBER');
    this.authz.assertTripWritable(trip);

    const target = await this.prisma.tripMembership.findUnique({
      where: { tripId_userId: { tripId, userId: targetUserId } },
    });
    if (!target) {
      return;
    }

    if (target.role === 'OWNER') {
      const owners = await this.authz.countOwners(tripId);
      if (owners <= 1) {
        throw new ForbiddenException('Cannot remove the last owner');
      }
    }

    await this.prisma.tripMembership.delete({
      where: { tripId_userId: { tripId, userId: targetUserId } },
    });
  }
}
